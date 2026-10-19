/*
 * Guided comparison of successful MAGiC sweep simulations. The ordinary simulation
 * result and its plot remain untouched; only numeric time-series are saved.
 */

(() => {
    'use strict';

    const MAX_RUNS = 10;
    const mode = location.pathname.includes('eeprom') ? 'board' : 'virtual';
    const storageKey = `magic:sensitivity:v2:${mode}`;
    const theme = {
        panel: '#202c2d', axes: '#192225', text: '#d8ede0',
        grid: '#2e4245', spine: '#3a5558'
    };

    const colormapSelect = document.getElementById('colormap-select');
    const ids = {
        toggle: 'sensitivity-toggle',
        content: 'sensitivity-content',
        protein: 'sensitivity-protein',
        count: 'sensitivity-count',
        status: 'sensitivity-status',
        runs: 'sensitivity-runs',
        plot: 'sensitivity-plot',
        remove: 'sensitivity-remove-last',
        download: 'sensitivity-download',
        xMin: 'sensitivity-x-min',
        xMax: 'sensitivity-x-max',
        autoAxis: 'sensitivity-auto-axis'
    };
    const elements = Object.fromEntries(
        Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)])
    );
    if (Object.values(elements).some(element => !element)) return;

    let enabled = false;
    let selectedProtein = '';
    let runs = [];
    let storageError = '';
    let requestGeneration = 0;
    let displayMessage = '';

    // Presentation only: never round the sweep inputs or returned time-series.
    const formatValue = value => Number(value.toFixed(2)).toString();
    const formatLabel = label => label.replace(
        /( = )([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?= · |$)/i,
        (_, prefix, value) => prefix + formatValue(Number(value))
    );

    function setStatus(message) {
        elements.status.textContent = message;
    }

    function report(message) {
        displayMessage = message;
        setStatus(message);
    }

    function save() {
        try {
            sessionStorage.setItem(storageKey, JSON.stringify({
                enabled, selectedProtein, runs,
                axis: {
                    auto: elements.autoAxis.checked,
                    min: elements.xMin.value,
                    max: elements.xMax.value
                }
            }));
            storageError = '';
        } catch (error) {
            storageError = 'Browser session storage is unavailable or full; runs will be lost when this page closes.';
            setStatus(storageError);
            console.warn('Sensitivity analysis could not save runs:', error);
        }
    }

    function load() {
        try {
            const stored = sessionStorage.getItem(storageKey);
            if (!stored) return;
            const data = JSON.parse(stored);
            if (!data || !Array.isArray(data.runs) || data.runs.length > MAX_RUNS ||
                data.runs.some(run => !run || !run.series || !Array.isArray(run.series.time))) {
                throw new Error('Invalid saved sensitivity runs');
            }
            runs = data.runs;
            enabled = data.enabled === true;
            selectedProtein = typeof data.selectedProtein === 'string' ? data.selectedProtein : '';
            if (data.axis) {
                elements.autoAxis.checked = data.axis.auto !== false;
                elements.xMin.value = data.axis.min ?? '0';
                elements.xMax.value = data.axis.max ?? '24';
            }
        } catch (error) {
            storageError = 'Saved comparison data could not be read. Start a new comparison.';
            console.warn('Sensitivity analysis could not restore runs:', error);
        }
    }

    function availableProteins() {
        return [...new Set(runs.flatMap(run => Object.keys(run.series).filter(key => key !== 'time')))];
    }

    function snapshotParameters(result) {
        const snapshot = {};
        const occurrences = {};
        for (const component of result.component_parameters || []) {
            const location = JSON.stringify(component.position ?? '');
            const base = `${component.type || component.name || 'Component'} at ${location}`;
            occurrences[base] = (occurrences[base] || 0) + 1;
            const label = `${base} #${occurrences[base]}`;
            if (component.strength !== undefined) snapshot[`${label} · strength`] = component.strength;
            for (const [key, value] of Object.entries(component.parameters || {})) {
                snapshot[`${label} · ${key}`] = value;
            }
        }
        for (const [key, value] of Object.entries(result.global_parameters || {})) {
            snapshot[`Global · ${key}`] = value;
        }
        // Ignore regulation rates here: changing one rate should still count as
        // one parameter change. Capture only wiring and affected proteins.
        snapshot['Circuit connections'] = (result.regulations || [])
            .map(regulation => ({
                type: regulation.type || '',
                source: regulation.source || '',
                target: regulation.target || '',
                affected: [...(regulation.affected_cdss || [])].sort()
            }))
            .map(connection => JSON.stringify(connection))
            .sort();
        return snapshot;
    }

    function normalizeSeries(series) {
        if (!series || !Array.isArray(series.time) || series.time.length < 2 ||
            series.time.length > 10000 || !series.time.every(Number.isFinite) ||
            series.time.some((time, i) => i > 0 && time <= series.time[i - 1])) return null;
        const normalized = { time: series.time };
        for (const [protein, values] of Object.entries(series)) {
            if (protein !== 'time' && Array.isArray(values) && values.length === series.time.length &&
                values.every(value => typeof value === 'number' && Number.isFinite(value))) {
                normalized[protein] = values;
            }
        }
        return Object.keys(normalized).length > 1 ? normalized : null;
    }

    function paintComparison(protein) {
        let selected = runs
            .map((run, index) => ({ run, index, values: run.series[protein] }))
            .filter(entry => Array.isArray(entry.values) &&
                entry.values.length === entry.run.series.time.length);
        if (!selected.length) return null;

        const colormap = colormapSelect?.value || 'cool';
        const colors = window.MAGIC_SENSITIVITY_COLORMAPS?.[colormap]?.[runs.length];

        if (!Array.isArray(colors) || colors.length < runs.length) {
            throw new Error(
                `The ${colormap} comparison color palette could not be loaded. Refresh the page.`
            );
        }

        const manual = !elements.autoAxis.checked;
        const lower = Number(elements.xMin.value);
        const upper = Number(elements.xMax.value);

        if (
            manual &&
            (
                elements.xMin.value === '' ||
                elements.xMax.value === '' ||
                !Number.isFinite(lower) ||
                !Number.isFinite(upper) ||
                lower < 0 ||
                upper > 24 ||
                lower >= upper
            )
        ) {
            throw new Error(
                'X-axis bounds must satisfy 0 ≤ minimum < maximum ≤ 24 hours.'
            );
        }

        if (manual) {
            selected = selected.map(entry => {
                const times = entry.run.series.time;
                const values = entry.values;

                const interpolate = time => {
                    const i = times.findIndex(t => t >= time);

                    if (i < 0) return values.at(-1);
                    if (i === 0 || times[i] === time) return values[i];

                    return values[i - 1] + (values[i] - values[i - 1]) *
                        (time - times[i - 1]) / (times[i] - times[i - 1]);
                };

                const inside = times
                    .map((time, i) => ({ time, value: values[i] }))
                    .filter(point => point.time > lower && point.time < upper);

                return {
                    ...entry,
                    run: {
                        ...entry.run,
                        series: {
                            time: [lower, ...inside.map(p => p.time), upper]
                        }
                    },
                    values: [
                        interpolate(lower),
                        ...inside.map(p => p.value),
                        interpolate(upper)
                    ]
                };
            });
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1100;
        canvas.height = 690;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This browser cannot generate the comparison PNG.');
        ctx.fillStyle = theme.panel;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Sensitivity analysis: ${protein}`.slice(0, 65), 84, 44);

        const left = 90, top = 78, right = 1055, bottom = 468;
        ctx.fillStyle = theme.axes;
        ctx.fillRect(left, top, right - left, bottom - top);
        const sharedLength = Math.min(...selected.map(({ run, values }) =>
            Math.min(run.series.time.length, values.length)));
        let displayEnd = sharedLength - 1;

        // Initial-condition changes often converge quickly. If all curves become
        // visually indistinguishable, focus the x-axis on the informative part.
        if (!manual && selected.length > 1 && sharedLength > 2) {
            let overallMin = Infinity, overallMax = -Infinity;
            selected.forEach(({ values }) => values.slice(0, sharedLength).forEach(value => {
                overallMin = Math.min(overallMin, value);
                overallMax = Math.max(overallMax, value);
            }));
            const visibleSpread = Math.max((overallMax - overallMin) * 0.01, 1e-9);
            let lastDifferent = 0;

            for (let i = 0; i < sharedLength; i++) {
                const valuesAtTime = selected.map(entry => entry.values[i]);
                if (Math.max(...valuesAtTime) - Math.min(...valuesAtTime) > visibleSpread) {
                    lastDifferent = i;
                }
            }

            if (lastDifferent < sharedLength - 1) {
                const paddedEnd = Math.ceil(lastDifferent * 1.35) + 1;
                displayEnd = Math.min(
                    sharedLength - 1,
                    Math.max(paddedEnd, Math.ceil((sharedLength - 1) * 0.08))
                );
            }
        }


        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        selected.forEach(({ run, values }) => {
            run.series.time.slice(0, displayEnd + 1).forEach(value => {
                minX = Math.min(minX, value);
                maxX = Math.max(maxX, value);
            });
            values.slice(0, displayEnd + 1).forEach(value => {
                minY = Math.min(minY, value);
                maxY = Math.max(maxY, value);
            });
        });

        const xSpan = maxX - minX || 1;
        const ySpan = maxY - minY || 1;
        const yTop = maxY + ySpan * 0.08;
        const yBottom = minY - ySpan * 0.08;
        const xAt = value =>
            left + (value - minX) / xSpan * (right - left);
        const yAt = value =>
            bottom - (value - yBottom) / (yTop - yBottom) * (bottom - top);
        ctx.font = '14px sans-serif';
        ctx.strokeStyle = theme.grid;
        ctx.fillStyle = theme.text;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        for (let i = 0; i <= 5; i++) {
            const x = left + i / 5 * (right - left);
            const y = bottom - i / 5 * (bottom - top);
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText((minX + i / 5 * xSpan).toPrecision(3), x, bottom + 25);
            ctx.textAlign = 'right';
            ctx.fillText((yBottom + i / 5 * (yTop - yBottom)).toPrecision(3), left - 10, y + 5);
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.spine;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.text;
        ctx.fillText('Time (hours)', (left + right) / 2, bottom + 52);
        ctx.save();
        ctx.translate(24, (top + bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Concentration (µM)', 0, 0);
        ctx.restore();

        selected.forEach(({ run, index, values }) => {
            ctx.beginPath();
            ctx.strokeStyle = colors[index];
            ctx.lineWidth = 3;
            values.slice(0, displayEnd + 1).forEach((value, i) => {
                const x = xAt(run.series.time[i]), y = yAt(value);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });

        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.text;
        ctx.fillText('Parameter values', left, 552);
        ctx.font = '13px sans-serif';
        selected.forEach(({ run, index }, position) => {
            const column = position % 2, row = Math.floor(position / 2);
            const x = left + column * 493, y = 579 + row * 22;
            ctx.strokeStyle = colors[index];
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x + 25, y - 4);
            ctx.stroke();
            ctx.fillStyle = theme.text;
            ctx.fillText(formatLabel(run.label).slice(0, 57), x + 35, y);
        });
        
        if (displayEnd < sharedLength - 1) {
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = theme.text;
            ctx.fillText(
                `Focused on the interval where curves differ (full simulation: ${selected[0].run.series.time.at(-1).toPrecision(3)})`,
                right,
                526
            );
        }
        return canvas.toDataURL('image/png');
    }

    function render() {
        elements.content.hidden = !enabled;
        elements.toggle.textContent = enabled ? 'Close analysis' : runs.length ? 'Open analysis' : 'Enable analysis';
        elements.toggle.setAttribute('aria-expanded', String(enabled));
        elements.toggle.setAttribute('aria-pressed', String(enabled));
        elements.count.textContent = `${runs.length} / ${MAX_RUNS} runs`;
        elements.remove.disabled = runs.length === 0;

        const proteins = availableProteins();
        if (!proteins.includes(selectedProtein)) selectedProtein = proteins[0] || '';
        elements.protein.replaceChildren();
        if (!proteins.length) elements.protein.add(new Option('Select a protein', ''));
        else proteins.forEach(protein => elements.protein.add(new Option(protein, protein)));
        elements.protein.value = selectedProtein;
        elements.protein.disabled = !proteins.length;

        elements.runs.replaceChildren();
        // Keep the legacy list as hidden bookkeeping for sweep controls;
        // the chart legend is the only visible list of curve labels.
        elements.runs.hidden = true;
        runs.forEach((run, index) => {
            const item = document.createElement('li');
            item.textContent = `${index + 1}. ${formatLabel(run.label)}`;
            elements.runs.appendChild(item);
        });

        elements.plot.hidden = true;
        elements.plot.removeAttribute('src');
        elements.download.removeAttribute('href');
        elements.download.setAttribute('aria-disabled', 'true');
        if (selectedProtein) {
            try {
                const png = paintComparison(selectedProtein);
                if (png) {
                    elements.plot.src = png;
                    elements.plot.alt = `${runs.length} recorded runs comparing ${selectedProtein} concentration over time`;
                    elements.plot.hidden = false;
                    elements.download.href = png;
                    elements.download.download = `sensitivity-${mode}-${selectedProtein.replace(/[^a-z0-9_-]+/gi, '-')}.png`;
                    elements.download.setAttribute('aria-disabled', 'false');
                }
            } catch (error) {
                setStatus(`Could not render comparison: ${error.message}`);
                return;
            }
        }

        const missing = runs.filter(run => selectedProtein && !run.series[selectedProtein]).length;
        const latest = runs.at(-1);

        const caution = latest?.label.includes('parameter or board changes')
            ? ' More than one input changed; interpret this comparison with care.'
            : latest?.label === 'Circuit connections changed'
                ? ' Circuit wiring changed; this is not a single-parameter comparison.' : '';

        const previous = runs.at(-2);
        const currentValues = latest?.series[selectedProtein];
        const previousValues = previous?.series[selectedProtein];
        const unchangedCurve = latest && previous && selectedProtein &&
            Array.isArray(currentValues) && Array.isArray(previousValues) &&
            currentValues.length === previousValues.length &&
            latest.series.time.length === previous.series.time.length &&
            latest.series.time.every((time, i) => time === previous.series.time[i]) &&
            currentValues.every((value, i) => value === previousValues[i]);
        const unchangedNote = unchangedCurve
            ? ' The selected protein curve is unchanged from the previous run; this edit may not affect this circuit.'
            : '';

        setStatus(storageError || displayMessage || (runs.length === MAX_RUNS
            ? `10-run limit reached. Remove the last run to add another.${caution}${unchangedNote}`
            : missing
                ? `${missing} run(s) do not contain ${selectedProtein}; those curves are not plotted.${caution}${unchangedNote}`
                : runs.length
                    ? `${runs.length} run(s) saved for this ${mode} session.${caution}${unchangedNote}`
                    : 'No curves yet. Select a component to begin.'));

    }


    function capture(result, label) {
        // Ordinary Run Simulation calls never add comparison curves.
        if (!label || !enabled || !result || !['success', 'partial'].includes(result.status)) return false;
        if (runs.length >= MAX_RUNS) {
            setStatus('10-run limit reached. Remove the last run to add another.');
            return false;
        }
        const series = normalizeSeries(result.time_series);
        if (!series) {
            setStatus('This simulation returned no usable protein time-series. Nothing was saved.');
            return false;
        }
        const parameters = snapshotParameters(result);
        runs.push({
            series,
            parameters,
            label
        });
        if (!selectedProtein) selectedProtein = Object.keys(series).find(key => key !== 'time') || '';
        save();
        render();
        return true;
    }

    function reset() {
        requestGeneration++;
        window.SensitivitySweep?.reset();
        runs = [];
        selectedProtein = '';
        enabled = false;
        displayMessage = '';
        elements.autoAxis.checked = true;
        elements.xMin.value = '0';
        elements.xMax.value = '24';
        save();
        render();
    }

    elements.toggle.addEventListener('click', () => {
        enabled = !enabled;
        if (!enabled) window.SensitivitySweep?.cancel();
        save();
        render();
    });
    elements.protein.addEventListener('change', () => {
        selectedProtein = elements.protein.value;
        save();
        render();
    });
    elements.remove.addEventListener('click', () => {
        if (window.SensitivitySweep?.isRunning()) return;
        runs.pop();
        displayMessage = '';
        save();
        render();
    });
    elements.download.addEventListener('click', event => {
        if (!elements.download.href) event.preventDefault();
    });
    [elements.xMin, elements.xMax].forEach(input => input.addEventListener('input', () => {
        elements.autoAxis.checked = false;
        displayMessage = '';
        save();
        render();
    }));

    elements.autoAxis.addEventListener('change', () => {
        displayMessage = '';
        save();
        render();
    });

    colormapSelect?.addEventListener('change', render);

    load();
    render();
    window.SensitivityAnalysis = {
        formatValue,
        capture,
        reset,
        report,
        replaceRuns: () => {
            runs = [];
            displayMessage = '';
            save();
            render();
        },
        enabled: () => enabled,
        beginRun: () => {
            window.SensitivitySweep?.cancel();
            return ++requestGeneration;
        },
        shouldAccept: token => token === requestGeneration,
        invalidatePending: () => {
        requestGeneration++;
        window.SensitivitySweep?.reset();
}
    };
})();
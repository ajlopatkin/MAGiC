/*
 * Optional comparison of successful MAGiC simulations. The ordinary simulation
 * result and its plot remain untouched; only numeric time-series are saved.
 */
(() => {
    'use strict';

    const MAX_RUNS = 10;
    const mode = location.pathname.includes('eeprom') ? 'board' : 'virtual';
    const storageKey = `magic:sensitivity:v1:${mode}`;
    const colors = [
        '#246b56', '#c15830', '#376db3', '#a44479', '#88702a',
        '#4a8b9d', '#744fb4', '#a25040', '#628431', '#596678'
    ];
    const ids = {
        toggle: 'sensitivity-toggle',
        content: 'sensitivity-content',
        protein: 'sensitivity-protein',
        count: 'sensitivity-count',
        status: 'sensitivity-status',
        runs: 'sensitivity-runs',
        plot: 'sensitivity-plot',
        remove: 'sensitivity-remove-last',
        download: 'sensitivity-download'
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

    function setStatus(message) {
        elements.status.textContent = message;
    }

    function save() {
        try {
            sessionStorage.setItem(storageKey, JSON.stringify({ enabled, selectedProtein, runs }));
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

    function describeChange(previous, current) {
        if (!previous) return 'Baseline';
        const changed = [...new Set([...Object.keys(previous), ...Object.keys(current)])]
            .filter(key => JSON.stringify(previous[key]) !== JSON.stringify(current[key]));
        if (changed.length === 0) return 'No parameter change';
        if (changed.length > 1) return `${changed.length} parameter or board changes`;
        const key = changed[0];
        if (key === 'Circuit connections') return 'Circuit connections changed';
        return `${key}: ${String(previous[key] ?? '—')} → ${String(current[key] ?? '—')}`;
    }

    function normalizeSeries(series) {
        if (!series || !Array.isArray(series.time) || series.time.length < 2 ||
            series.time.length > 10000 || !series.time.every(Number.isFinite)) return null;
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
        const selected = runs
            .map((run, index) => ({ run, index, values: run.series[protein] }))
            .filter(entry => Array.isArray(entry.values) &&
                entry.values.length === entry.run.series.time.length);
        if (!selected.length) return null;

        const canvas = document.createElement('canvas');
        canvas.width = 1100;
        canvas.height = 690;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This browser cannot generate the comparison PNG.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#193329';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Sensitivity analysis: ${protein}`.slice(0, 65), 84, 44);

        const left = 90, top = 78, right = 1055, bottom = 468;
        const sharedLength = Math.min(...selected.map(({ run, values }) =>
            Math.min(run.series.time.length, values.length)));
        let displayEnd = sharedLength - 1;

        if (selected.length > 1 && sharedLength > 2) {
            let overallMin = Infinity, overallMax = -Infinity;
            selected.forEach(({ values }) =>
                values.slice(0, sharedLength).forEach(value => {
                    overallMin = Math.min(overallMin, value);
                    overallMax = Math.max(overallMax, value);
                })
            );

            const visibleSpread = Math.max(
                (overallMax - overallMin) * 0.01, 1e-9
            );
            let lastDifferent = 0;

            for (let i = 0; i < sharedLength; i++) {
                const valuesAtTime = selected.map(entry => entry.values[i]);
                if (Math.max(...valuesAtTime) - Math.min(...valuesAtTime) >
                    visibleSpread) {
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

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
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
            bottom - (value - yBottom) / (yTop - yBottom) *
            (bottom - top);
        
        ctx.font = '14px sans-serif';
        ctx.strokeStyle = '#e1e8e3';
        ctx.fillStyle = '#41554b';
        ctx.lineWidth = 1;
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
        ctx.strokeStyle = '#586d5d';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#193329';
        ctx.fillText('Time', (left + right) / 2, bottom + 52);
        ctx.save();
        ctx.translate(24, (top + bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Protein concentration', 0, 0);
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
        ctx.fillStyle = '#193329';
        ctx.fillText('Recorded runs', left, 552);
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
            ctx.fillStyle = '#263c31';
            ctx.fillText(`${index + 1}. ${run.label}`.slice(0, 57), x + 35, y);
        });
        
        if (displayEnd < sharedLength - 1) {
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#586d5d';
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
        elements.toggle.textContent = enabled ? 'Pause analysis' : runs.length ? 'Resume analysis' : 'Enable analysis';
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
        runs.forEach((run, index) => {
            const item = document.createElement('li');
            item.textContent = `${index + 1}. ${run.label}`;
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

        const missing = runs.filter(
            run => selectedProtein && !run.series[selectedProtein]
        ).length;
        const latest = runs.at(-1);

        const caution = latest?.label.includes('parameter or board changes')
            ? ' More than one input changed; interpret this comparison with care.'
            : latest?.label === 'Circuit connections changed'
                ? ' Circuit wiring changed; this is not a single-parameter comparison.'
                : '';

        const previous = runs.at(-2);
        const currentValues = latest?.series[selectedProtein];
        const previousValues = previous?.series[selectedProtein];
        const unchangedCurve = latest && previous && selectedProtein &&
            Array.isArray(currentValues) &&
            Array.isArray(previousValues) &&
            currentValues.length === previousValues.length &&
            latest.series.time.length === previous.series.time.length &&
            latest.series.time.every(
                (time, i) => time === previous.series.time[i]
            ) &&
            currentValues.every(
                (value, i) => value === previousValues[i]
            );
        const unchangedNote = unchangedCurve
            ? ' The selected protein curve is unchanged from the previous run; this edit may not affect this circuit.'
            : '';

        setStatus(storageError || (runs.length === MAX_RUNS
            ? `10-run limit reached. Remove the last run to add another.${caution}${unchangedNote}`
            : missing
                ? `${missing} run(s) do not contain ${selectedProtein}; those curves are not plotted.${caution}${unchangedNote}`
                : runs.length
                    ? `${runs.length} run(s) saved for this ${mode} session.${caution}${unchangedNote}`
                    : 'No runs recorded yet. Run a simulation to begin.'));
        }
        
    function capture(result) {
        if (!enabled || !result || !['success', 'partial'].includes(result.status)) return;
        if (runs.length >= MAX_RUNS) {
            setStatus('10-run limit reached. Remove the last run to add another.');
            return;
        }
        const series = normalizeSeries(result.time_series);
        if (!series) {
            setStatus('This simulation returned no usable protein time-series. Nothing was saved.');
            return;
        }
        const parameters = snapshotParameters(result);
        runs.push({
            series,
            parameters,
            label: describeChange(runs.at(-1)?.parameters, parameters)
        });
        if (!selectedProtein) selectedProtein = Object.keys(series).find(key => key !== 'time') || '';
        save();
        render();
    }

    function reset() {
        requestGeneration++;
        runs = [];
        selectedProtein = '';
        enabled = false;
        save();
        render();
    }

    elements.toggle.addEventListener('click', () => {
        enabled = !enabled;
        save();
        render();
    });
    elements.protein.addEventListener('change', () => {
        selectedProtein = elements.protein.value;
        save();
        render();
    });
    elements.remove.addEventListener('click', () => {
        runs.pop();
        save();
        render();
    });
    elements.download.addEventListener('click', event => {
        if (!elements.download.href) event.preventDefault();
    });

    load();
    render();
    window.SensitivityAnalysis = {
        capture,
        reset,
        beginRun: () => ++requestGeneration,
        shouldAccept: token => token === requestGeneration,
        invalidatePending: () => { requestGeneration++; }
    };
})();
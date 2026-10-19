/*
 * Guided, sequential sweeps over an immutable simulation request. Selection is
 * opt-in, so ordinary clicks still open the existing component parameter modal.
 */

(() => {
    'use strict';
    const byId = id => document.getElementById(`sensitivity-${id}`);
    const ui = Object.fromEntries([
        'select', 'target', 'parameter', 'lower', 'upper', 'curves',
        'start', 'cancel', 'preview'
    ].map(key => [key, byId(key)]));
    if (Object.values(ui).some(element => !element) || !window.SensitivityAnalysis) return;
    const analysis = window.SensitivityAnalysis;
    let target = null;
    let selecting = false;
    let running = false;
    let generation = 0;
    let controller = null;
    const format = analysis.formatValue;

    function specification() {
        return (window.MAGIC_PARAMETER_SCHEMA?.[target?.type] || [])
            .find(parameter => parameter.key === ui.parameter.value);
    }

    function sweepValues() {
        const parameter = specification();
        if (!target || !parameter) throw new Error('Select a placed component and an editable parameter.');
        const lower = Number(ui.lower.value), upper = Number(ui.upper.value);
        const count = Number(ui.curves.value);
        if (!ui.lower.value.trim() || !ui.upper.value.trim() ||
            !Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
            throw new Error('Enter finite bounds with the lower bound less than the upper bound.');
        }
        if (lower < parameter.min || upper > parameter.max) {
            throw new Error(`Allowed bounds: ${parameter.min} to ${parameter.max}.`);
        }
        if (!Number.isInteger(count) || count < 2 || count > 10) {
            throw new Error('Choose a whole number of curves from 2 to 10.');
        }
        const values = Array.from({ length: count }, (_, index) =>
            index === count - 1 ? upper : lower + (upper - lower) * index / (count - 1));
        if (parameter.integer && (!Number.isInteger(lower) || !Number.isInteger(upper) ||
            !Number.isInteger((upper - lower) / (count - 1)))) {
            throw new Error('Cooperativity needs distinct evenly spaced integers. Adjust the bounds or curve count.');
        }
        if (new Set(values).size !== count) throw new Error('These bounds are too close to produce distinct values.');
        return { parameter, lower, upper, count, values };
    }

    function preview() {
        try {
            const { values } = sweepValues();
            ui.preview.textContent = `Parameter values: ${values.map(format).join(', ')}`;
            ui.start.disabled = running;
        } catch (error) {
            ui.preview.textContent = error.message;
            ui.start.disabled = true;
        }
    }

    function markSelection() {
        document.querySelectorAll('.placed-component').forEach(element => {
            const cell = element.parentElement;
            element.classList.toggle('sensitivity-selected', !!target &&
                Number(cell?.dataset.x) === target.x && Number(cell?.dataset.y) === target.y);
        });
    }

    function setSelecting(value) {
        selecting = value;
        ui.select.textContent = value ? 'Cancel selection' : 'Select component';
        ui.select.setAttribute('aria-pressed', String(value));
        document.body.classList.toggle('sensitivity-selecting', value);
    }

    function parameterChanged() {
        const parameter = specification();
        if (parameter) {
            [ui.lower, ui.upper].forEach(input => {
                input.min = parameter.min;
                input.max = parameter.max;
                input.step = parameter.integer ? '1' : '0.1';
            });
            ui.lower.value = String(parameter.min);
            // Offer a valid default five-integer sweep where the range allows it.
            ui.upper.value = String(parameter.integer
                ? Math.min(parameter.max, parameter.min + Number(ui.curves.value) - 1)
                : parameter.max);
        }
        preview();
    }

    function selectComponent(type, x, y, number, component) {
        if (!selecting || running) return false;
        const parameters = window.MAGIC_PARAMETER_SCHEMA?.[type] || [];
        if (!parameters.length) {
            analysis.report('This component has no editable parameters to compare. Choose another component.');
            return true;
        }
        target = { type, x: Number(x), y: Number(y), number, name: component?.customName || type };
        ui.target.textContent = `${target.name} (${type} #${number}) at (${x}, ${y})`;
        ui.parameter.replaceChildren();
        parameters.forEach(parameter => ui.parameter.add(
            new Option(parameter.label.replace(/:$/, ''), parameter.key)
        ));
        ui.parameter.value = parameters[0].key;
        setSelecting(false);
        markSelection();
        parameterChanged();
        analysis.report('Component selected. Choose the bounds, then run the comparison.');
        return true;
    }

    function setBusy(value) {
        running = value;
        ['select', 'parameter', 'lower', 'upper', 'curves'].forEach(key => {
            ui[key].disabled = value;
        });
        ui.cancel.disabled = !value;
        byId('remove-last').disabled = value || byId('runs').children.length === 0;
        preview();
    }

    function cancel(message = 'Comparison cancelled. Completed curves have been kept.') {
        const wasRunning = running;
        generation++;
        controller?.abort();
        controller = null;
        setSelecting(false);
        setBusy(false);
        if (wasRunning) analysis.report(message);
    }

    function reset() {
        cancel();
        target = null;
        ui.target.textContent = 'None selected';
        ui.parameter.replaceChildren(new Option('Select a component first', ''));
        ui.lower.value = '';
        ui.upper.value = '';
        ui.curves.value = '5';
        markSelection();
        preview();
    }

    async function start() {
        if (running) return;
        let failedValue = null;
        let token;
        let runGeneration;
        let completed = 0;
        try {
            if (!analysis.enabled()) throw new Error('Enable sensitivity analysis first.');
            const sweep = sweepValues();
            // Ordinary simulation and hardware/Clear Board actions invalidate this token.
            token = analysis.beginRun();
            runGeneration = ++generation;
            setSelecting(false);
            setBusy(true);
            const snapshot = await runSimulationFromPlacedComponents({ snapshot: true });
            if (runGeneration !== generation || !analysis.shouldAccept(token)) return;
            if (!(snapshot.cellboard[target.type] || []).some(component =>
                Number(component.x) === target.x && Number(component.y) === target.y)) {
                throw new Error('The selected component is no longer on the board. Select a component again.');
            }
            const selectedTarget = { ...target };
            analysis.replaceRuns();
            const parameterLabel = sweep.parameter.label.replace(/:$/, '');
            for (let index = 0; index < sweep.count; index++) {
                failedValue = sweep.values[index];
                analysis.report(`Running curve ${index + 1} of ${sweep.count}: ${parameterLabel} = ${format(failedValue)}…`);
                controller = new AbortController();
                const response = await fetch('/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        ...snapshot,
                        sweep: {
                            type: selectedTarget.type, x: selectedTarget.x, y: selectedTarget.y,
                            parameter: sweep.parameter.key, lower: sweep.lower, upper: sweep.upper,
                            count: sweep.count, index
                        }
                    })
                });
                if (runGeneration !== generation || !analysis.shouldAccept(token)) return;
                const result = await response.json();
                if (runGeneration !== generation || !analysis.shouldAccept(token)) return;
                if (!response.ok || !['success', 'partial'].includes(result.status)) {
                    throw new Error(result.message || `Server error ${response.status}`);
                }
                const label = `${parameterLabel} = ${format(failedValue)} · ${selectedTarget.name} (${selectedTarget.x}, ${selectedTarget.y})`;
                if (!analysis.capture(result, label)) throw new Error('No usable protein time-series was returned.');
                completed++;
                byId('remove-last').disabled = true;
            }
            analysis.report(`Comparison complete: ${completed} curves. All other circuit inputs were held fixed.`);
        } catch (error) {
            if (error.name === 'AbortError' || (runGeneration != null && runGeneration !== generation)) return;
            analysis.report(failedValue == null ? error.message :
                `Comparison stopped at ${format(failedValue)}: ${error.message} ${completed} completed curve(s) kept.`);
        } finally {
            if (runGeneration == null || runGeneration === generation) {
                controller = null;
                setBusy(false);
            }
        }
    }

    ui.select.addEventListener('click', () => {
        if (!running) {
            setSelecting(!selecting);
            analysis.report(selecting ? 'Click a placed component on the board to select it for the comparison.' :
                'Selection cancelled. Ordinary component editing is active.');
        }
    });
    ui.parameter.addEventListener('change', parameterChanged);
    [ui.lower, ui.upper, ui.curves].forEach(input => input.addEventListener('input', preview));
    ui.start.addEventListener('click', start);
    ui.cancel.addEventListener('click', () => cancel());
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && selecting) setSelecting(false);
    });
    window.SensitivitySweep = { selectComponent, cancel, reset, isRunning: () => running };
    preview();
})();
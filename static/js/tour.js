// static/js/tour.js
// Onboarding tour — walks through virtual mode, then board mode.
// Uses Driver.js for spotlight + tooltip positioning.

(function () {
    'use strict';

    const TOUR_KEY = 'magic_tour_completed';
    const TOUR_PARAM = 'tour';

    // ── Step definitions ────────────────────────────────────────────
    const DIAL_STEPS = [
        {
            element: '.component-palette',
            popover: {
                title: '1. Component Palette',
                description: 'Click a component here, then click a cell on the board to place it.'
            }
        },
        {
            element: '.cell-board',
            popover: {
                title: '2. The Board',
                description: 'Place components in order: Promoter → RBS → CDS → Terminator.'
            }
        },
        {
            element: '#simulate-btn',
            popover: {
                title: '3. Simulate',
                description: "When your circuit is ready, click here to run the simulation."
            }
        },
        {
            element: '#plot-container',
            popover: {
                title: '4. Results',
                description: 'Your protein concentrations, equations, and circuit analysis appear here.'
            }
        },
        {
            popover: {
                title: 'Virtual mode done',
                description: "Now let's see how board mode works. Click Next to continue.",
                doneBtnText: 'Next →'
            }
        }
    ];

    const EEPROM_STEPS = [
        {
            element: '#hamburger-toggle',
            popover: {
                title: '1. Hardware Menu',
                description: 'Open this menu to connect to your Arduino and control the board.'
            },
            onDeselected: () => {
                // Open the panel when the user clicks Next on this step
                const toggle = document.getElementById('hamburger-toggle');
                const panel = document.getElementById('parameters-panel');
                if (toggle && panel && !panel.classList.contains('open')) {
                    toggle.click();
                }
            }
        },
        {
            element: '#btn-refresh-ports',
            popover: {
                title: '2. Refresh Ports',
                description: 'Click here to find available USB ports on your computer.'
            }
        },
        {
            element: '#btn-connect',
            popover: {
                title: '3. Connect',
                description: 'Select your Arduino port, then click Connect.'
            },
            onDeselected: () => {
                // Close the panel when the user clicks Next on this step
                const toggle = document.getElementById('hamburger-toggle');
                const panel = document.getElementById('parameters-panel');
                if (toggle && panel && panel.classList.contains('open')) {
                    toggle.click();
                }
            }
        },
        {
            element: '#btn-get-board',
            popover: {
                title: '4. Read Board',
                description: 'Once connected, click here to pull your physical circuit onto the grid.'
            }
        },
        {
            element: '#simulate-btn',
            popover: {
                title: '5. Simulate Hardware',
                description: 'Run the simulation using the components read from your board.'
            }
        },
        {
            popover: {
                title: 'All done!',
                description: "You're ready to design and simulate. Use the menu anytime to restart this tour."
            }
        }
    ];

    // ── Home-page prompt ────────────────────────────────────────────
    function initHomePrompt() {
        if (localStorage.getItem(TOUR_KEY) === 'true') return;
        if (new URLSearchParams(window.location.search).get(TOUR_PARAM) === '1') return;

        const prompt = document.getElementById('tour-prompt');
        if (!prompt) {
            console.warn('[Tour] #tour-prompt not found on this page');
            return;
        }

        setTimeout(() => {
            prompt.style.display = 'block';
        }, 2000);

        document.getElementById('tour-start')?.addEventListener('click', () => {
            window.location.href = '/dial?' + TOUR_PARAM + '=1';
        });

        document.getElementById('tour-skip')?.addEventListener('click', () => {
            localStorage.setItem(TOUR_KEY, 'true');
            prompt.style.display = 'none';
        });

        document.getElementById('tour-prompt-close')?.addEventListener('click', () => {
            prompt.style.display = 'none';
        });
    }

    // ── Run a tour with Driver.js ───────────────────────────────────
    function runTour(steps, onComplete) {
        if (typeof window.driver === 'undefined') {
            console.warn('[Tour] Driver.js not loaded — skipping tour');
            onComplete();
            return;
        }

        const d = window.driver.js.driver({
            showProgress: true,
            showButtons: ['next', 'previous', 'close'],
            nextBtnText: 'Next',
            prevBtnText: 'Back',
            doneBtnText: 'Finish',
            progressText: '{{current}} of {{total}}',
            steps: steps,
            onDestroyed: () => {
                onComplete();
            }
        });

        d.drive();
    }

    // ── Page-level auto-start ───────────────────────────────────────
    function maybeAutoStart() {
        const params = new URLSearchParams(window.location.search);
        if (params.get(TOUR_PARAM) !== '1') return;

        const path = window.location.pathname;

        if (path === '/dial') {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    runTour(DIAL_STEPS, () => {
                        window.location.href = '/eeprom?' + TOUR_PARAM + '=1';
                    });
                }, 600);
            });
        } else if (path === '/eeprom') {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    runTour(EEPROM_STEPS, () => {
                        localStorage.setItem(TOUR_KEY, 'true');
                    });
                }, 600);
            });
        }
    }

    // ── Public API ──────────────────────────────────────────────────
    window.Tour = {
        initHomePrompt,
        maybeAutoStart,
        reset: () => localStorage.removeItem(TOUR_KEY),
    };
})();
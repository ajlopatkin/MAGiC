// Simplified Genetic Circuit Designer JavaScript without Gene Tabs System

// ===== REGULATOR TYPES CONSTANT =====
const REGULATOR_TYPES = ['Repressor Start', 'Repressor End', 'Activator Start', 'Activator End', 
                        'Inducer Start', 'Inducer End', 'Inhibitor Start', 'Inhibitor End'];

document.addEventListener('DOMContentLoaded', function() {
    // Simplified state management
    const state = {
        currentComponent: null,
        currentStrength: 'norm',
        placedComponents: [],
        componentCounts: {}, // For auto-numbering: promoter_1, promoter_2, etc.
        isDragging: false,
        draggedElement: null,
        parameterDefaults: null,  // Will be loaded from API
        parameterRanges: null,
        // Cellboard format matching backend expectations
        cellboard: {
            'Promoter': [],
            'RBS': [],
            'CDS': [],
            'Terminator': [],
            'Repressor Start': [],
            'Repressor End': [],
            'Activator Start': [],
            'Activator End': [],
            'Inducer Start': [],
            'Inducer End': [],
            'Inhibitor Start': [],
            'Inhibitor End': []
        }
    };
    
    // Fetch parameter defaults from backend
    async function loadParameterDefaults() {
        try {
            const response = await fetch('/api/parameter_defaults');
            const data = await response.json();
            state.parameterDefaults = data.defaults;
            state.parameterRanges = data.ranges;
            console.log('✓ Loaded parameter defaults from constants.py:', data);
        } catch (error) {
            console.error('Failed to load parameter defaults:', error);
        }
    }
    
    // Load defaults on page load
    loadParameterDefaults();

    // DOM elements
    const components = document.querySelectorAll('.component');
    const cells = document.querySelectorAll('.cell');
    const simulateBtn = document.getElementById('simulate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const errorDisplay = document.getElementById('error-display');
    const plotContainer = document.getElementById('plot-container');

    // Initialize the application
    init();

    function init() {
        setupComponents();
        setupCells();
        setupButtons();
        setupDragAndDrop();
        setupGlobalClicks();
        setupDragModeToggle();
        updateSelectionStatus(); // Initialize status
        initializeConnectorSystem(); // Initialize connector system
        console.log('Simplified circuit designer initialized successfully');
    }
    // Setup global click handler to clear selection
    function setupGlobalClicks() {
        document.addEventListener('click', function(e) {
            // Check if click is outside component palette and board
            const isComponentClick = e.target.closest('.component');
            const isBoardClick = e.target.closest('.cell-board');
            const isPaletteClick = e.target.closest('.component-palette');
            
            if (!isComponentClick && !isBoardClick && !isPaletteClick) {
                // Clear selection if clicking outside
                if (state.currentComponent) {
                    clearComponentSelection();
                    state.currentComponent = null;
                    state.currentStrength = 'norm';
                    updateSelectionStatus();
                    console.log('Selection cleared');
                }
            }
        });
    }

    // Component selection and strength menu
    function setupComponents() {
        components.forEach(comp => {
            // Component click for selection and strength menu
            comp.addEventListener('click', function(e) {
                e.stopPropagation();
                
                // Clear previous selection
                clearComponentSelection();
                
                // Set current component
                state.currentComponent = this.dataset.component;
                state.currentStrength = 'norm'; // Default strength
                
                // Add selected state
                this.classList.add('selected');
                
                // Show placement mode on board
                showPlacementMode();
                
                // Handle strength menu if it exists (will be commented out, so default to 'norm')
                const menu = this.querySelector('.strength-menu');
                if (menu) {
                    // Hide all other menus
                    document.querySelectorAll('.strength-menu').forEach(m => {
                        if (m !== menu) m.style.display = 'none';
                    });
                    
                    // Toggle this menu
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                }
                
                // Visual feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
                
                // Update selection status
                updateSelectionStatus();
                
                console.log(`Selected component: ${state.currentComponent}`);
            });

            // Strength selection
            const strengthOptions = comp.querySelectorAll('.strength-option');
            strengthOptions.forEach(option => {
                option.addEventListener('click', function(e) {
                    e.stopPropagation();
                    state.currentStrength = this.dataset.strength;
                    this.parentElement.style.display = 'none';
                    
                    // Visual feedback
                    const component = this.closest('.component');
                    component.style.boxShadow = `0 0 0 3px ${getStrengthColor(state.currentStrength)}`;
                    setTimeout(() => {
                        component.style.boxShadow = '';
                    }, 1000);
                });
            });
        });
    }

   // Cell board interaction
function setupCells() {
    const cells = document.querySelectorAll('.cell');
    
    cells.forEach(cell => {
        // Click to place selected component
        cell.addEventListener('click', function(e) {
            console.log(`Cell clicked at (${this.dataset.x}, ${this.dataset.y})`);
            console.log(`Current selected component: ${state.currentComponent}`);
            
            if (state.currentComponent && state.currentComponent !== 'undefined') {
                const x = parseInt(this.dataset.x);
                const y = parseInt(this.dataset.y);
                
                console.log(`Placing component ${state.currentComponent} at (${x}, ${y})`);
                
                // Check if cell is already occupied
                if (this.classList.contains('has-component')) {
                    // Remove existing component first (including connector system cleanup)
                    removeComponentFromCell(this);
                }
                
                // Place the component using the updated logic
                const baseType = state.currentComponent.toLowerCase().replace(' ', '_');
                if (!state.componentCounts[baseType]) {
                    state.componentCounts[baseType] = 1;
                } else {
                    state.componentCounts[baseType]++;
                }
                
                const component = {
                    type: state.currentComponent,
                    number: state.componentCounts[baseType],
                    strength: state.currentStrength || 'norm',
                    x: x,
                    y: y,
                    id: `${baseType}_${x}_${y}_${Date.now()}`,
                    customName: null,
                    parameters: {}
                };
                
                state.placedComponents.push(component);
                
                // Also add to cellboard for backend compatibility and sync
                if (!state.cellboard[component.type]) {
                    state.cellboard[component.type] = [];
                }
                state.cellboard[component.type].push(component);
                
                console.log('Component placed:', component);
                console.log('Added to cellboard[' + component.type + ']:', state.cellboard[component.type]);
                
                // Update visual and register with connector system
                updateCellDisplay(x, y, component.type, component.number, component.customName, component);
                
                // Register component with connector system if it's a regulator
                if (REGULATOR_TYPES.includes(component.type)) {
                    console.log(`Component is a regulator type: ${component.type}`);
                    const connectorComp = registerComponentWithConnectorSystem(component, this);
                    if (connectorComp) {
                        console.log(`Connector component created successfully with ${connectorComp.inputPorts.length} input ports and ${connectorComp.outputPorts.length} output ports`);
                        
                        // Verify ports are visible in DOM
                        setTimeout(() => {
                            const ports = this.querySelectorAll('.component-port');
                            console.log(`DOM verification: Found ${ports.length} port(s) in cell:`, ports);
                            ports.forEach((port, idx) => {
                                const rect = port.getBoundingClientRect();
                                console.log(`  Port ${idx}: ${port.className}, position: (${rect.left}, ${rect.top}), size: ${rect.width}x${rect.height}`);
                                console.log(`  Port ${idx} data-drag:`, port.getAttribute('data-drag'));
                            });
                        }, 100);
                    } else {
                        console.warn(`Failed to create connector component for ${component.type}`);
                    }
                } else {
                    console.log(`Component is NOT a regulator type: ${component.type}`);
                }
                
                // Clear selection after placing
                clearComponentSelection();
                state.currentComponent = null;
                state.currentStrength = 'norm';
                updateSelectionStatus();
            } else {
                console.log('No component selected');
                // No component selected - show message
                showSelectionHint();
            }
        });
        
        // Right-click to remove component
        cell.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            const x = parseInt(this.dataset.x);
            const y = parseInt(this.dataset.y);
            removeComponent(x, y);
        });
    });
}

    // Dynamic parameter section creation
    function createDynamicParameterSection(componentType, componentNumber) {
        const dialAccordion = document.querySelector('.dial-accordion');
        if (!dialAccordion) return;
        
        // Create unique ID for this component instance
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const sectionId = `${baseType}_${componentNumber}`;
        
        // Check if section already exists
        if (document.getElementById(`section_${sectionId}`)) {
            return; // Already exists
        }
        
        // Create the parameter section
        const section = document.createElement('details');
        section.className = 'dial-accordion-item';
        section.id = `section_${sectionId}`;
        
        const summary = document.createElement('summary');
        summary.className = 'dial-accordion-header';
        summary.textContent = `${componentType} ${componentNumber} Parameters`;
        
        const body = document.createElement('div');
        body.className = 'dial-accordion-body';
        
        const grid = document.createElement('div');
        grid.className = 'dial-grid';
        
        // Generate parameters based on component type
        const parameters = getComponentParameters(componentType, componentNumber);
        
        parameters.forEach(param => {
            const label = document.createElement('label');
            label.setAttribute('for', param.id);
            label.textContent = param.label;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = param.id;
            input.name = param.id;
            input.min = param.min;
            input.max = param.max;
            input.step = param.step;
            input.value = param.defaultValue;
            
            // Store default value for reset functionality
            input.setAttribute('data-default-value', param.defaultValue);
            
            // Store parameter category for global mode updates
            if (param.id.includes('strength') || param.id.includes('promoter')) {
                input.setAttribute('data-param-type', 'transcription');
            } else if (param.id.includes('translation') || param.id.includes('rbs')) {
                input.setAttribute('data-param-type', 'translation');
            } else if (param.id.includes('degradation')) {
                input.setAttribute('data-param-type', 'degradation');
            }
            
            if (param.title) {
                input.title = param.title;
            }
            
            // Add change listener for synchronization
            input.addEventListener('input', function() {
                syncRegulatorPair(componentType, componentNumber, param.id, parseFloat(this.value));
            });
            
            grid.appendChild(label);
            grid.appendChild(input);
        });
        
        body.appendChild(grid);
        section.appendChild(summary);
        section.appendChild(body);
        
        // Insert before the last section (or at the end)
        dialAccordion.appendChild(section);
        
        console.log(`Created parameter section for ${componentType} ${componentNumber}`);
    }
    
    // Get parameters for a specific component type
    function getComponentParameters(componentType, componentNumber) {
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const num = componentNumber;
        
        // Get defaults from state (loaded from API) or use fallback
        const defaults = state.parameterDefaults || {};
        const ranges = state.parameterRanges || {};
        
        const commonParams = {
            'Promoter': [
                {
                    id: `promoter${num}_strength`,
                    label: 'Promoter Strength:',
                    min: ranges.strength?.[0] || 0.1,
                    max: ranges.strength?.[1] || 5.0,
                    step: 0.1,
                    defaultValue: defaults.promoter_strength || 5.0
                }
            ],
            'RBS': [
                {
                    id: `rbs${num}_efficiency`,
                    label: 'RBS Efficiency:',
                    min: ranges.efficiency?.[0] || 0.1,
                    max: ranges.efficiency?.[1] || 2.0,
                    step: 0.1,
                    defaultValue: defaults.rbs_efficiency || 1.0
                }
            ],
            'CDS': [
                {
                    id: `cds${num}_translation_rate`,
                    label: 'CDS Translation Rate:',
                    min: ranges.translation_rate?.[0] || 1.0,
                    max: ranges.translation_rate?.[1] || 20.0,
                    step: 0.5,
                    defaultValue: defaults.cds_translation_rate || 7.0
                },
                {
                    id: `cds${num}_degradation_rate`,
                    label: 'CDS Degradation Rate:',
                    min: ranges.degradation_rate?.[0] || 0.01,
                    max: ranges.degradation_rate?.[1] || 1.0,
                    step: 0.01,
                    defaultValue: defaults.cds_degradation_rate || 1.0
                },
                {
                    id: `protein${num}_initial_conc`,
                    label: 'Initial Protein Conc:',
                    min: 0.0,
                    max: 2.0,
                    step: 0.05,
                    defaultValue: defaults.cds_init_conc || 0.0,
                    title: 'Starting concentration (µM) - affects oscillation dynamics'
                }
            ],
            'Terminator': [
                {
                    id: `terminator${num}_efficiency`,
                    label: 'Terminator Efficiency:',
                    min: 0.1,
                    max: 1.0,
                    step: 0.01,
                    defaultValue: defaults.terminator_efficiency || 0.99
                }
            ],
            'Repressor Start': [
                {
                    id: `repressor${num}_Kr`,
                    label: 'Repression Constant (Kr):',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: defaults.repressor_Kr || 0.35,
                    title: 'Lower Kr = stronger repression'
                },
                {
                    id: `repressor${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: defaults.repressor_n || 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `repressor${num}_concentration`,
                    label: 'Initial Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'For floating repressors'
                }
            ],
            'Repressor End': [
                {
                    id: `repressor${num}_Kr`,
                    label: 'Repression Constant (Kr):',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.35,
                    title: 'Lower Kr = stronger repression'
                },
                {
                    id: `repressor${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `repressor${num}_concentration`,
                    label: 'Initial Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'For floating repressors'
                }
            ],
            'Activator Start': [
                {
                    id: `activator${num}_Ka`,
                    label: 'Activation Constant (Ka):',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.4,
                    title: 'Lower Ka = stronger activation'
                },
                {
                    id: `activator${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `activator${num}_concentration`,
                    label: 'Initial Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'For floating activators'
                }
            ],
            'Activator End': [
                {
                    id: `activator${num}_Ka`,
                    label: 'Activation Constant (Ka):',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.4,
                    title: 'Lower Ka = stronger activation'
                },
                {
                    id: `activator${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `activator${num}_concentration`,
                    label: 'Initial Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'For floating activators'
                }
            ],
            'Inducer Start': [
                {
                    id: `inducer${num}_strength`,
                    label: 'Inducer Strength:',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.5,
                    title: 'Strength of inducer effect (placeholder for backend)'
                },
                {
                    id: `inducer${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `inducer${num}_concentration`,
                    label: 'External Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'Concentration of external inducer'
                }
            ],
            'Inducer End': [
                {
                    id: `inducer${num}_strength`,
                    label: 'Inducer Strength:',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.5,
                    title: 'Strength of inducer effect (placeholder for backend)'
                },
                {
                    id: `inducer${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `inducer${num}_concentration`,
                    label: 'External Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'Concentration of external inducer'
                }
            ],
            'Inhibitor Start': [
                {
                    id: `inhibitor${num}_strength`,
                    label: 'Inhibitor Strength:',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.5,
                    title: 'Strength of inhibitor effect (placeholder for backend)'
                },
                {
                    id: `inhibitor${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `inhibitor${num}_concentration`,
                    label: 'External Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'Concentration of external inhibitor'
                }
            ],
            'Inhibitor End': [
                {
                    id: `inhibitor${num}_strength`,
                    label: 'Inhibitor Strength:',
                    min: 0.01,
                    max: 2.0,
                    step: 0.01,
                    defaultValue: 0.5,
                    title: 'Strength of inhibitor effect (placeholder for backend)'
                },
                {
                    id: `inhibitor${num}_n`,
                    label: 'Cooperativity (n):',
                    min: 1,
                    max: 6,
                    step: 1,
                    defaultValue: 2,
                    title: 'Hill coefficient - higher = sharper response'
                },
                {
                    id: `inhibitor${num}_concentration`,
                    label: 'External Concentration:',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0,
                    title: 'Concentration of external inhibitor'
                }
            ]
        };
        
        return commonParams[componentType] || [];
    }

    // Component placement logic
    function placeComponent(x, y, componentType, strength = 'norm') {
        // Auto-increment component number based on type
        const baseType = componentType.toLowerCase().replace(' ', '_');
        if (!state.componentCounts[baseType]) {
            state.componentCounts[baseType] = 1;
        } else {
            state.componentCounts[baseType]++;
        }

        const component = {
            x: x,
            y: y,
            type: componentType,
            strength: strength,
            id: Date.now() + Math.random(), // Unique ID
            number: state.componentCounts[baseType] // For display
        };
        
        // Add to cellboard in backend-compatible format
        if (!state.cellboard[componentType]) {
            state.cellboard[componentType] = [];
        }
        state.cellboard[componentType].push(component);
        
        // Update visual representation (no more separate parameter sections)
        updateCellDisplay(x, y, componentType, state.componentCounts[baseType]);
        
        console.log(`Placed ${componentType} #${state.componentCounts[baseType]} at (${x}, ${y})`);
        return component;
    }
// Remove component from position
function removeComponent(x, y) {
    console.log(`Attempting to remove component at (${x}, ${y})`);
    
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (!cell) {
        console.log(`Cell not found at (${x}, ${y})`);
        return null;
    }
    
    // Remove from connector system first
    removeComponentFromCell(cell);
    
    // Find and remove component from placedComponents array
    const index = state.placedComponents.findIndex(comp => comp.x === x && comp.y === y);
    let removed = null;
    
    if (index !== -1) {
        removed = state.placedComponents.splice(index, 1)[0];
        console.log(`Found component in placedComponents:`, removed);
    }
    
    // Also remove from cellboard if it exists there
    if (!removed) {
        for (const [type, components] of Object.entries(state.cellboard)) {
            const cellboardIndex = components.findIndex(comp => comp.x === x && comp.y === y);
            if (cellboardIndex !== -1) {
                removed = components.splice(cellboardIndex, 1)[0];
                console.log(`Found component in cellboard:`, removed);
                break;
            }
        }
    }
    
    if (removed) {
        // Clear visual representation
        cell.innerHTML = '';
        cell.classList.remove('filled');
        cell.classList.remove('has-component');
        console.log(`Cleared visual at (${x}, ${y})`);
        
        // Remove dynamic parameter section if it exists
        if (removed.number) {
            removeDynamicParameterSection(removed.type, removed.number);
        }
        
        console.log(`Successfully removed ${removed.type} from (${x}, ${y})`);
    } else {
        console.log(`No component found at (${x}, ${y})`);
    }
    
    return removed;
}

// Helper function to remove component from connector system
function removeComponentFromCell(cell) {
    // Find component object in connector system by cell reference
    if (typeof ConnectorManagerEEPROM !== 'undefined') {
        ConnectorManagerEEPROM.removeComponent(cell);
    }
}

// Helper function to register component with connector system
function registerComponentWithConnectorSystem(component, cell) {
    console.log(`Registering component with connector system: ${component.type} at (${component.x}, ${component.y})`);
    
    // Only register if ConnectorManagerEEPROM is available and component is a regulator
    if (typeof ConnectorManagerEEPROM === 'undefined') {
        console.log('ConnectorManagerEEPROM not available');
        return null;
    }
    
    if (!REGULATOR_TYPES.includes(component.type)) {
        console.log(`Component ${component.type} is not a regulator type`);
        return null;
    }
    
    // Initialize connector manager if needed
    if (!ConnectorManagerEEPROM.container) {
        const success = ConnectorManagerEEPROM.init();
        if (!success) {
            console.log('Failed to initialize ConnectorManagerEEPROM');
            return null;
        }
    }
    
    // Add component to connector system - this will create ports automatically
    const connectorComponent = ConnectorManagerEEPROM.addComponent(component, cell);
    console.log('Component registered with connector system:', connectorComponent);
    console.log('Ports created:', {
        inputPorts: connectorComponent.inputPorts.length,
        outputPorts: connectorComponent.outputPorts.length
    });
    
    return connectorComponent;
}
    
    // Remove dynamic parameter section
    function removeDynamicParameterSection(componentType, componentNumber) {
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const sectionId = `section_${baseType}_${componentNumber}`;
        const section = document.getElementById(sectionId);
        
        if (section) {
            section.remove();
            console.log(`Removed parameter section for ${componentType} ${componentNumber}`);
        }
    }

    // Update cell display
function updateCellDisplay(x, y, componentType, componentNumber, customName = null, componentData = null) {
    console.log(`updateCellDisplay called with: x=${x}, y=${y}, componentType=${componentType}, componentNumber=${componentNumber}`);
    
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (!cell) {
        console.error(`Cell not found at (${x}, ${y})`);
        return;
    }
    
    // Save existing ports before clearing
    const existingPorts = Array.from(cell.querySelectorAll('.component-port'));
    console.log(`Found ${existingPorts.length} existing ports to preserve`);
    
    // Clear previous content
    cell.innerHTML = '';
    cell.classList.add('filled');
    cell.classList.add('has-component');
    
    // Find the component in our data to get its custom name
    let component = componentData;
    if (!component) {
        component = state.placedComponents.find(comp => comp.x === x && comp.y === y);
        
        if (!component) {
            for (const [type, components] of Object.entries(state.cellboard)) {
                component = components.find(comp => comp.x === x && comp.y === y);
                if (component) break;
            }
        }
    }
    
    // Create component display
    const display = document.createElement('div');
    display.className = 'placed-component';
    display.dataset.componentId = component ? component.id : `${componentType}_${x}_${y}`;
    display.dataset.componentType = componentType;
    
    // Use custom name if available, otherwise show full component type
    const displayName = (component && component.customName) || componentType || 'Unknown Component';
    console.log(`Display name will be: ${displayName} (componentType: ${componentType})`);
    display.textContent = displayName;
    display.title = `${componentType} #${componentNumber} - Click to edit parameters`;
    
    // Add component-specific styling
    display.classList.add(`component-${componentType.toLowerCase().replace(' ', '-')}`);
    
    // Add click event for parameter editing (now includes regulators)
    display.addEventListener('click', function(e) {
        e.stopPropagation();
        showComponentParameterModal(x, y, componentType, componentNumber, component);
    });
    
    // Add visual indicator that component is clickable for parameters
    display.classList.add('has-parameters');
    display.title += ' (Click to edit parameters & rename)';
    
    cell.appendChild(display);
    
    // Restore existing ports
    existingPorts.forEach(port => {
        cell.appendChild(port);
        console.log(`Restored port: ${port.className}`);
    });
    
    // Ports will be created by registerComponentWithConnectorSystem
    // which is called separately after component placement
}

// Helper function to add ports to regulator components
function addPortsToCell(cell, componentType) {
    console.log(`Adding ports to cell for ${componentType}`);
    
    // Make sure cell has position relative for absolute positioning
    cell.style.position = 'relative';
    
    // Ports are now created by registerComponentWithConnectorSystem
    // This function is kept for backward compatibility but ports
    // are actually created in GeneticComponentEEPROM
    console.log('Ports will be created by ConnectorManagerEEPROM');
}
    function getComponentSymbol(type) {
        const symbols = {
            'Promoter': 'P',
            'RBS': 'R',
            'CDS': 'C',
            'Terminator': 'T',
            'Repressor Start': 'Rs',
            'Repressor End': 'Re',
            'Activator Start': 'As',
            'Activator End': 'Ae',
            'Inducer Start': 'Is',
            'Inducer End': 'Ie',
            'Inhibitor Start': 'Ins',
            'Inhibitor End': 'Ine'
        };
        return symbols[type] || type.charAt(0);
    }

    // Synchronize parameters between Start and End regulator pairs
    function syncRegulatorPair(componentType, componentNumber, paramId, value) {
        // Check if this is a regulator component
        const regulatorPairs = {
            'Repressor Start': 'Repressor End',
            'Repressor End': 'Repressor Start',
            'Activator Start': 'Activator End',
            'Activator End': 'Activator Start',
            'Inducer Start': 'Inducer End',
            'Inducer End': 'Inducer Start',
            'Inhibitor Start': 'Inhibitor End',
            'Inhibitor End': 'Inhibitor Start'
        };
        
        const pairType = regulatorPairs[componentType];
        if (!pairType) return; // Not a regulator component
        
        console.log(`[SYNC] Syncing ${componentType} #${componentNumber} parameter ${paramId} = ${value} to ${pairType}`);
        console.log(`[SYNC] Current cellboard:`, state.cellboard);
        console.log(`[SYNC] Current placedComponents:`, state.placedComponents);
        
        // Find all components of the pair type with the same number
        let foundAny = false;
        
        // Search in cellboard
        for (const [type, components] of Object.entries(state.cellboard)) {
            if (type === pairType) {
                components.forEach(comp => {
                    if (comp.number === componentNumber) {
                        // Update the parameter
                        if (!comp.parameters) comp.parameters = {};
                        comp.parameters[paramId] = value;
                        console.log(`[SYNC] ✓ Synced to ${pairType} at (${comp.x}, ${comp.y}), new params:`, comp.parameters);
                        foundAny = true;
                        
                        // Update UI input if modal is open for this component
                        const inputElement = document.getElementById(paramId);
                        if (inputElement && inputElement.name === paramId) {
                            inputElement.value = value;
                            console.log(`[SYNC] ✓ Updated UI input ${paramId} to ${value}`);
                        }
                    }
                });
            }
        }
        
        // Also search in placedComponents
        state.placedComponents.forEach(comp => {
            if (comp.type === pairType && comp.number === componentNumber) {
                if (!comp.parameters) comp.parameters = {};
                comp.parameters[paramId] = value;
                console.log(`[SYNC] ✓ Synced to ${pairType} #${componentNumber} in placedComponents at (${comp.x}, ${comp.y}), new params:`, comp.parameters);
                foundAny = true;
                
                // Update UI input if modal is open for this component
                const inputElement = document.getElementById(paramId);
                if (inputElement && inputElement.name === paramId) {
                    inputElement.value = value;
                    console.log(`[SYNC] ✓ Updated UI input ${paramId} to ${value}`);
                }
            }
        });
        
        if (!foundAny) {
            console.log(`[SYNC] ✗ No paired ${pairType} #${componentNumber} found yet`);
        }
    }

    // Show component parameter modal
    function showComponentParameterModal(x, y, componentType, componentNumber, component) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'parameter-modal-overlay';
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'parameter-modal';
        
        // Modal header
        const header = document.createElement('div');
        header.className = 'parameter-modal-header';
        
        const title = document.createElement('h3');
        title.textContent = `${component?.customName || componentType + ' #' + componentNumber} Parameters`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'parameter-modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Modal body with parameters
        const body = document.createElement('div');
        body.className = 'parameter-modal-body';
        
        // Add component name/rename field first
        const nameGroup = document.createElement('div');
        nameGroup.className = 'parameter-group name-group';
        
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Component Name:';
        nameLabel.setAttribute('for', 'component-name-input');
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'component-name-input';
        nameInput.placeholder = `${componentType} #${componentNumber}`;
        nameInput.value = component?.customName || '';
        
        // Add real-time name update
        nameInput.addEventListener('input', function() {
            if (component) {
                component.customName = this.value.trim() || null;
                // Update the modal title in real-time
                title.textContent = `${this.value.trim() || componentType + ' #' + componentNumber} Parameters`;
                console.log(`Renamed component to: ${this.value.trim()}`);
            }
        });
        
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        body.appendChild(nameGroup);
        
        // Add separator
        const separator = document.createElement('div');
        separator.className = 'parameter-separator';
        separator.innerHTML = '<hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">';
        body.appendChild(separator);
        
        // Get parameters for this component
        const parameters = getComponentParameters(componentType, componentNumber);
        
        parameters.forEach(param => {
            const paramGroup = document.createElement('div');
            paramGroup.className = 'parameter-group';
            
            const label = document.createElement('label');
            label.textContent = param.label;
            label.setAttribute('for', param.id);
            
            // Add range info to label
            const rangeInfo = document.createElement('small');
            rangeInfo.className = 'param-range-info';
            rangeInfo.textContent = ` (Range: ${param.min} - ${param.max})`;
            rangeInfo.style.color = '#9ca3af';
            rangeInfo.style.fontSize = '0.85em';
            rangeInfo.style.fontWeight = 'normal';
            label.appendChild(rangeInfo);
            
            const inputWrapper = document.createElement('div');
            inputWrapper.style.position = 'relative';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = param.id;
            input.name = param.id;
            input.min = param.min;
            input.max = param.max;
            input.step = param.step;
            
            // Load existing value if available, otherwise use default
            const existingValue = component?.parameters?.[param.id];
            const isUsingDefault = existingValue === undefined;
            input.value = existingValue !== undefined ? existingValue : param.defaultValue;
            
            // Build comprehensive tooltip
            let tooltipText = '';
            if (param.title) {
                tooltipText = param.title + '\n';
            }
            tooltipText += `Default: ${param.defaultValue}\nRange: ${param.min} to ${param.max}`;
            input.title = tooltipText;
            
            // Add visual indicator if using default value
            if (isUsingDefault) {
                const defaultBadge = document.createElement('span');
                defaultBadge.className = 'default-value-badge';
                defaultBadge.textContent = 'default';
                defaultBadge.style.cssText = `
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 0.7em;
                    color: #6ee7b7;
                    background: rgba(110, 231, 183, 0.15);
                    padding: 2px 6px;
                    border-radius: 3px;
                    pointer-events: none;
                    font-weight: 600;
                `;
                inputWrapper.appendChild(defaultBadge);
            }
            
            // Add real-time update
            input.addEventListener('input', function() {
                // Update component data
                if (component) {
                    if (!component.parameters) component.parameters = {};
                    component.parameters[param.id] = parseFloat(this.value);
                    
                    // Synchronize Start/End regulator pairs
                    syncRegulatorPair(componentType, componentNumber, param.id, parseFloat(this.value));
                }
                
                // Remove default badge when value is changed
                const badge = inputWrapper.querySelector('.default-value-badge');
                if (badge && parseFloat(this.value) !== param.defaultValue) {
                    badge.remove();
                }
                
                console.log(`Updated ${param.id} to ${this.value} for component at (${x}, ${y})`);
            });
            
            inputWrapper.appendChild(input);
            paramGroup.appendChild(label);
            paramGroup.appendChild(inputWrapper);
            body.appendChild(paramGroup);
        });
        
        // Modal footer
        const footer = document.createElement('div');
        footer.className = 'parameter-modal-footer';
        
    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-primary';
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => {
        // Parameters and name are already updated in real-time
        // Update the visual display to reflect any name changes
        // Ports are now preserved automatically in updateCellDisplay
        updateCellDisplay(x, y, componentType, componentNumber, component?.customName, component);
        overlay.remove();
        console.log(`Applied parameters and name for ${componentType} at (${x}, ${y})`);
    };        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => overlay.remove();
        
        footer.appendChild(cancelBtn);
        footer.appendChild(applyBtn);
        
        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        
        // Add to page
        document.body.appendChild(overlay);
        
        // Close on overlay click
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    function clearComponentSelection() {
        // Remove selected class from all components
        document.querySelectorAll('.component.selected').forEach(comp => {
            comp.classList.remove('selected');
        });
        
        // Hide placement mode
        hidePlacementMode();
    }

    function showPlacementMode() {
        // Add placement mode class to board
        const board = document.querySelector('.cell-board');
        if (board) {
            board.classList.add('placement-mode');
        }
        
        // Add hover effects to empty cells
        cells.forEach(cell => {
            if (!cell.classList.contains('filled')) {
                cell.classList.add('placement-ready');
            }
        });
    }

    function hidePlacementMode() {
        // Remove placement mode class from board
        const board = document.querySelector('.cell-board');
        if (board) {
            board.classList.remove('placement-mode');
        }
        
        // Remove hover effects from cells
        cells.forEach(cell => {
            cell.classList.remove('placement-ready');
        });
    }

    function showSelectionHint() {
        // Show a brief hint that user needs to select a component first
        const hint = document.createElement('div');
        hint.className = 'selection-hint';
        hint.textContent = 'Select a component first!';
        hint.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(231, 76, 60, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-weight: bold;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        // Remove hint after animation
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    function updateSelectionStatus() {
        const statusElement = document.getElementById('selection-status');
        if (!statusElement) return;
        
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        if (state.currentComponent) {
            icon.className = 'fas fa-check-circle';
            text.textContent = `Selected: ${state.currentComponent}`;
            statusElement.className = 'selection-status selected';
        } else {
            icon.className = 'fas fa-mouse-pointer';
            text.textContent = 'Click a component to select';
            statusElement.className = 'selection-status';
        }
    }

    function setupDragModeToggle() {
        const toggle = document.getElementById('drag-mode-toggle');
        if (!toggle) return;
        
        toggle.addEventListener('change', function() {
            const isDragEnabled = this.checked;
            
            // Toggle draggable attribute on all components
            components.forEach(comp => {
                comp.draggable = isDragEnabled;
                if (isDragEnabled) {
                    comp.style.cursor = 'grab';
                } else {
                    comp.style.cursor = 'pointer';
                }
            });
            
            console.log(`Drag mode ${isDragEnabled ? 'enabled' : 'disabled'}`);
        });
    }

    function showRenameDialog(x, y, componentType, componentNumber, currentName) {
        // Find the component in our data
        let component = null;
        for (const [type, components] of Object.entries(state.cellboard)) {
            component = components.find(comp => comp.x === x && comp.y === y);
            if (component) break;
        }
        
        if (!component) return;
        
        // Create a simple prompt dialog
        const newName = prompt(`Enter new name for ${componentType} #${componentNumber}:`, 
                              component.customName || `${componentType} ${componentNumber}`);
        
        if (newName && newName.trim() !== '') {
            renameComponent(x, y, newName.trim());
        }
    }

    function renameComponent(x, y, newName) {
        // Find the component in our data
        let component = null;
        let componentType = null;
        for (const [type, components] of Object.entries(state.cellboard)) {
            component = components.find(comp => comp.x === x && comp.y === y);
            if (component) {
                componentType = type;
                break;
            }
        }
        
        if (!component) return;
        
        // Update the component's custom name
        component.customName = newName;
        
        // Update the visual display
        updateCellDisplay(x, y, componentType, component.number);
        
        // Update the parameter section title
        updateParameterSectionTitle(componentType, component.number, newName);
        
        console.log(`Renamed component at (${x}, ${y}) to "${newName}"`);
    }

    function updateParameterSectionTitle(componentType, componentNumber, customName) {
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const sectionId = `section_${baseType}_${componentNumber}`;
        const section = document.getElementById(sectionId);
        
        if (section) {
            const summary = section.querySelector('.dial-accordion-header');
            if (summary) {
                summary.textContent = `${customName} Parameters`;
            }
        }
    }

    // Drag and drop functionality
    function setupDragAndDrop() {
        // Setup dragging from component palette
        components.forEach(component => {
            component.addEventListener('dragstart', function(e) {
                state.isDragging = true;
                state.draggedElement = this;
                const componentType = this.dataset.component;
                
                e.dataTransfer.setData('text/plain', componentType);
                e.dataTransfer.effectAllowed = 'copy';
                
                // Visual feedback
                this.style.opacity = '0.5';
            });
            
            component.addEventListener('dragend', function(e) {
                state.isDragging = false;
                state.draggedElement = null;
                this.style.opacity = '1';
            });
        });
        
        // Setup drop targets (cells)
        cells.forEach(cell => {
            cell.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                
                // Visual feedback
                this.classList.add('drop-target');
            });
            
            cell.addEventListener('dragleave', function(e) {
                this.classList.remove('drop-target');
            });
            
            cell.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drop-target');
                
                const componentType = e.dataTransfer.getData('text/plain');
                const x = parseInt(this.dataset.x);
                const y = parseInt(this.dataset.y);
                
                // Check if cell is already occupied
                if (this.classList.contains('filled')) {
                    removeComponent(x, y);
                }
                
                // Place the component
                placeComponent(x, y, componentType, state.currentStrength);
            });
        });
    }

    // Button setup
    function setupButtons() {
        if (simulateBtn) {
            simulateBtn.addEventListener('click', runSimulation);
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', clearBoard);
        }
    }

    // Simulation functions
    async function runSimulation() {
        try {
            // Show loading state
            const originalText = simulateBtn.textContent;
            simulateBtn.textContent = 'Simulating...';
            simulateBtn.disabled = true;
            
            // Check if dial parameters should be applied
            const enableToggle = document.getElementById('enable_dial_params');
            const applyDial = enableToggle ? enableToggle.checked : false;
            console.log('Apply dial parameters:', applyDial);
            
            // Collect dial parameters
            let dialData = collectDialParameters();
            
            // If toggle is OFF, override with default values (1.0 for all global parameters)
            if (!applyDial) {
                console.log('⚠️ TOGGLE IS OFF - Using default values (1.0) for ALL global parameters');
                console.log('   This will reset any custom values you entered to have no effect');
                dialData = {
                    global_transcription_rate: 1.0,
                    global_translation_rate: 1.0,
                    global_degradation_rate: 1.0,
                    temperature_factor: 1.0,
                    resource_availability: 1.0
                };
                console.log('[COLLECT] Default dialData (all 1.0):', dialData);
                console.log('✓ Sending to backend: apply_dial=false, all global params=1.0');
            }
            
            // Prepare simulation data
            const simulationData = {
                cellboard: state.cellboard,
                dial: dialData,
                apply_dial: applyDial
            };
            
            console.log('Sending simulation data:', simulationData);
            
            // Send to backend
            const response = await fetch('/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(simulationData)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                displaySimulationResults(result);
            } else {
                throw new Error(result.message || 'Simulation failed');
            }
            
        } catch (error) {
            console.error('Simulation error:', error);
            displayError('Simulation failed: ' + error.message);
        } finally {
            // Restore button state
            simulateBtn.textContent = 'Run Enhanced Simulation';
            simulateBtn.disabled = false;
        }
    }

    function collectDialParameters() {
        const dialData = {};
        
        // Collect all dial inputs from the accordion form (global parameters)
        const dialInputs = document.querySelectorAll('#dial-form input[type="number"]');
        console.log(`[COLLECT] Found ${dialInputs.length} dial parameter inputs`);
        
        dialInputs.forEach(input => {
            const key = input.name || input.id;
            const value = parseFloat(input.value);
            if (!isNaN(value) && key) {
                dialData[key] = value;
                console.log(`  [COLLECT] Global - ${key}: ${value}`);
            }
        });
        
        // Collect component-specific parameters from placed components
        let componentParams = 0;
        console.log(`[COLLECT] Scanning cellboard for component parameters...`);
        console.log(`[COLLECT] Cellboard keys:`, Object.keys(state.cellboard));
        
        Object.entries(state.cellboard).forEach(([type, componentArray]) => {
            console.log(`[COLLECT] Type "${type}" has ${componentArray.length} components`);
            componentArray.forEach((component, idx) => {
                console.log(`[COLLECT]   Component ${idx}:`, component);
                if (component.parameters) {
                    console.log(`[COLLECT]   Has parameters:`, component.parameters);
                    // Merge component-specific parameters into dialData
                    Object.entries(component.parameters).forEach(([paramId, paramValue]) => {
                        dialData[paramId] = paramValue;
                        componentParams++;
                        console.log(`[COLLECT]     Added ${paramId} = ${paramValue}`);
                    });
                } else {
                    console.log(`[COLLECT]   No parameters object found`);
                }
            });
        });
        
        console.log(`[COLLECT] Collected dial parameters: ${Object.keys(dialData).length} total (${dialInputs.length} global + ${componentParams} component-specific)`);
        console.log(`[COLLECT] Final dialData:`, dialData);
        return dialData;
    }

    function displaySimulationResults(result) {
        if (!plotContainer) return;
        
        // DEBUG: Log the full result to see what we're getting
        console.log('=== SIMULATION RESULT ===');
        console.log('Full result:', result);
        console.log('Circuits:', result.circuits);
        console.log('Equations:', result.equations);
        console.log('Regulations:', result.regulations);
        
        // Clear previous results
        plotContainer.innerHTML = '';
        
        // Create results container
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'simulation-results';
        
        // Add plot if available
        if (result.plot) {
            const plotImg = document.createElement('img');
            plotImg.src = `data:image/png;base64,${result.plot}`;
            plotImg.className = 'simulation-plot';
            plotImg.alt = 'Simulation Results';
            plotImg.style.maxWidth = '100%';
            plotImg.style.height = 'auto';
            plotImg.style.borderRadius = '8px';
            plotImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            resultsDiv.appendChild(plotImg);
        }
        
        // Add circuit information
        if (result.circuits && result.circuits.length > 0) {
            const circuitInfo = document.createElement('div');
            circuitInfo.className = 'circuit-info';
            
            // Calculate circuit health summary
            let completeCircuits = 0;
            let totalIssues = 0;
            
            result.circuits.forEach(circuit => {
                const counts = circuit.component_counts || {};
                let hasIssues = false;
                
                if (!counts.promoter || !counts.rbs || !counts.cds) {
                    hasIssues = true;
                    totalIssues++;
                }
                if (!hasIssues) completeCircuits++;
            });
            
            let circuitDetailsHTML = `
                <h3>Circuit Analysis</h3>
                <p><em>The system automatically groups your placed components into functional genetic circuits. Each circuit represents a complete gene expression unit.</em></p>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Circuits Detected:</strong> ${result.circuits.length}
                    </div>
                    <div class="info-item">
                        <strong>Complete Circuits:</strong> ${completeCircuits}/${result.circuits.length}
                    </div>
                    <div class="info-item">
                        <strong>Components Analyzed:</strong> ${result.components_analyzed || 0}
                    </div>
                    <div class="info-item">
                        <strong>Regulations:</strong> ${result.regulations ? result.regulations.length : 0}
                    </div>
                </div>
            `;
            
            // Add detailed circuit breakdown
            circuitDetailsHTML += '<div class="circuit-details">';
            result.circuits.forEach((circuit, index) => {
                circuitDetailsHTML += `
                    <div class="circuit-detail-item">
                        <h4>Circuit ${index + 1}: ${circuit.name}</h4>
                        <div class="component-breakdown">
                            <strong>Components:</strong>
                            <ul>
                `;
                
                if (circuit.components) {
                    circuit.components.forEach(comp => {
                        // Extract position info if available
                        let positionInfo = '';
                        if (comp.channel !== undefined) {
                            const x = comp.channel % 8;
                            const y = Math.floor(comp.channel / 8);
                            positionInfo = ` at position (${x}, ${y})`;
                        } else if (comp.label && comp.label.includes('_A')) {
                            // Extract position from label like "promoter_A9"
                            const match = comp.label.match(/_A(\d+)/);
                            if (match) {
                                const channel = parseInt(match[1]);
                                const x = channel % 8;
                                const y = Math.floor(channel / 8);
                                positionInfo = ` at position (${x}, ${y})`;
                            }
                        }
                        
                        // Show user-friendly name
                        const displayName = comp.custom_name || comp.name || `${comp.type} #${circuit.components.filter(c => c.type === comp.type).indexOf(comp) + 1}`;
                        circuitDetailsHTML += `<li>${displayName}${positionInfo}</li>`;
                    });
                } else {
                    circuitDetailsHTML += '<li>No components found</li>';
                }
                
                circuitDetailsHTML += '</ul>';
                
                // Show component counts and missing components analysis
                if (circuit.component_counts) {
                    circuitDetailsHTML += '<div class="counts"><strong>Counts:</strong> ';
                    Object.entries(circuit.component_counts).forEach(([type, count]) => {
                        circuitDetailsHTML += `${type}: ${count}, `;
                    });
                    circuitDetailsHTML = circuitDetailsHTML.slice(0, -2) + '</div>';
                    
                    // Analyze missing components
                    const missingComponents = [];
                    const warnings = [];
                    
                    if (!circuit.component_counts.promoter || circuit.component_counts.promoter === 0) {
                        missingComponents.push('Promoter - needed to initiate transcription');
                    }
                    if (!circuit.component_counts.rbs || circuit.component_counts.rbs === 0) {
                        missingComponents.push('RBS - needed for translation initiation');
                    }
                    if (!circuit.component_counts.cds || circuit.component_counts.cds === 0) {
                        missingComponents.push('CDS - needed to define the protein product');
                    }
                    if (!circuit.component_counts.terminator || circuit.component_counts.terminator === 0) {
                        warnings.push('Terminator - recommended to prevent transcriptional read-through');
                    }
                    
                    // Check for imbalanced components
                    if (circuit.component_counts.cds && circuit.component_counts.rbs) {
                        if (circuit.component_counts.rbs < circuit.component_counts.cds) {
                            warnings.push(`Need more RBS elements: ${circuit.component_counts.rbs} RBS for ${circuit.component_counts.cds} CDS`);
                        }
                    }
                    
                    if (missingComponents.length > 0) {
                        circuitDetailsHTML += '<div class="missing-components"><strong>Missing Critical Components:</strong><ul>';
                        missingComponents.forEach(missing => {
                            circuitDetailsHTML += `<li>${missing}</li>`;
                        });
                        circuitDetailsHTML += '</ul></div>';
                    }
                    
                    if (warnings.length > 0) {
                        circuitDetailsHTML += '<div class="component-warnings"><strong>Recommendations:</strong><ul>';
                        warnings.forEach(warning => {
                            circuitDetailsHTML += `<li>${warning}</li>`;
                        });
                        circuitDetailsHTML += '</ul></div>';
                    }
                    
                    // Show circuit completeness status
                    if (missingComponents.length === 0) {
                        circuitDetailsHTML += '<div class="circuit-status complete">Circuit is functionally complete</div>';
                    } else {
                        circuitDetailsHTML += '<div class="circuit-status incomplete">Circuit is incomplete - missing critical components</div>';
                    }
                }
                
                circuitDetailsHTML += '</div></div>';
            });
            circuitDetailsHTML += '</div>';
            
            circuitInfo.innerHTML = circuitDetailsHTML;
            resultsDiv.appendChild(circuitInfo);
        }

        // Add Global Parameter Effects (if applied)
        if (result.global_parameters_applied && result.global_parameters) {
            const globalParamsInfo = document.createElement('div');
            globalParamsInfo.className = 'global-params-info';
            
            let globalHTML = '<h3>Global Parameter Effects</h3>';
            globalHTML += `<div class="global-status active">Global Parameters ACTIVE</div>`;
            globalHTML += '<div class="global-params-grid">';
            
            const paramDescriptions = {
                'global_transcription_rate': {
                    name: 'Transcription Rate',
                    affects: 'All promoter strengths',
                    calculation: 'Multiplies promoter strength in: kprod = promoter_strength × RBS_efficiency',
                    color: '#4ECDC4'
                },
                'global_translation_rate': {
                    name: 'Translation Rate',
                    affects: 'All RBS efficiency & CDS translation rates',
                    calculation: 'Multiplies RBS efficiency and CDS translation rates in protein production',
                    color: '#95E1D3'
                },
                'global_degradation_rate': {
                    name: 'Degradation Rate',
                    affects: 'All protein degradation rates',
                    calculation: 'Multiplies degradation term in: dpdt = production - degradation_rate × [protein]',
                    color: '#FFD166'
                },
                'temperature_factor': {
                    name: 'Temperature',
                    affects: 'All enzymatic reaction rates',
                    calculation: 'Multiplies promoter strength and CDS translation rates (simulates temperature effects)',
                    color: '#FF6B6B'
                },
                'resource_availability': {
                    name: 'Resources',
                    affects: 'Transcription & translation capacity',
                    calculation: 'Multiplies promoter strength and RBS efficiency (simulates resource limitations)',
                    color: '#F8B739'
                }
            };
            
            Object.entries(result.global_parameters).forEach(([key, value]) => {
                const info = paramDescriptions[key];
                if (info && !key.includes('_strength') && !key.includes('_efficiency') && !key.includes('_rate') && !key.includes('_concentration')) {
                    const multiplier = parseFloat(value);
                    let effect = 'No change';
                    let effectColor = '#999';
                    
                    if (multiplier > 1) {
                        effect = `+${((multiplier - 1) * 100).toFixed(0)}% increase`;
                        effectColor = '#2ECC71';
                    } else if (multiplier < 1) {
                        effect = `${((1 - multiplier) * 100).toFixed(0)}% decrease`;
                        effectColor = '#E74C3C';
                    }
                    
                    globalHTML += `
                        <div class="global-param-card" style="border-left: 4px solid ${info.color};">
                            <div class="param-header">
                                <strong>${info.name}</strong>
                            </div>
                            <div class="param-value">Multiplier: <strong>${multiplier.toFixed(2)}x</strong></div>
                            <div class="param-effect" style="color: ${effectColor};">${effect}</div>
                            <div class="param-affects"><small><strong>Affects:</strong> ${info.affects}</small></div>
                            <div class="param-affects" style="margin-top: 5px; opacity: 0.7;"><small><strong>Calculation:</strong> ${info.calculation}</small></div>
                        </div>
                    `;
                }
            });
            
            globalHTML += '</div>';
            globalParamsInfo.innerHTML = globalHTML;
            resultsDiv.appendChild(globalParamsInfo);
        }

        // Add regulation information  
        if (result.regulations && result.regulations.length > 0) {
            const regulationInfo = document.createElement('div');
            regulationInfo.className = 'regulation-info';
            
            let regulationHTML = `
                <h3>Regulatory Network</h3>
                <p><em>Shows how proteins regulate each other's production. "Constitutive" means constant production without regulation.</em></p>
                <div class="regulation-list">
            `;
            
            result.regulations.forEach((regulation, index) => {
                // Better display for constitutive regulations
                const source = regulation.source || 'Constitutive';
                const target = regulation.target || 'Unknown';
                const type = regulation.type || 'constitutive';
                
                let explanation = '';
                if (type === 'constitutive' || source === 'Unknown' || source === 'Constitutive') {
                    explanation = 'This promoter produces protein at a constant rate (not regulated by other proteins)';
                } else {
                    explanation = `${source} protein regulates ${target} transcription`;
                }
                
                regulationHTML += `
                    <div class="regulation-item">
                        <strong>Regulation ${index + 1}:</strong> 
                        ${source} → ${target}
                        <br><small>Type: ${type}, Strength: Kr=${regulation.Kr || 'N/A'}, n=${regulation.n || 'N/A'}</small>
                        <br><em>${explanation}</em>
                    </div>
                `;
            });
            
            regulationHTML += '</div>';
            regulationInfo.innerHTML = regulationHTML;
            resultsDiv.appendChild(regulationInfo);
        }

        // Add unpaired regulators information
        if (result.unpaired_regulators && result.unpaired_regulators.length > 0) {
            const unpairedInfo = document.createElement('div');
            unpairedInfo.className = 'unpaired-info';
            
            let unpairedHTML = `
                <h4>Unpaired Regulators</h4>
                <div class="unpaired-list">
            `;
            
            result.unpaired_regulators.forEach(regulator => {
                unpairedHTML += `
                    <div class="unpaired-item">
                        ${regulator.label || regulator.id || 'Unknown regulator'} 
                        <small>(${regulator.type || 'Unknown type'})</small>
                    </div>
                `;
            });
            
            unpairedHTML += '</div>';
            unpairedInfo.innerHTML = unpairedHTML;
            resultsDiv.appendChild(unpairedInfo);
        }

        // Add warnings if any
        if (result.warnings && result.warnings.length > 0) {
            const warningsDiv = document.createElement('div');
            warningsDiv.className = 'warnings-container';
            warningsDiv.innerHTML = '<h4>Warnings</h4>';
            
            result.warnings.forEach(warning => {
                const warningItem = document.createElement('div');
                warningItem.className = 'warning-item';
                warningItem.textContent = warning;
                warningsDiv.appendChild(warningItem);
            });
            
            resultsDiv.appendChild(warningsDiv);
        }

        // Add equations if available
        if (result.equations) {
            const equationsDiv = document.createElement('div');
            equationsDiv.className = 'equations-container';
            equationsDiv.innerHTML = '<h3>Circuit Equations</h3>';
            
            Object.entries(result.equations).forEach(([protein, eq]) => {
                const eqDiv = document.createElement('div');
                eqDiv.className = 'equation-item';
                
                // Format equation properly for MathJax
                const equationText = eq.latex || eq;
                const formattedEquation = equationText.includes('\\') ? `$$${equationText}$$` : `$$${equationText}$$`;
                
                eqDiv.innerHTML = `
                    <h4>${protein}</h4>
                    <div class="equation-latex">${formattedEquation}</div>
                    <p class="equation-description">${eq.description || 'Constitutive protein production with degradation'}</p>
                `;
                equationsDiv.appendChild(eqDiv);
            });
            
            resultsDiv.appendChild(equationsDiv);
        }
        
        plotContainer.appendChild(resultsDiv);
        
        // Render LaTeX equations if MathJax is available
        if (window.MathJax) {
            MathJax.typesetPromise([plotContainer]).catch(err => {
                console.error('MathJax error:', err);
            });
        }
    }

    function displayError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = 'block';
            setTimeout(() => {
                errorDisplay.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

   function clearBoard() {
        // Clear all placed components
        for (const type in state.cellboard) {
            state.cellboard[type] = [];
        }
        
        // Reset component counts
        state.componentCounts = {};
        
        // Clear placed components array
        state.placedComponents = [];
        
        // Remove all dynamic parameter sections
        clearAllDynamicParameterSections();
        
        // Clear connector system if available
        if (typeof ConnectorManagerEEPROM !== 'undefined') {
            ConnectorManagerEEPROM.clearAll();
            console.log('Connector system cleared');
        }
        
        // Clear visual representation
        cells.forEach(cell => {
            cell.innerHTML = '';
            cell.classList.remove('filled');
            cell.classList.remove('has-component');
        });
        
        // Clear results
        if (plotContainer) {
            plotContainer.innerHTML = `
                <div class="loading">
                    <i class="fas fa-dna" style="color: var(--primary); font-size: 2rem;"></i>
                    <p>Design your circuit and run enhanced simulation</p>
                </div>
            `;
        }
        
        console.log('Board cleared');
    }
    
    // Clear all dynamic parameter sections
    function clearAllDynamicParameterSections() {
        const dialAccordion = document.querySelector('.dial-accordion');
        if (!dialAccordion) return;
        
        // Remove all sections that have an ID starting with 'section_'
        const dynamicSections = dialAccordion.querySelectorAll('[id^="section_"]');
        dynamicSections.forEach(section => {
            section.remove();
        });
        
        console.log('Cleared all dynamic parameter sections');
    }

    function getStrengthColor(strength) {
        const colors = {
            'weak': '#fca5a5',
            'norm': '#fcd34d', 
            'strong': '#86efac'
        };
        return colors[strength] || colors['norm'];
    }

    // Hide all strength menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.component')) {
            document.querySelectorAll('.strength-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });

   // Export functions for external use
    window.CircuitDesigner = {
        state,
        placeComponent,
        removeComponent,
        runSimulation,
        clearBoard
    };
    
    // Initialize connector system for regulators
    function initializeConnectorSystem() {
        // Check if connector system classes are available (from eeprom.js)
        if (typeof ConnectorManagerEEPROM === 'undefined') {
            console.log('Connector system not available - skipping initialization');
            return;
        }
        
        console.log('Initializing connector system for regulators...');
        const success = ConnectorManagerEEPROM.init();
        if (success) {
            console.log('Connector system initialized successfully');
        } else {
            console.log('Failed to initialize connector system');
        }
    }
});

// Hamburger Menu Functionality
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerToggle = document.querySelector('.hamburger-toggle');
    const parametersPanel = document.querySelector('.parameters-panel');
    const closeBtn = document.querySelector('.close-panel');
    const overlay = document.querySelector('.hamburger-menu');
    
    if (hamburgerToggle && parametersPanel) {
        // Toggle panel visibility
        function togglePanel() {
            parametersPanel.classList.toggle('open');
            hamburgerToggle.classList.toggle('active');
            document.body.style.overflow = parametersPanel.classList.contains('open') ? 'hidden' : '';
        }
        
        // Open panel
        hamburgerToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
        });
        
        // Close panel
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel();
            });
        }
        
        // Close on overlay click
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    togglePanel();
                }
            });
        }
        
        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && parametersPanel.classList.contains('open')) {
                togglePanel();
            }
        });
        
        // Prevent panel close when clicking inside parameters content
        parametersPanel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
});// ===== GLOBAL MODE FUNCTIONALITY =====
/**
 * Initialize global mode toggle and event listeners
 * This allows global parameters to automatically update all component parameters
 */
function initGlobalMode() {
    const globalModeToggle = document.getElementById('global_mode_enabled');
    const globalTranscription = document.getElementById('global_transcription_rate');
    const globalTranslation = document.getElementById('global_translation_rate');
    const globalDegradation = document.getElementById('global_degradation_rate');
    
    if (!globalModeToggle) {
        console.warn('Global mode toggle not found - feature disabled');
        return;
    }
    
    // Listen to global mode toggle changes
    globalModeToggle.addEventListener('change', function() {
        if (this.checked) {
            console.log('Global mode ENABLED - applying global parameters to all components');
            applyGlobalParametersToComponents();
        } else {
            console.log('Global mode DISABLED - resetting components to default values');
            resetComponentsToDefaults();
        }
    });
    
    // Listen to global parameter changes
    if (globalTranscription) {
        globalTranscription.addEventListener('input', function() {
            if (globalModeToggle.checked) {
                updateComponentsByType('transcription', parseFloat(this.value));
            }
        });
    }
    
    if (globalTranslation) {
        globalTranslation.addEventListener('input', function() {
            if (globalModeToggle.checked) {
                updateComponentsByType('translation', parseFloat(this.value));
            }
        });
    }
    
    if (globalDegradation) {
        globalDegradation.addEventListener('input', function() {
            if (globalModeToggle.checked) {
                updateComponentsByType('degradation', parseFloat(this.value));
            }
        });
    }
    
    console.log('Global mode initialized successfully');
}

/**
 * Apply current global parameters to all matching component parameters
 */
function applyGlobalParametersToComponents() {
    const globalTranscription = parseFloat(document.getElementById('global_transcription_rate')?.value || 1.0);
    const globalTranslation = parseFloat(document.getElementById('global_translation_rate')?.value || 1.0);
    const globalDegradation = parseFloat(document.getElementById('global_degradation_rate')?.value || 1.0);
    
    updateComponentsByType('transcription', globalTranscription);
    updateComponentsByType('translation', globalTranslation);
    updateComponentsByType('degradation', globalDegradation);
}

/**
 * Update all component parameters of a specific type with a global multiplier
 * @param {string} paramType - 'transcription', 'translation', or 'degradation'
 * @param {number} globalValue - The global multiplier value
 */
function updateComponentsByType(paramType, globalValue) {
    const inputs = document.querySelectorAll(`#dial-form input[data-param-type="${paramType}"]`);
    
    inputs.forEach(input => {
        const defaultValue = parseFloat(input.getAttribute('data-default-value') || 1.0);
        const newValue = defaultValue * globalValue;
        
        // Round to appropriate step value
        const step = parseFloat(input.step) || 0.1;
        const rounded = Math.round(newValue / step) * step;
        
        input.value = rounded.toFixed(2);
        
        console.log(`Updated ${input.id}: ${defaultValue} × ${globalValue} = ${rounded.toFixed(2)}`);
    });
}

/**
 * Reset all component parameters to their default values from constants.py
 */
function resetComponentsToDefaults() {
    const inputs = document.querySelectorAll('#dial-form input[data-default-value]');
    
    inputs.forEach(input => {
        const defaultValue = input.getAttribute('data-default-value');
        if (defaultValue) {
            input.value = defaultValue;
            console.log(`Reset ${input.id} to default: ${defaultValue}`);
        }
    });
}

// Initialize global mode when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Delay initialization to ensure all elements are created
    setTimeout(() => {
        initGlobalMode();
    }, 500);
});

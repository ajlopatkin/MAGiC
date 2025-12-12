// static/js/eeprom.js
// EEPROM Hardware Integration for Genetic Circuit Designer

// ===== COMPONENT SELECTION CONSTANTS =====
const REGULATOR_TYPES = ['Repressor Start', 'Repressor End', 'Activator Start', 'Activator End', 
                        'Inducer Start', 'Inducer End', 'Inhibitor Start', 'Inhibitor End'];

// ===== APPLICATION STATE =====
const state = {
    currentComponent: null,
    currentGene: '1', // Default to Gene 1
    currentStrength: 'norm',
    placedComponents: [],
    componentCounts: {}, // For auto-numbering: promoter_1, promoter_2, etc.
    isDragging: false,
    draggedElement: null,
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

// ===== DOM INITIALIZATION =====
// Single DOMContentLoaded handler to prevent conflicts
let isInitialized = false;

// Global state for parameter defaults
const boardState = {
    parameterDefaults: null,
    parameterRanges: null
};

// Fetch parameter defaults from backend
async function loadParameterDefaults() {
    try {
        const response = await fetch('/api/parameter_defaults');
        const data = await response.json();
        boardState.parameterDefaults = data.defaults;
        boardState.parameterRanges = data.ranges;
        console.log('✓ [Board Mode] Loaded parameter defaults from constants.py:', data);
    } catch (error) {
        console.error('[Board Mode] Failed to load parameter defaults:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('Initializing EEPROM board mode...');
    loadParameterDefaults();  // Load defaults from API
    initHamburgerMenu();
    initComponentSystem();
});

function initHamburgerMenu() {
    const hamburgerToggle = document.getElementById('hamburger-toggle');
    const parametersPanel = document.getElementById('parameters-panel');
    const closePanel = document.getElementById('close-panel');
    
    if (!hamburgerToggle || !parametersPanel) {
        console.warn('Hamburger menu elements not found');
        return;
    }
    
    // Create backdrop element
    const backdrop = document.createElement('div');
    backdrop.className = 'panel-backdrop';
    document.body.appendChild(backdrop);
    
    // Simplified hamburger toggle functionality
    function togglePanel(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        
        const isOpen = parametersPanel.classList.contains('open');
        
        if (isOpen) {
            closeParametersPanel();
        } else {
            openParametersPanel();
        }
    }
    
    function openParametersPanel() {
        parametersPanel.classList.add('open');
        hamburgerToggle.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeParametersPanel() {
        parametersPanel.classList.remove('open');
        hamburgerToggle.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Event listeners
    hamburgerToggle?.addEventListener('click', togglePanel);
    closePanel?.addEventListener('click', closeParametersPanel);
    backdrop.addEventListener('click', closeParametersPanel);
    
    // Close panel on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && parametersPanel.classList.contains('open')) {
            closeParametersPanel();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024 && parametersPanel.classList.contains('open')) {
            // Auto-close on larger screens if needed
            // closeParametersPanel();
        }
    });
}

// ===== COMPONENT SELECTION SYSTEM =====
function initComponentSystem() {
    console.log('=== INITIALIZING COMPONENT SYSTEM ===');
    const components = document.querySelectorAll('.component');
    const cells = document.querySelectorAll('.cell');
    
    console.log(`Found ${components.length} components and ${cells.length} cells`);
    
    if (components.length === 0) {
        console.warn('No components found - retrying in 500ms');
        setTimeout(initComponentSystem, 500);
        return;
    }
    
    if (cells.length === 0) {
        console.warn('No cells found - retrying in 500ms');
        setTimeout(initComponentSystem, 500);
        return;
    }
    
    setupComponents();
    setupCells();
    setupGlobalClicks();
    updateSelectionStatus();
    
    // Ensure buttons are set up after component system is ready
    setTimeout(() => {
        setupButtons();
    }, 200);
    
    console.log('Component selection system initialized successfully');
}

// Button setup function
function setupButtons() {
    console.log('=== SETTING UP BUTTONS ===');
    
    // Run Enhanced Simulation button
    const simulateBtn = document.getElementById('simulate-btn');
    if (simulateBtn) {
        // Remove existing listeners to prevent duplicates
        simulateBtn.replaceWith(simulateBtn.cloneNode(true));
        const newSimulateBtn = document.getElementById('simulate-btn');
        
        newSimulateBtn.addEventListener('click', function(e) {
            console.log('Run Enhanced Simulation button clicked');
            runSimulation();
        });
        console.log('✓ Run Enhanced Simulation button setup complete');
    } else {
        console.warn('✗ simulate-btn not found');
    }
    
    // Clear Board button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        // Remove existing listeners to prevent duplicates
        clearBtn.replaceWith(clearBtn.cloneNode(true));
        const newClearBtn = document.getElementById('clear-btn');
        
        newClearBtn.addEventListener('click', function(e) {
            console.log('Clear Board button clicked');
            clearBoard();
        });
        console.log('✓ Clear Board button setup complete');
    } else {
        console.warn('✗ clear-btn not found');
    }
    
    console.log('Button setup completed');
}

// Main run simulation function for the Run Enhanced Simulation button
async function runSimulation() {
    console.log('=== RUN SIMULATION CALLED ===');
    
    const simulateBtn = document.getElementById('simulate-btn');
    if (!simulateBtn) {
        console.error('Simulate button not found!');
        return;
    }
    
    // Check if there are components on the board
    const placedComponents = document.querySelectorAll('.placed-component');
    if (placedComponents.length === 0) {
        alert('Please place some components on the board first!');
        return;
    }
    
    // Use the existing simulation function
    await runSimulationFromPlacedComponents();
}

// Clear board function
function clearBoard() {
    console.log('=== CLEAR BOARD CALLED ===');
    
    if (confirm('Are you sure you want to clear the design board? This will remove all placed components.')) {
        // Clear all placed components from the visual board
        const placedComponents = document.querySelectorAll('.placed-component');
        placedComponents.forEach(component => {
            component.remove();
        });
        
        // Clear filled state from cells
        const cells = document.querySelectorAll('.cell.filled');
        cells.forEach(cell => {
            cell.classList.remove('filled');
        });
        
        // Reset state
        state.placedComponents = [];
        Object.keys(state.cellboard).forEach(key => {
            state.cellboard[key] = [];
        });
        
        // Clear any selection
        clearComponentSelection();
        
        // Clear results
        const plotContainer = document.getElementById('plot-container');
        if (plotContainer) {
            plotContainer.innerHTML = '<p class="text-center text-muted">Place components and run simulation to see results</p>';
        }
        
        // Clear errors
        const errorDisplay = document.getElementById('error-display');
        if (errorDisplay) {
            errorDisplay.style.display = 'none';
            errorDisplay.textContent = '';
        }
        
        console.log('Board cleared successfully');
    }
}

// Global reset parameters function (accessible by onclick)
window.resetParameters = function() {
    console.log('=== RESET PARAMETERS CALLED ===');
    
    // Define default parameter values
    const defaultParams = {
        'global_transcription_rate': '1.0',
        'global_translation_rate': '1.0', 
        'global_degradation_rate': '1.0',
        'temperature_factor': '1.0',
        'resource_availability': '1.0',
        'repressor_strength': '2.0',
        'activator_strength': '3.0',
        'binding_affinity': '0.1',
        'cooperativity': '2.0'
    };
    
    // Reset all parameter inputs to their default values
    Object.keys(defaultParams).forEach(paramId => {
        const element = document.getElementById(paramId);
        if (element) {
            element.value = defaultParams[paramId];
            console.log(`Reset ${paramId} to ${defaultParams[paramId]}`);
        }
    });
    
    // Reset all other parameter inputs
    const parameterInputs = document.querySelectorAll('#parameter-panel input[type="number"], #parameter-panel input[type="range"], #dial-form input[type="number"]');
    parameterInputs.forEach(input => {
        if (!defaultParams[input.id] && input.hasAttribute('data-default')) {
            input.value = input.getAttribute('data-default');
        } else if (!defaultParams[input.id] && input.hasAttribute('value')) {
            input.value = input.getAttribute('value');
        }
        
        // Trigger change event to update any linked elements
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    console.log('Parameters reset to defaults');
    alert('All parameters have been reset to their default values.');
};

// Setup global click handler to clear selection
function setupGlobalClicks() {
    document.addEventListener('click', function(e) {
        // Check if click is outside component palette and board
        const isComponentClick = e.target.closest('.component');
        const isBoardClick = e.target.closest('.cell-board');
        const isPaletteClick = e.target.closest('.component-palette');
        const isHamburgerClick = e.target.closest('.hamburger-menu') || e.target.closest('.parameters-panel');
        
        if (!isComponentClick && !isBoardClick && !isPaletteClick && !isHamburgerClick) {
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

// Component selection and interaction
function setupComponents() {
    const components = document.querySelectorAll('.component');
    
    console.log(`Found ${components.length} components`);
    
    components.forEach(comp => {
        console.log(`Setting up component: ${comp.dataset.component}`);
        
        // Component click for selection
        comp.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Get the component element (in case we clicked on a child element)
            const componentElement = e.target.closest('.component');
            const componentType = componentElement ? componentElement.dataset.component : this.dataset.component;
            
            console.log(`Clicked component with data-component: ${componentType}`);
            console.log(`Event target:`, e.target);
            console.log(`This element:`, this);
            console.log(`Closest component:`, componentElement);
            
            // Clear previous selection
            clearComponentSelection();
            
            // Set current component
            state.currentComponent = componentType;
            state.currentStrength = 'norm'; // Default strength
            
            console.log(`State updated - currentComponent: ${state.currentComponent}`);
            
            // Add selected state to the correct component element
            (componentElement || this).classList.add('selected');
            
            // Show placement mode on board
            showPlacementMode();
            
            // Visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // Update selection status
            updateSelectionStatus();
            
            console.log(`Selected component: ${state.currentComponent}`);
        });
        
        // Mark that this component has listeners
        comp._hasListeners = true;
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
                    // Remove existing component first  
                    const existingIndex = state.placedComponents.findIndex(c => c.x == x && c.y == y);
                    if (existingIndex >= 0) {
                        state.placedComponents.splice(existingIndex, 1);
                    }
                    this.innerHTML = '';
                    this.classList.remove('has-component');
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
                    id: Date.now() + Math.random(),
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

// Component placement logic
function placeComponent(x, y, componentType, strength = 'norm') {
    console.log(`placeComponent called with: componentType=${componentType}, x=${x}, y=${y}`);
    
    // Check for undefined component type
    if (!componentType) {
        console.error('Cannot place component: componentType is undefined');
        return null;
    }
    
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
    
    // Update visual representation
    updateCellDisplay(x, y, componentType, state.componentCounts[baseType]);
    
    // Create dynamic parameter section if needed
    createDynamicParameterSection(componentType, state.componentCounts[baseType]);
    
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
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
            cell.innerHTML = '';
            cell.classList.remove('filled');
            cell.classList.remove('has-component');
            console.log(`Cleared visual at (${x}, ${y})`);
        }
        
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

// Update cell display
function updateCellDisplay(x, y, componentType, componentNumber, customName = null) {
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
    
    // Find the component in our data to get its custom name
    let component = null;
    for (const [type, components] of Object.entries(state.cellboard)) {
        component = components.find(comp => comp.x === x && comp.y === y);
        if (component) break;
    }
    
    // Create component display
    const display = document.createElement('div');
    display.className = 'placed-component';
    display.dataset.component = componentType;  // Store the actual component type
    display.dataset.strength = component ? (component.strength || 'norm') : 'norm';
    
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
}

// Selection status and visual feedback functions
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
    const cells = document.querySelectorAll('.cell');
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
    const cells = document.querySelectorAll('.cell');
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

// ===== DYNAMIC PARAMETER SECTION CREATION =====
// Dynamic parameter section creation
function createDynamicParameterSection(componentType, componentNumber) {
    const dialAccordion = document.querySelector('.dial-accordion');
    if (!dialAccordion) return;
    
    // Skip parameter sections for regulator components (they use constants from constants.py)
    if (REGULATOR_TYPES.includes(componentType)) {
        console.log(`Skipping parameter section for regulator component: ${componentType}`);
        return;
    }
    
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

// Remove dynamic parameter section
function removeDynamicParameterSection(componentType, componentNumber) {
    const baseType = componentType.toLowerCase().replace(' ', '_');
    const sectionId = `${baseType}_${componentNumber}`;
    const section = document.getElementById(`section_${sectionId}`);
    
    if (section) {
        section.remove();
        console.log(`Removed parameter section for ${componentType} ${componentNumber}`);
    }
}

// ===== COMPONENT PARAMETER SYSTEM =====
// Get parameters for a specific component type
function getComponentParameters(componentType, componentNumber) {
    const baseType = componentType.toLowerCase().replace(' ', '_');
    const num = componentNumber;
    
    // Get defaults from boardState (loaded from API) or use fallback
    const defaults = boardState.parameterDefaults || {};
    const ranges = boardState.parameterRanges || {};
    
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
                id: `repressor${num}_constant`,
                label: 'Repression Constant (Kr):',
                min: 0.01,
                max: 2.0,
                step: 0.01,
                defaultValue: 0.35,
                title: 'How strongly the repressor binds to the promoter'
            },
            {
                id: `repressor${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `repressor${num}_concentration`,
                label: 'Initial Concentration:',
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
                title: 'Starting repressor protein concentration (µM)'
            }
        ],
        'Repressor End': [
            {
                id: `repressor${num}_constant`,
                label: 'Repression Constant (Kr):',
                min: 0.01,
                max: 2.0,
                step: 0.01,
                defaultValue: 0.35,
                title: 'How strongly the repressor binds to the promoter'
            },
            {
                id: `repressor${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `repressor${num}_concentration`,
                label: 'Initial Concentration:',
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
                title: 'Starting repressor protein concentration (µM)'
            }
        ],
        'Activator Start': [
            {
                id: `activator${num}_constant`,
                label: 'Activation Constant (Ka):',
                min: 0.01,
                max: 2.0,
                step: 0.01,
                defaultValue: 0.4,
                title: 'How strongly the activator enhances transcription'
            },
            {
                id: `activator${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `activator${num}_concentration`,
                label: 'Initial Concentration:',
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
                title: 'Starting activator protein concentration (µM)'
            }
        ],
        'Activator End': [
            {
                id: `activator${num}_constant`,
                label: 'Activation Constant (Ka):',
                min: 0.01,
                max: 2.0,
                step: 0.01,
                defaultValue: 0.4,
                title: 'How strongly the activator enhances transcription'
            },
            {
                id: `activator${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `activator${num}_concentration`,
                label: 'Initial Concentration:',
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
                title: 'Starting activator protein concentration (µM)'
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
                id: `inducer${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `inducer${num}_concentration`,
                label: 'Initial Concentration:',
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
                title: 'Starting inducer concentration (µM)'
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
                id: `inducer${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `inducer${num}_concentration`,
                label: 'External Concentration:',
                min: 0,
                max: 5,
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
                id: `inhibitor${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `inhibitor${num}_concentration`,
                label: 'External Concentration:',
                min: 0,
                max: 5,
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
                id: `inhibitor${num}_cooperativity`,
                label: 'Cooperativity (n):',
                min: 1,
                max: 6,
                step: 1,
                defaultValue: 2,
                title: 'Hill coefficient - higher values = sharper response'
            },
            {
                id: `inhibitor${num}_concentration`,
                label: 'External Concentration:',
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
                title: 'Concentration of external inhibitor'
            }
        ]
    };
    
    return commonParams[componentType] || [];
}

// Synchronize parameters between regulator Start/End pairs
function syncRegulatorPair(sourceType, sourceNumber, paramId, newValue) {
    console.log(`Syncing ${sourceType} #${sourceNumber}: ${paramId} = ${newValue}`);
    
    // Determine the paired component type
    let targetType = null;
    if (sourceType === 'Repressor Start') targetType = 'Repressor End';
    else if (sourceType === 'Repressor End') targetType = 'Repressor Start';
    else if (sourceType === 'Activator Start') targetType = 'Activator End';
    else if (sourceType === 'Activator End') targetType = 'Activator Start';
    else if (sourceType === 'Inducer Start') targetType = 'Inducer End';
    else if (sourceType === 'Inducer End') targetType = 'Inducer Start';
    else if (sourceType === 'Inhibitor Start') targetType = 'Inhibitor End';
    else if (sourceType === 'Inhibitor End') targetType = 'Inhibitor Start';
    
    if (!targetType) {
        console.log(`${sourceType} has no paired component`);
        return;
    }
    
    // Find the paired component with the same number
    let pairedComponent = null;
    
    // First try to find in cellboard
    if (state.cellboard && state.cellboard[targetType]) {
        pairedComponent = state.cellboard[targetType].find(comp => comp.number === sourceNumber);
    }
    
    // Also try placedComponents array
    if (!pairedComponent && state.placedComponents) {
        pairedComponent = state.placedComponents.find(comp => 
            comp.type === targetType && comp.number === sourceNumber
        );
    }
    
    if (pairedComponent) {
        if (!pairedComponent.parameters) pairedComponent.parameters = {};
        pairedComponent.parameters[paramId] = newValue;
        console.log(`Synced to paired ${targetType} #${sourceNumber}`);
        
        // Update UI input if modal is open for this component
        const inputElement = document.getElementById(paramId);
        if (inputElement && inputElement.name === paramId) {
            inputElement.value = newValue;
            console.log(`Updated UI input ${paramId} to ${newValue}`);
        }
    } else {
        console.log(`No paired ${targetType} #${sourceNumber} found yet`);
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
                    
                    // Sync with paired regulator component if applicable
                    const regulatorTypes = ['Repressor Start', 'Repressor End', 'Activator Start', 'Activator End',
                                          'Inducer Start', 'Inducer End', 'Inhibitor Start', 'Inhibitor End'];
                    if (regulatorTypes.includes(componentType)) {
                        syncRegulatorPair(componentType, componentNumber, param.id, parseFloat(this.value));
                    }
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
        updateCellDisplay(x, y, componentType, componentNumber, component?.customName);
        overlay.remove();
        console.log(`Applied parameters and name for ${componentType} at (${x}, ${y})`);
    };
    
    const cancelBtn = document.createElement('button');
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

// ===== EEPROM HARDWARE INTEGRATION =====

let LOG_LINES = [];
let port = null;
let reader = null;
let writer = null;
let textDecoder = null;
let textEncoder = null;
let readableStreamClosed = null;
let writableStreamClosed = null;
let isConnecting = false;  // Prevent concurrent operations
let lineBuffer = '';  // Buffer for partial lines to prevent hex data corruption

// DOM elements - declared but initialized later
let comPortSelect;
let btnRefreshPorts;
let btnConnect;
let btnGetBoard;
let btnDiagnoseBoard;
let eepromLogArea;
let errorDisplay;
let plotContainer;

// Initialize EEPROM interface
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM element references first
    comPortSelect = document.getElementById("com-port");
    btnRefreshPorts = document.getElementById("btn-refresh-ports");
    btnConnect = document.getElementById("btn-connect");
    btnGetBoard = document.getElementById("btn-get-board");
    btnDiagnoseBoard = document.getElementById("btn-diagnose-board");
    eepromLogArea = document.getElementById("eeprom-log");
    errorDisplay = document.getElementById("error-display");
    plotContainer = document.getElementById("plot-container");
    
    console.log('EEPROM DOM elements initialized:', {
        comPortSelect: !!comPortSelect,
        btnRefreshPorts: !!btnRefreshPorts,
        btnConnect: !!btnConnect,
        btnGetBoard: !!btnGetBoard,
        btnDiagnoseBoard: !!btnDiagnoseBoard
    });
    
    // Initialize EEPROM serial connection functionality
    initEEPROMSerial();
});

async function initEEPROMSerial() {
    console.log('Initializing EEPROM serial interface...');
    await init();
}

async function init() {
    console.log('=== EEPROM Serial Init Starting ===');
    console.log('Navigator object:', navigator);
    console.log('Has serial?', 'serial' in navigator);
    console.log('Serial object:', navigator.serial);
    console.log('btnConnect element:', btnConnect);
    console.log('btnRefreshPorts element:', btnRefreshPorts);
    console.log('btnGetBoard element:', btnGetBoard);
    
    // Check for Web Serial API support
    if (!('serial' in navigator)) {
        const browserName = navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                          navigator.userAgent.includes('Edg') ? 'Edge' :
                          navigator.userAgent.includes('Safari') ? 'Safari' :
                          navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Unknown';
        
        logLine(`❌ Web Serial API not supported in ${browserName}`);
        logLine(`User Agent: ${navigator.userAgent}`);
        logLine('');
        logLine('✅ SUPPORTED BROWSERS:');
        logLine('  • Google Chrome 89+ (Recommended)');
        logLine('  • Microsoft Edge 89+');
        logLine('');
        logLine('❌ NOT SUPPORTED:');
        logLine('  • Safari (use Chrome instead)');
        logLine('  • Firefox (use Chrome instead)');
        logLine('');
        logLine('💡 If using Chrome/Edge and still seeing this error:');
        logLine('  1. Check if you\'re on an HTTPS connection or localhost');
        logLine('  2. Try chrome://flags/#enable-experimental-web-platform-features');
        logLine('  3. Make sure you\'re not in an iframe or private/incognito mode');
        logLine('  4. Check System Preferences > Security & Privacy > Privacy > Automation');
        
        // Enable buttons but show error on click
        if (btnConnect) {
            btnConnect.disabled = false;
            btnConnect.addEventListener('click', () => {
                alert(`Web Serial API is not available.\n\nBrowser: ${browserName}\nVersion: ${navigator.userAgent}\n\nPossible causes:\n- Not using HTTPS or localhost\n- Browser security settings\n- Running in iframe\n- macOS permissions issue`);
            });
        }
        if (btnRefreshPorts) {
            btnRefreshPorts.disabled = false;
            btnRefreshPorts.addEventListener('click', () => {
                alert(`Web Serial API is not available.\n\nPlease use Google Chrome 89+ or Microsoft Edge 89+`);
            });
        }
        
        console.error('Web Serial API not available. Browser:', browserName);
        console.error('Full user agent:', navigator.userAgent);
        return;
    }
    
    console.log('✓ Web Serial API is available');
    
    // Enable buttons now that we know serial is available
    if (btnConnect) btnConnect.disabled = false;
    if (btnRefreshPorts) btnRefreshPorts.disabled = false;
    
    // Check if permissions are available
    try {
        await navigator.permissions.query({ name: 'serial' });
        console.log('✓ Serial permissions query successful');
    } catch (err) {
        console.warn('Serial permissions query failed:', err);
        logLine('⚠️ Serial permissions may be restricted by browser policy');
        logLine('This might be due to iframe context, mixed content, or security settings');
        logLine('Try: 1) Opening in a new tab, 2) Using HTTPS, 3) Checking browser flags');
    }

    // Setup event listeners
    console.log('Setting up event listeners...');
    setupEventListeners();
    
    // Try to list previously granted ports
    console.log('Listing ports...');
    listPorts();
    
    console.log('=== EEPROM Serial Init Complete ===');
}

function setupEventListeners() {
    if (btnRefreshPorts) {
        btnRefreshPorts.addEventListener("click", requestAndListPorts);
    }

    if (btnConnect) {
        btnConnect.addEventListener("click", connectToPort);
    }

    if (btnGetBoard) {
        btnGetBoard.addEventListener("click", readBoardConfiguration);
    }
    
    if (btnDiagnoseBoard) {
        btnDiagnoseBoard.addEventListener("click", diagnoseBoardEEPROMs);
    }
}

// ============================
// CONNECTOR SYSTEM CLASSES (EEPROM)
// ============================

// Genetic Circuit Connector - adapted from sample.js for EEPROM interface
class GeneticConnectorEEPROM {
    constructor() {
        this.id = `connector_${++ConnectorManagerEEPROM.nextUid}`;
        this.dragType = "connector";
        this.isSelected = false;
        this.element = ConnectorManagerEEPROM.connectorTemplate.cloneNode(true);
        this.path = this.element.querySelector(".connector-path");
        this.pathOutline = this.element.querySelector(".connector-path-outline");
        this.inputHandle = this.element.querySelector(".input-handle");
        this.outputHandle = this.element.querySelector(".output-handle");
        this.inputPort = null;
        this.outputPort = null;
        this.staticPort = null;
        this.dragElement = null;
        this.staticElement = null;
        this.isInput = false;
    }

    init(port) {
        ConnectorManagerEEPROM.connectionsLayer.appendChild(this.element);
        this.element.style.display = 'block';
        
        // Add arrowhead marker to the path
        this.path.setAttribute('marker-end', 'url(#arrow)');

        this.isInput = port.isInput;
        this.staticPort = port;

        if (port.isInput) {
            this.inputPort = port;
            this.dragElement = this.outputHandle;
            this.staticElement = this.inputHandle;
        } else {
            this.outputPort = port;
            this.dragElement = this.inputHandle;
            this.staticElement = this.outputHandle;
        }

        this.staticElement.setAttribute("data-drag", `${port.id}:port`);
        this.dragElement.setAttribute("data-drag", `${this.id}:connector`);

        // Set initial positions
        const pos = port.getGlobalPosition();
        this.inputHandle.setAttribute('cx', pos.x);
        this.inputHandle.setAttribute('cy', pos.y);
        this.outputHandle.setAttribute('cx', pos.x);
        this.outputHandle.setAttribute('cy', pos.y);

        this.updatePath();
    }

    updatePath() {
        const x1 = parseFloat(this.inputHandle.getAttribute('cx'));
        const y1 = parseFloat(this.inputHandle.getAttribute('cy'));
        const x4 = parseFloat(this.outputHandle.getAttribute('cx'));
        const y4 = parseFloat(this.outputHandle.getAttribute('cy'));

        const dx = Math.abs(x1 - x4) * 0.4; // bezier weight
        
        // Always draw from Start (output) to End (input)
        // Adapt the curve direction based on relative positions
        let p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y;
        
        if (x4 < x1) {
            // Start is left of End: curve right
            p1x = x4; p1y = y4;  // Start at output (Start component)
            p2x = x4 + dx; p2y = y4;
            p4x = x1; p4y = y1;  // End at input (End component)
            p3x = x1 - dx; p3y = y1;
        } else {
            // Start is right of End: curve left
            p1x = x4; p1y = y4;  // Start at output (Start component)
            p2x = x4 - dx; p2y = y4;
            p4x = x1; p4y = y1;  // End at input (End component)
            p3x = x1 + dx; p3y = y1;
        }

        const pathData = `M${p1x} ${p1y} C ${p2x} ${p2y} ${p3x} ${p3y} ${p4x} ${p4y}`;
        this.path.setAttribute("d", pathData);
        this.path.setAttribute("marker-end", "url(#arrow)");
        this.pathOutline.setAttribute("d", pathData);
    }

    updateHandle(port) {
        const pos = port.getGlobalPosition();
        
        if (port === this.inputPort) {
            this.inputHandle.setAttribute('cx', pos.x);
            this.inputHandle.setAttribute('cy', pos.y);
        } else if (port === this.outputPort) {
            this.outputHandle.setAttribute('cx', pos.x);
            this.outputHandle.setAttribute('cy', pos.y);
        }

        this.updatePath();
    }

    placeHandle() {
        const dragPos = {
            x: parseFloat(this.dragElement.getAttribute('cx')),
            y: parseFloat(this.dragElement.getAttribute('cy'))
        };
        
        console.log('placeHandle called - dragPos:', dragPos);

        let targetPort = null;
        const targetComponents = ConnectorManagerEEPROM.getComponentsAtPosition(dragPos);
        console.log('Components at position:', targetComponents.length);

        for (let comp of targetComponents) {
            console.log('Checking component:', comp.type);
            if (comp === this.staticPort.component) {
                console.log('Skipping same component');
                continue; // Skip same component
            }
            
            const compatiblePorts = this.isInput ? comp.outputPorts : comp.inputPorts;
            console.log('Compatible ports available:', compatiblePorts.length);
            
            for (let port of compatiblePorts) {
                if (this.isValidConnection(port)) {
                    const portPos = port.getGlobalPosition();
                    const distance = Math.sqrt(
                        Math.pow(dragPos.x - portPos.x, 2) + 
                        Math.pow(dragPos.y - portPos.y, 2)
                    );
                    
                    console.log('Distance to port:', distance, 'portPos:', portPos);
                    
                    if (distance < 50) { // 50px snap distance - increased for easier connection
                        targetPort = port;
                        console.log('Found target port within snap distance!');
                        break;
                    }
                } else {
                    console.log('Connection not valid for this port');
                }
            }
            if (targetPort) break;
        }

        if (targetPort) {
            console.log('Connecting to target port');
            this.connectToPort(targetPort);
        } else {
            console.log('No target port found - removing connector');
            this.remove();
        }
    }

    connectToPort(port) {
        if (this.isInput) {
            this.outputPort = port;
        } else {
            this.inputPort = port;
        }

        this.dragElement.setAttribute("data-drag", `${port.id}:port`);
        port.addConnector(this);
        this.updateHandle(port);

        // Check compatibility and validate connection
        if (this.inputPort && this.outputPort) {
            if (!this.isValidConnection(port)) {
                this.remove();
                return;
            }
            
            console.log(`Connected ${this.outputPort.component.type} to ${this.inputPort.component.type}`);
        }
    }

    isValidConnection(targetPort) {
        if (!this.staticPort || !targetPort) return false;
        
        const sourceComp = this.staticPort.component;
        const targetComp = targetPort.component;
        
        // Prevent self-connection
        if (sourceComp === targetComp) return false;
        
        // Check if connecting input to output or vice versa
        if (this.isInput === targetPort.isInput) return false;
        
        // Check component type compatibility
        const sourceType = sourceComp.type;
        const targetType = targetComp.type;
        
        // Repressor Start can only connect to Repressor End
        if (sourceType === 'Repressor Start' && targetType !== 'Repressor End') return false;
        if (sourceType === 'Repressor End' && targetType !== 'Repressor Start') return false;
        
        // Activator Start can only connect to Activator End
        if (sourceType === 'Activator Start' && targetType !== 'Activator End') return false;
        if (sourceType === 'Activator End' && targetType !== 'Activator Start') return false;
        
        // Inducer Start can only connect to Inducer End
        if (sourceType === 'Inducer Start' && targetType !== 'Inducer End') return false;
        if (sourceType === 'Inducer End' && targetType !== 'Inducer Start') return false;
        
        // Inhibitor Start can only connect to Inhibitor End
        if (sourceType === 'Inhibitor Start' && targetType !== 'Inhibitor End') return false;
        if (sourceType === 'Inhibitor End' && targetType !== 'Inhibitor Start') return false;
        
        return true;
    }

    remove() {
        if (this.inputPort) {
            this.inputPort.removeConnector(this);
        }
        if (this.outputPort) {
            this.outputPort.removeConnector(this);
        }

        this.isSelected = false;
        this.path.removeAttribute("d");
        this.pathOutline.removeAttribute("d");
        this.dragElement.removeAttribute("data-drag");
        this.staticElement.removeAttribute("data-drag");

        this.staticPort = null;
        this.inputPort = null;
        this.outputPort = null;
        this.dragElement = null;
        this.staticElement = null;

        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        ConnectorManagerEEPROM.connectorPool.push(this);
    }

    onDrag() {
        this.updatePath();
    }

    onDragEnd() {
        this.placeHandle();
    }
}

// Component Port - represents connection points on genetic components (EEPROM version)
class ComponentPortEEPROM {
    constructor(component, isInput, element) {
        this.id = `port_${++ConnectorManagerEEPROM.nextUid}`;
        this.dragType = "port";
        this.component = component;
        this.isInput = isInput;
        this.element = element;
        this.connectors = [];
        this.lastConnector = null;

        // Add data attributes
        this.element.setAttribute("data-drag", `${this.id}:port`);
        this.element.classList.add(isInput ? 'input-port' : 'output-port');
    }

    createConnector() {
        let connector;
        
        if (ConnectorManagerEEPROM.connectorPool.length > 0) {
            connector = ConnectorManagerEEPROM.connectorPool.pop();
            ConnectorManagerEEPROM.connectorLookup[connector.id] = connector;
        } else {
            connector = new GeneticConnectorEEPROM();
            ConnectorManagerEEPROM.connectorLookup[connector.id] = connector;
        }

        connector.init(this);
        this.lastConnector = connector;
        this.connectors.push(connector);
        
        return connector;
    }

    addConnector(connector) {
        if (!this.connectors.includes(connector)) {
            this.connectors.push(connector);
            this.element.classList.add('connected');
        }
    }

    removeConnector(connector) {
        const index = this.connectors.indexOf(connector);
        if (index > -1) {
            this.connectors.splice(index, 1);
            if (this.connectors.length === 0) {
                this.element.classList.remove('connected');
            }
        }
    }

    getGlobalPosition() {
        const rect = this.element.getBoundingClientRect();
        const svgRect = document.getElementById('connector-svg').getBoundingClientRect();
        
        return {
            x: rect.left + rect.width/2 - svgRect.left,
            y: rect.top + rect.height/2 - svgRect.top
        };
    }

    update() {
        for (let connector of this.connectors) {
            connector.updateHandle(this);
        }
    }
}

// Genetic Component - wrapper for placed components with ports (EEPROM version)
class GeneticComponentEEPROM {
    constructor(placedComponent, cell) {
        this.id = `component_${++ConnectorManagerEEPROM.nextUid}`;
        this.type = placedComponent.type;
        this.gene = placedComponent.gene;
        this.strength = placedComponent.strength;
        this.cell = cell;
        this.element = cell;
        this.inputPorts = [];
        this.outputPorts = [];
        
        this.createPorts();
    }

    createPorts() {
        // Only regulatory components get ports
        console.log(`EEPROM: Creating ports for component: ${this.type}`);
        
        // Start components get output ports
        if (this.type === 'Repressor Start' || this.type === 'Activator Start' || 
            this.type === 'Inducer Start' || this.type === 'Inhibitor Start') {
            console.log('EEPROM: Creating output port for Start component');
            this.createOutputPort();
        } 
        
        // End components get input ports
        if (this.type === 'Repressor End' || this.type === 'Activator End' || 
            this.type === 'Inducer End' || this.type === 'Inhibitor End') {
            console.log('EEPROM: Creating input port for End component');
            this.createInputPort();
        }
    }

    createOutputPort() {
        const portElement = document.createElement('div');
        portElement.className = 'component-port output-port';
        portElement.title = 'Output Port - Click and drag to connect';
        this.element.appendChild(portElement);
        
        const port = new ComponentPortEEPROM(this, false, portElement);
        this.outputPorts.push(port);
        ConnectorManagerEEPROM.portLookup[port.id] = port;
        
        console.log('EEPROM: Output port created and added to cell:', portElement);
        return port;
    }

    createInputPort() {
        const portElement = document.createElement('div');
        portElement.className = 'component-port input-port';
        portElement.title = 'Input Port - Click and drag to connect';
        this.element.appendChild(portElement);
        
        const port = new ComponentPortEEPROM(this, true, portElement);
        this.inputPorts.push(port);
        ConnectorManagerEEPROM.portLookup[port.id] = port;
        
        console.log('EEPROM: Input port created and added to cell:', portElement);
        return port;
    }

    updatePorts() {
        [...this.inputPorts, ...this.outputPorts].forEach(port => port.update());
    }

    remove() {
        // Remove all connectors
        [...this.inputPorts, ...this.outputPorts].forEach(port => {
            [...port.connectors].forEach(connector => connector.remove());
        });

        // Remove port elements
        [...this.inputPorts, ...this.outputPorts].forEach(port => {
            if (port.element.parentNode) {
                port.element.parentNode.removeChild(port.element);
            }
            delete ConnectorManagerEEPROM.portLookup[port.id];
        });

        // Clear arrays
        this.inputPorts = [];
        this.outputPorts = [];
        
        delete ConnectorManagerEEPROM.componentLookup[this.id];
    }
}

// Connector Manager - orchestrates the entire connector system (EEPROM version)
class ConnectorManagerEEPROM {
    static nextUid = 0;
    static container = null;
    static connectionsLayer = null;
    static connectorTemplate = null;
    static componentLookup = {};
    static portLookup = {};
    static connectorLookup = {};
    static connectorPool = [];
    static isDragging = false;
    static dragTarget = null;

    static init() {
        this.container = document.querySelector('.grid-container');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.connectorTemplate = document.querySelector('.connector-template');

        if (!this.container || !this.connectionsLayer || !this.connectorTemplate) {
            console.error('ConnectorManagerEEPROM: Required elements not found');
            return false;
        }

        this.setupDragHandling();
        return true;
    }

    static setupDragHandling() {
        let mousePos = { x: 0, y: 0 };

        this.container.addEventListener('mousedown', (e) => {
            const target = e.target;
            console.log('MouseDown on:', target, 'Classes:', target.className);
            
            const dragData = target.getAttribute('data-drag');
            console.log('data-drag attribute:', dragData);
            
            if (!dragData) {
                // Check if this is a port by class
                if (target.classList.contains('component-port')) {
                    console.warn('Port clicked but missing data-drag attribute!', target);
                }
                return;
            }
            
            const [id, type] = dragData.split(':');
            console.log('Drag type:', type, 'ID:', id);
            
            if (type === 'port') {
                e.preventDefault();
                const port = this.portLookup[id];
                console.log('Port found in lookup:', port);
                if (port) {
                    console.log('Starting connector drag from port:', id);
                    this.startConnectorDrag(port, e);
                } else {
                    console.error('Port not found in portLookup:', id);
                }
            } else if (type === 'connector') {
                e.preventDefault();
                const connector = this.connectorLookup[id];
                if (connector) {
                    this.startConnectorHandleDrag(connector, e);
                }
            }
        });

        this.container.addEventListener('mousemove', (e) => {
            mousePos.x = e.clientX;
            mousePos.y = e.clientY;
            
            if (this.isDragging && this.dragTarget) {
                const svgRect = document.getElementById('connector-svg').getBoundingClientRect();
                const x = e.clientX - svgRect.left;
                const y = e.clientY - svgRect.top;
                
                if (this.dragTarget.dragElement) {
                    this.dragTarget.dragElement.setAttribute('cx', x);
                    this.dragTarget.dragElement.setAttribute('cy', y);
                    this.dragTarget.onDrag();
                }
            }
        });

        this.container.addEventListener('mouseup', (e) => {
            console.log('Container MouseUp event - isDragging:', this.isDragging, 'dragTarget:', this.dragTarget);
            if (this.isDragging && this.dragTarget) {
                console.log('Calling onDragEnd on connector');
                this.dragTarget.onDragEnd();
                this.isDragging = false;
                this.dragTarget = null;
            }
        });
        
        // Also listen on document for mouseup outside container
        document.addEventListener('mouseup', (e) => {
            console.log('Document MouseUp event - isDragging:', this.isDragging);
            if (this.isDragging && this.dragTarget) {
                console.log('Calling onDragEnd on connector (from document)');
                this.dragTarget.onDragEnd();
                this.isDragging = false;
                this.dragTarget = null;
            }
        });
    }

    static startConnectorDrag(port, event) {
        const connector = port.createConnector();
        this.isDragging = true;
        this.dragTarget = connector;
        
        // Trigger initial mouse move to set position
        const svgRect = document.getElementById('connector-svg').getBoundingClientRect();
        const x = event.clientX - svgRect.left;
        const y = event.clientY - svgRect.top;
        
        connector.dragElement.setAttribute('cx', x);
        connector.dragElement.setAttribute('cy', y);
        connector.onDrag();
    }

    static startConnectorHandleDrag(connector, event) {
        this.isDragging = true;
        this.dragTarget = connector;
    }

    static addComponent(placedComponent, cell) {
        const component = new GeneticComponentEEPROM(placedComponent, cell);
        this.componentLookup[component.id] = component;
        return component;
    }

    static removeComponent(cell) {
        // Find component by cell
        const component = Object.values(this.componentLookup).find(comp => comp.cell === cell);
        if (component) {
            component.remove();
        }
    }

    static getComponentsAtPosition(pos) {
        const margin = 24; // allow snapping slightly outside the cell so edge ports can be reached
        return Object.values(this.componentLookup).filter(comp => {
            const rect = comp.element.getBoundingClientRect();
            const svgRect = document.getElementById('connector-svg').getBoundingClientRect();
            const compX = rect.left - svgRect.left;
            const compY = rect.top - svgRect.top;
            
            return pos.x >= compX - margin && pos.x <= compX + rect.width + margin &&
                   pos.y >= compY - margin && pos.y <= compY + rect.height + margin;
        });
    }

    static clearAll() {
        // Remove all connectors
        Object.values(this.connectorLookup).forEach(connector => connector.remove());
        
        // Remove all components
        Object.values(this.componentLookup).forEach(component => component.remove());
        
        // Clear lookups
        this.componentLookup = {};
        this.portLookup = {};
        this.connectorLookup = {};
        this.connectorPool = [];
    }
}

// List available COM ports
async function listPorts() {
    if (!comPortSelect) return;
    
    comPortSelect.innerHTML = '<option value="">Select COM Port</option>';
    
    try {
        const ports = await navigator.serial.getPorts();
        
        for (let i = 0; i < ports.length; i++) {
            const port = ports[i];
            const option = document.createElement("option");
            option.value = i;
            option.port = port;
            
            const info = port.getInfo();
            option.textContent = info.usbProductId 
                ? `USB Device ${info.usbVendorId}:${info.usbProductId}`
                : info.usbVendorId 
                ? `USB Device ${info.usbVendorId}`
                : `Serial Port ${i + 1}`;
                
            comPortSelect.appendChild(option);
        }

        if (ports.length === 0) {
            logLine('No previously granted ports found. Click "Refresh Ports" to request access.');
        } else {
            logLine(`Found ${ports.length} previously granted port(s).`);
        }
        
    } catch (err) {
        console.error("Error listing ports:", err);
        logLine(`Error listing ports: ${err.message}`);
    }
}

// Request new port and refresh list
async function requestAndListPorts() {
    try {
        // Request a new port
        await navigator.serial.requestPort();
        logLine('New port access granted.');
        
        // Refresh the list
        await listPorts();
        
    } catch (err) {
        // User cancelled the dialog
        console.log("Port request cancelled:", err);
        logLine('Port selection cancelled.');
    }
}

// Connect to selected COM port
async function connectToPort() {
    // Prevent concurrent operations
    if (isConnecting) {
        logLine('Connection already in progress...');
        return;
    }
    
    if (port) {
        logLine('Already connected to a port. Disconnecting first...');
        await disconnectPort();
    }
    
    isConnecting = true;

    let selectedPort = null;

    if (!comPortSelect.options.length || comPortSelect.selectedIndex === 0) {
        // No port selected, request one
        try {
            logLine('Requesting port access...');
            selectedPort = await navigator.serial.requestPort();
            logLine('Port selected via dialog.');
            
            // Add the new port to the dropdown
            await listPorts();
            
        } catch (err) {
            console.error("No port selected:", err);
            logLine('Port selection cancelled or failed.');
            isConnecting = false;  // CRITICAL FIX: Reset connection flag
            return;
        }
    } else {
        // Use selected port
        const selectedOption = comPortSelect.options[comPortSelect.selectedIndex];
        selectedPort = selectedOption.port;
        logLine(`Attempting to connect to selected port...`);
    }

    try {
        // Check if port is already open
        if (selectedPort.readable) {
            logLine('Port appears to be already open. Closing first...');
            await selectedPort.close();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Open the port with appropriate settings
        logLine('Opening serial connection...');
        await selectedPort.open({
            baudRate: 115200,
            dataBits: 8,
            parity: "none",
            stopBits: 1,
            flowControl: "none"
        });

        port = selectedPort;
        logLine(`✅ Connected to serial port at 115200 baud.`);
        
        // Allow Arduino to reset (critical for stable connection)
        logLine('⏳ Waiting for Arduino to initialize (2 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Setup readers and writers with proper stream tracking
        setupSerialStreams();
        
        isConnecting = false;
        
        // Connection established - test CLI responsiveness and initialize I2C
        logLine('✅ Serial connection established.');
        
        // Perform CLI handshake to verify device responsiveness
        logLine('🔍 Testing device responsiveness...');
        await performCLIHandshake();
        
        // Skip I2C init - firmware appears to work without it (like August)
        logLine('🔧 Firmware ready for EEPROM operations');
        
        logLine('✅ Device initialization completed.');
        
        // Update UI
        btnConnect.textContent = '✅ Connected';
        btnConnect.disabled = true;
        btnConnect.classList.remove('btn-primary');
        btnConnect.classList.add('btn-success');
        
        if (btnGetBoard) {
            btnGetBoard.disabled = false;
        }

        logLine('🎉 Connection established successfully!');
        logLine('You can now click "Read Circuit from Board" to scan for components.');

    } catch (err) {
        console.error("Error opening port:", err);
        logLine(`❌ Error opening port: ${err.message}`);
        
        // Specific error handling
        if (err.message.includes('Failed to open serial port')) {
            logLine('💡 Try: 1) Check if another program is using the port 2) Unplug and reconnect the Arduino 3) Select a different port');
        } else if (err.message.includes('not found')) {
            logLine('💡 Port not found. Try refreshing ports or reconnecting the Arduino.');
        }
        
        port = null;
        isConnecting = false;  // CRITICAL FIX: Reset connection flag on error
        
        // Reset UI
        btnConnect.textContent = 'Connect';
        btnConnect.disabled = false;
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-primary');
        
        if (btnGetBoard) {
            btnGetBoard.disabled = true;
        }
    }
}

// Disconnect from current port with proper stream teardown
async function disconnectPort() {
    if (port) {
        try {
            // Proper teardown sequence to prevent locked streams
            
            // 1. Cancel reader and await readable pipe
            if (reader) {
                await reader.cancel();
                reader = null;
            }
            
            if (readableStreamClosed) {
                await readableStreamClosed.catch(() => {});
                readableStreamClosed = null;
            }
            
            // 2. Close writer and await writable pipe
            if (writer) {
                await writer.close();
                writer = null;
            }
            
            if (writableStreamClosed) {
                await writableStreamClosed.catch(() => {});
                writableStreamClosed = null;
            }
            
            // 3. Clear stream references
            textDecoder = null;
            textEncoder = null;
            
            // 4. Finally close the port
            await port.close();
            logLine('Disconnected from serial port.');
            
        } catch (err) {
            console.error('Error disconnecting:', err);
            logLine(`Error disconnecting: ${err.message}`);
        }
        
        port = null;
        isConnecting = false;  // Reset connection flag
        
        // Reset UI
        btnConnect.textContent = 'Connect';
        btnConnect.disabled = false;
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-primary');
        
        if (btnGetBoard) {
            btnGetBoard.disabled = true;
        }
    }
}

// Setup serial communication streams with proper tracking
function setupSerialStreams() {
    if (!port) return;

    try {
        // Setup text decoder stream for reading with pipe tracking
        textDecoder = new TextDecoderStream();
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        // Setup text encoder stream for writing with pipe tracking
        textEncoder = new TextEncoderStream();
        writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        // Start reading loop
        readLoop();
        
    } catch (err) {
        console.error("Error setting up streams:", err);
        logLine(`Error setting up communication: ${err.message}`);
    }
}

// Continuous reading loop
async function readLoop() {
    while (port && reader) {
        try {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            
            if (value) {
                // Use buffered line assembly to prevent hex data corruption
                lineBuffer += value;
                const lines = lineBuffer.split(/\r?\n/);
                
                // Log all complete lines except the last (which may be partial)
                for (let i = 0; i < lines.length - 1; i++) {
                    if (lines[i].trim()) {
                        logLine(lines[i].trim());
                    }
                }
                
                // Keep the last fragment as it might be partial
                lineBuffer = lines[lines.length - 1];
            }
        } catch (err) {
            console.error("Read error:", err);
            logLine(`Read error: ${err.message}`);
            break;
        }
    }
}

// Send command to device using tracked writer
async function sendCommand(command) {
    if (!port || !writer || isConnecting) {
        logLine('Error: Not connected to any port.');
        return false;
    }

    try {
        // Use the tracked writer instead of creating new ones
        await writer.write(command + "\r\n");
        
        // Small delay to ensure command is fully transmitted
        await new Promise(resolve => setTimeout(resolve, 100));
        
        logLine(`> ${command}`);
        return true;
    } catch (err) {
        console.error("Write error:", err);
        logLine(`Write error: ${err.message}`);
        return false;
    }
}

// Wait for complete response from device (like Python's buffer draining)
async function waitForCompleteResponse(timeoutMs = 2000) {
    return new Promise(resolve => {
        const startTime = Date.now();
        let lastLineCount = LOG_LINES.length;
        let stableCount = 0;
        
        function checkForStability() {
            const currentLineCount = LOG_LINES.length;
            
            if (currentLineCount === lastLineCount) {
                stableCount++;
                if (stableCount >= 4) { // 200ms of stability (4 * 50ms)
                    resolve();
                    return;
                }
            } else {
                stableCount = 0;
                lastLineCount = currentLineCount;
            }
            
            if (Date.now() - startTime > timeoutMs) {
                resolve();
                return;
            }
            
            setTimeout(checkForStability, 50);
        }
        
        // Wait at least 100ms before checking
        setTimeout(checkForStability, 100);
    });
}

// Backward compatibility alias
async function waitForResponse(timeoutMs = 2000) {
    return waitForCompleteResponse(timeoutMs);
}

// Wait for command prompt (V7 strategy - MUCH more reliable!)
async function waitForPrompt(timeoutMs = 6000) {
    const startTime = Date.now();
    const startLogLength = LOG_LINES.length;
    
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            // Only check recent lines for performance (V7 fix)
            const recentLines = LOG_LINES.slice(Math.max(0, LOG_LINES.length - 10));
            const hasPrompt = recentLines.some(line => 
                line.trim().endsWith('>') || line.includes('$')
            );
            
            if (hasPrompt || (Date.now() - startTime) > timeoutMs) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

// Legacy function kept for compatibility but redirects to prompt-based wait
async function waitForEEPROMReadComplete(timeoutMs = 6000) {
    return waitForPrompt(timeoutMs);
}

// Wait for hex dump to complete with prompt-based detection (V7 strategy)
async function waitForHexDumpComplete(timeoutMs = 6000) {
    // Use prompt-based wait instead of trying to parse hex lines
    // This is much more reliable and matches V7 behavior
    return waitForPrompt(timeoutMs);
}

// Perform CLI handshake to verify device responsiveness (like August logs)
async function performCLIHandshake() {
    // Clear line buffer for fresh start
    lineBuffer = '';
    const beforeLength = LOG_LINES.length;
    
    // Send newlines to wake up CLI
    logLine('Sending wake-up sequence...');
    await writer.write('\n\n');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try simple probe commands to verify responsiveness
    logLine('Testing CLI responsiveness with probe commands...');
    
    // Try help command
    await writer.write('help\r\n');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Try version command  
    await writer.write('ver\r\n');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if we got ANY response from device
    const newLines = LOG_LINES.slice(beforeLength);
    const responsiveLines = newLines.filter(line => 
        line.includes('Token:') || line.includes('$') || line.includes('Selected') || 
        line.includes('MUX') || line.includes('help') || line.includes('version') ||
        line.trim().length > 0 && !line.startsWith('>')
    );
    
    if (responsiveLines.length > 0) {
        logLine(`✅ Device is responding! Got ${responsiveLines.length} response lines`);
        // Log some sample responses
        responsiveLines.slice(0, 3).forEach(line => logLine(`📝 Response: "${line}"`));
    } else {
        logLine('⚠️ Device not responding to probe commands');
        logLine('This may indicate firmware issues or wrong port');
        
        // Try DTR/RTS toggle to wake up device
        logLine('Attempting to wake device with DTR/RTS toggle...');
        try {
            await port.setSignals({dataTerminalReady: true, requestToSend: false});
            await new Promise(resolve => setTimeout(resolve, 100));
            await port.setSignals({dataTerminalReady: false, requestToSend: true});
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            logLine(`Signal toggle failed: ${err.message}`);
        }
    }
}

// Initialize I2C bus (CRITICAL - was being skipped!)
async function initializeI2CBus() {
    logLine('Initializing I2C bus and EEPROM systems...');
    
    // Send I2C initialization commands that might be needed
    const initCommands = [
        'i2c begin',    // Initialize I2C
        'i2c speed 400000',  // Set I2C speed to FAST mode (400 kHz) - CRITICAL V7 FIX!
        'eeprom init',  // Initialize EEPROM subsystem
        'eeprom addr 0x50',  // Set EEPROM address (common for 11AA010)
        'scan'  // Scan for I2C devices
    ];
    
    for (const cmd of initCommands) {
        logLine(`Sending: ${cmd}`);
        try {
            await sendCommand(cmd);
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
            logLine(`Command \"${cmd}\" failed: ${err.message}`);
        }
    }
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    logLine('I2C initialization sequence completed');
}

// Read complete board configuration
async function readBoardConfiguration() {
    if (!port) {
        alert("Please connect to a COM port first.");
        return;
    }

    // Disable button and show progress
    btnGetBoard.disabled = true;
    btnGetBoard.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Reading Board...';
    
    // Clear previous logs and results
    LOG_LINES = [];
    if (eepromLogArea) {
        eepromLogArea.value = '';
    }
    
    logLine('Starting board configuration read...');
    logLine('This will scan all MUX channels for component data.');
    
    try {
        // CRITICAL V7 FIX: Initialize I2C bus first (this was missing!)
        await initializeI2CBus();
        logLine('I2C bus initialized successfully - ready for fast EEPROM reads');
        
        // Read all MUX channels (A and B, 0-15 each) - EXACTLY like August working version
        const muxChannels = ['a', 'b'];
        const channelRange = Array.from({length: 16}, (_, i) => i);
        
        for (const mux of muxChannels) {
            logLine(`\n=== Scanning MUX ${mux.toUpperCase()} ===`);
            
            for (const channel of channelRange) {
                logLine(`\n--- MUX ${mux.toUpperCase()}, Channel ${channel} ---`);
                
                // Select MUX and channel (single MUX only - like August)
                const selectCmd = `sm ${mux} ${channel}`;
                if (!(await sendCommand(selectCmd))) {
                    continue;
                }
                await waitForPrompt(2000);
                
                // Check if MUX selection failed
                const recentLog = LOG_LINES.slice(-3).join(' ').toLowerCase();
                if (recentLog.includes('error') || recentLog.includes('fail')) {
                    logLine(`Skipping channel ${channel} - MUX selection failed`);
                    continue;
                }
                
                // Read EEPROM into buffer FIRST (this was missing!)
                logLine('Reading EEPROM data into buffer...');
                await sendCommand('er 0 64');  // Read 64 bytes from address 0
                
                // Wait specifically for EEPROM read completion (V7 TIMING!)
                await waitForEEPROMReadComplete(6000);
                
                // Additional delay to ensure data is fully buffered
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Then hex dump the buffer - FIRST attempt (often fails like August)
                const hexLinesBefore = LOG_LINES.filter(line => line.match(/^\s*[0-9A-Fa-f]{2,4}:\s+(?:[0-9A-Fa-f]{2}\s+){8,}/)).length;
                await sendCommand('hd 0 16');  // Hex dump starting from address 0
                await waitForHexDumpComplete(6000);
                
                // Only retry if no hex data was captured from first attempt
                const hexLinesAfter = LOG_LINES.filter(line => line.match(/^\s*[0-9A-Fa-f]{2,4}:\s+(?:[0-9A-Fa-f]{2}\s+){8,}/)).length;
                if (hexLinesAfter === hexLinesBefore) {
                    // No hex data from first attempt - try second attempt like August pattern
                    logLine('First attempt failed, retrying...');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await sendCommand('hd 0 16');  // Use correct syntax with start address
                    await waitForHexDumpComplete(6000);
                }
                
                // Wait for EEPROM to settle before next channel
                await new Promise(resolve => setTimeout(resolve, 750));
            }
        }
        
        logLine('\n=== Board scan completed ===');
        
        // Use backend to parse the log and populate the board
        await parseLogWithBackend();
        
    } catch (err) {
        console.error("Board reading error:", err);
        logLine(`Error reading board: ${err.message}`);
        
        if (errorDisplay) {
            errorDisplay.textContent = `Board reading failed: ${err.message}`;
            errorDisplay.style.display = 'block';
        }
        
    } finally {
        // Re-enable button
        btnGetBoard.disabled = false;
        btnGetBoard.innerHTML = '<i class="fas fa-download me-2"></i>Read Circuit from Board';
    }
}

// Create analyze button
function createAnalyzeButton() {
    const btn = document.createElement('button');
    btn.id = 'btn-analyze-log';
    btn.className = 'btn btn-info mt-2 ms-2';
    btn.innerHTML = '<i class="fas fa-stethoscope me-2"></i>Analyze Issue';
    btn.style.display = 'none';
    
    const container = document.querySelector('#btn-get-board').parentNode;
    container.appendChild(btn);
    
    return btn;
}

// Create debug hex button
function createDebugHexButton() {
    const btn = document.createElement('button');
    btn.id = 'btn-debug-hex';
    btn.className = 'btn btn-warning mt-2';
    btn.innerHTML = '<i class="fas fa-bug me-2"></i>Show Raw Hex Data';
    btn.style.display = 'none';
    
    const container = document.querySelector('#btn-get-board').parentNode;
    container.appendChild(btn);
    
    return btn;
}

// Show raw hex data for debugging
function showRawHexData(channelData) {
    logLine('\n=== RAW HEX DATA DEBUG ===');
    logLine('This shows exactly what your EEPROMs contain:');
    logLine('');
    
    // Get the original log lines that contain hex data
    const hexLines = LOG_LINES.filter(line => 
        line.includes('00:') || line.includes('40:') || 
        line.includes('sm a') || line.includes('sm b')
    );
    
    let currentChannel = null;
    for (const line of hexLines) {
        // Look for MUX commands
        const cmdMatch = line.match(/>\s*sm\s+([ab])\s+(\d+)/i);
        if (cmdMatch) {
            const muxLetter = cmdMatch[1].toUpperCase();
            const channelNum = parseInt(cmdMatch[2], 10);
            currentChannel = `MUX_${muxLetter}_CH_${channelNum}`;
            logLine(`\n--- ${currentChannel} ---`);
            continue;
        }
        
        // Show hex dump lines
        if (currentChannel && (line.includes('00:') || line.includes('40:'))) {
            logLine(`${line}`);
            
            // Try to show ASCII interpretation
            const hexMatch = line.match(/^[0-7][0-9A-Fa-f]:\s*(.+)/);
            if (hexMatch) {
                const hexPart = hexMatch[1].split(/\s{3,}/)[0]; // Take only hex part
                const hexBytes = hexPart.match(/[0-9A-Fa-f]{2}/g) || [];
                
                let ascii = '';
                for (const hex of hexBytes) {
                    const byte = parseInt(hex, 16);
                    if (byte >= 32 && byte <= 126) {
                        ascii += String.fromCharCode(byte);
                    } else if (byte === 0) {
                        ascii += '\\0'; // Show null bytes
                    } else {
                        ascii += '.'; // Non-printable
                    }
                }
                
                if (ascii.replace(/\.|\\0/g, '').length > 0) {
                    logLine(`     ASCII: "${ascii}"`);
                }
            }
        }
    }
    
    logLine('\n=== INTERPRETATION ===');
    logLine('Expected component name format examples:');
    logLine('  - "promoter_lac" or "promoter_a"');
    logLine('  - "rbs_strong" or "rbs_b"'); 
    logLine('  - "cds_gfp" or "cds_c"');
    logLine('');
    logLine('What we actually found:');
    for (const [channel, components] of Object.entries(channelData)) {
        if (components.length > 0 && channel !== '_scan_stats') {
            logLine(`  ${channel}: ${components.join(', ')}`);
        }
    }
    logLine('');
    logLine('If these don\'t match what you expect, the EEPROMs may contain');
    logLine('different data than anticipated, or may need reprogramming.');
}

// Show Transfer to Designer button when circuit is successfully read
function showTransferToDesignerButton(cellboard) {
    const transferBtn = document.getElementById('btn-transfer-designer');
    if (transferBtn) {
        transferBtn.style.display = 'inline-block';
        
        // Add click handler to navigate to designer with circuit data
        transferBtn.onclick = function() {
            // Navigate to main designer page
            window.location.href = '/';
        };
    }
}

// Use backend to parse EEPROM log data
async function parseLogWithBackend() {
    try {
        logLine('\n=== Sending log data to backend for parsing ===');
        
        const response = await fetch('/interpret_hardware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_lines: LOG_LINES })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            logLine(`Backend parsing successful! Found ${result.component_count} components.`);
            
            // Log the parsed channel data with debug info
            for (const [channel, components] of Object.entries(result.channel_data)) {
                if (components.length > 0) {
                    logLine(`${channel}: ${components.join(', ')}`);
                }
            }
            
            // Add debug button to show raw hex data
            const debugBtn = document.getElementById('btn-debug-hex') || createDebugHexButton();
            debugBtn.style.display = 'inline-block';
            debugBtn.onclick = () => showRawHexData(result.channel_data);
            
            // Also add analyze button for immediate diagnosis
            const analyzeBtn = document.getElementById('btn-analyze-log') || createAnalyzeButton();
            analyzeBtn.style.display = 'inline-block';
            analyzeBtn.onclick = () => analyzeScanFailure();
            
            // Populate board from the backend-parsed cellboard data
            if (result.cellboard && Object.keys(result.cellboard).length > 0) {
                populateBoardFromCellboard(result.cellboard);
                
                // Save circuit data to localStorage for transfer to main designer
                localStorage.setItem('hardwareCircuitData', JSON.stringify({
                    cellboard: result.cellboard,
                    timestamp: Date.now(),
                    source: 'hardware_board'
                }));
                
                logLine('\nCircuit data saved for transfer to main designer!');
                
                // Show transfer button
                showTransferToDesignerButton(result.cellboard);
                
                // Run simulation with the detected circuit
                logLine('\nRunning simulation with detected circuit...');
                await runSimulationFromCellboard(result.cellboard);
            } else {
                logLine('');
                logLine('=== Board Scan Complete ===');
                logLine('No circuit components detected. This is normal if:');
                logLine('  1. Your board has no EEPROMs connected');
                logLine('  2. The EEPROMs are empty/unprogrammed');
                logLine('  3. This is a fresh hardware setup');
                logLine('');
                logLine('Next steps:');
                logLine('  - Use the main Circuit Designer to create virtual circuits');
                logLine('  - Or connect programmed EEPROMs with component data');
                logLine('  - The hardware communication is working correctly!');
            }
            
        } else {
            logLine(`Backend parsing failed: ${result.message}`);
            
            // Analyze the failure and provide helpful diagnostics
            analyzeScanFailure();
            
            // Fallback to client-side parsing
            logLine('Falling back to client-side parsing...');
            parseLogAndPopulateBoard();
        }
        
    } catch (err) {
        console.error('Backend parsing error:', err);
        logLine(`Backend parsing error: ${err.message}`);
        
        // Fallback to client-side parsing
        logLine('Falling back to client-side parsing...');
        parseLogAndPopulateBoard();
    }
}

// Parse EEPROM log and extract component data (fallback method)
function parseLogAndPopulateBoard() {
    const channelData = {};
    let currentChannel = null;
    
    logLine('\n=== Parsing component data (client-side) ===');
    
    for (const line of LOG_LINES) {
        // Look for MUX selection commands
        const cmdMatch = line.match(/>\s*sm\s+([ab])\s+(\d+)/i);
        if (cmdMatch) {
            const muxLetter = cmdMatch[1].toUpperCase();
            const channelNum = parseInt(cmdMatch[2], 10);
            currentChannel = `MUX ${muxLetter}, Channel ${channelNum}`;
            channelData[currentChannel] = [];
            continue;
        }
        
        // Parse hex dump lines in format "00: 68 65 6C 6C ..."
        if (currentChannel && line.match(/^[0-7][0-9A-Fa-f]:/)) {
            const parts = line.split(':');
            if (parts.length === 2) {
                const hexValues = parts[1].trim().split(/\s+/).slice(0, 16); // Take only hex values
                let componentString = '';
                
                // Convert hex to ASCII characters
                for (const hexValue of hexValues) {
                    if (hexValue.length === 2) {
                        try {
                            const charCode = parseInt(hexValue, 16);
                            if (charCode >= 32 && charCode <= 126) { // Printable ASCII range
                                componentString += String.fromCharCode(charCode);
                            }
                        } catch (e) {
                            // Skip invalid hex values
                        }
                    }
                }
                
                // Extract component identifiers from the ASCII string
                if (componentString.trim()) {
                    // Look for patterns like "promoter_1", "rbs_1", "cds_1", etc.
                    const componentMatches = componentString.match(/[a-zA-Z_]+_?\d*/g);
                    if (componentMatches) {
                        componentMatches.forEach(match => {
                            const componentName = match.trim();
                            if (componentName && !channelData[currentChannel].includes(componentName)) {
                                channelData[currentChannel].push(componentName);
                            }
                        });
                    }
                }
            }
        }
    }
    
    // Remove empty channels
    Object.keys(channelData).forEach(key => {
        if (channelData[key].length === 0) {
            delete channelData[key];
        } else {
            // Remove duplicates
            channelData[key] = [...new Set(channelData[key])];
        }
    });
    
    logLine(`Found components in ${Object.keys(channelData).length} channels.`);
    
    // Populate the visual board
    populateBoardFromChannelData(channelData);
}

// Populate board from backend cellboard format
function populateBoardFromCellboard(cellboard) {
    // Clear existing components
    document.querySelectorAll(".cell .placed-component").forEach(el => el.remove());
    document.querySelectorAll(".cell").forEach(cell => {
        cell.style.backgroundColor = '';
        cell.style.color = '';
        cell.textContent = '';
        cell.classList.remove('has-component');
    });
    
    // Clear state
    state.placedComponents = [];
    state.componentCounts = {};
    
    let totalComponents = 0;
    const cellOccupancy = new Map(); // Track which cells are occupied
    
    for (const [componentType, components] of Object.entries(cellboard)) {
        components.forEach(comp => {
            const x = parseInt(comp.x);
            const y = parseInt(comp.y);
            const cellKey = `${x},${y}`;
            
            // Check if cell is already occupied
            if (cellOccupancy.has(cellKey)) {
                logLine(`⚠️  Warning: Cell (${x}, ${y}) already has ${cellOccupancy.get(cellKey)}. Skipping duplicate ${componentType}.`);
                return;
            }
            
            // Find the corresponding cell
            const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
            if (!cell) {
                logLine(`⚠️  Warning: Cell at (${x}, ${y}) not found on board.`);
                return;
            }
            
            // Create component object
            const component = {
                name: `${componentType.toLowerCase()}_${comp.gene.split(' ')[1]}`,
                type: componentType,
                gene: comp.gene.split(' ')[1],
                strength: comp.strength
            };
            
            createPlacedComponent(cell, component);
            cellOccupancy.set(cellKey, componentType);
            totalComponents++;
        });
    }
    
    logLine(`Total components placed on board: ${totalComponents}`);
    
    // Auto-create connections for Start/End pairs
    autoConnectRegulatorPairs();
}

// Automatically create connections between Start and End regulator pairs
function autoConnectRegulatorPairs() {
    console.log('🔗 Auto-connecting regulator Start/End pairs...');
    console.log(`📋 Total placed components: ${state.placedComponents.length}`);
    console.log('📋 Placed components:', state.placedComponents.map(c => `${c.type} (gene ${c.gene})`));
    
    // Group components by regulator type and gene
    const regulatorPairs = {};
    
    state.placedComponents.forEach(comp => {
        const type = comp.type;
        console.log(`🔍 Checking component: type="${type}", gene="${comp.gene}"`);
        
        // Check if this is a Start or End component
        if (type.includes(' Start') || type.includes(' End')) {
            console.log(`  ✓ Found regulator: ${type}`);
            const baseType = type.replace(' Start', '').replace(' End', '');
            const position = type.includes(' Start') ? 'start' : 'end';
            const gene = comp.gene;
            const key = `${baseType}_${gene}`;
            console.log(`  📌 Key: ${key}, Position: ${position}`);
            
            if (!regulatorPairs[key]) {
                regulatorPairs[key] = { start: null, end: null, type: baseType };
            }
            
            regulatorPairs[key][position] = comp;
        }
    });
    
    console.log('📦 Regulator pairs found:', regulatorPairs);
    
    // Create connections for complete pairs
    let connectionsCreated = 0;
    for (const [key, pair] of Object.entries(regulatorPairs)) {
        console.log(`🔄 Processing pair ${key}:`, pair);
        if (pair.start && pair.end) {
            console.log(`  ✓ Both start and end found for ${key}`);
            // Find the output port of Start component
            const startComp = pair.start.componentInstance;
            const endComp = pair.end.componentInstance;
            
            console.log(`  🔌 startComp:`, startComp);
            console.log(`  🔌 endComp:`, endComp);
            
            if (startComp && endComp && startComp.outputPorts.length > 0 && endComp.inputPorts.length > 0) {
                console.log(`  ✓ Both components have ports`);
                const outputPort = startComp.outputPorts[0];
                const inputPort = endComp.inputPorts[0];
                
                // Check if connection already exists
                const alreadyConnected = outputPort.connectors.some(conn => 
                    conn.inputPort === inputPort || conn.outputPort === inputPort
                );
                
                if (!alreadyConnected) {
                    // Create the connection using the port's createConnector method
                    const connector = outputPort.createConnector();
                    if (connector) {
                        // Connect to the input port
                        connector.connectToPort(inputPort);
                        console.log(`✓ Created connection: ${pair.type} ${pair.start.gene} (Start → End)`);
                        connectionsCreated++;
                    } else {
                        console.log(`✗ Failed to create connector for ${key}`);
                    }
                } else {
                    console.log(`  ⚠️  Connection already exists for ${key}`);
                }
            } else {
                console.log(`  ✗ Missing components or ports for ${key}`);
                console.log(`    startComp exists: ${!!startComp}`);
                console.log(`    endComp exists: ${!!endComp}`);
                if (startComp) console.log(`    startComp outputPorts: ${startComp.outputPorts.length}`);
                if (endComp) console.log(`    endComp inputPorts: ${endComp.inputPorts.length}`);
            }
        } else {
            console.log(`  ✗ Incomplete pair for ${key}: start=${!!pair.start}, end=${!!pair.end}`);
        }
    }
    
    console.log(`🔗 Total connections created: ${connectionsCreated}`);
    if (connectionsCreated > 0) {
        logLine(`✓ Auto-created ${connectionsCreated} regulator connection(s)`);
    }
}

// Run simulation with cellboard data
async function runSimulationFromCellboard(cellboard) {
    try {
        const response = await fetch("/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cellboard: cellboard })
        });
        
        const result = await response.json();
        
        // DEBUG: Log the full result
        console.log('=== BOARD MODE SIMULATION RESULT ===');
        console.log('Full result:', result);
        console.log('Circuits:', result.circuits);
        console.log('Equations:', result.equations);
        console.log('Regulations:', result.regulations);
        console.log('Plot exists?', !!result.plot);
        console.log('plotContainer element:', plotContainer);
        
        if (result.status === "success") {
            console.log('=== DISPLAYING RESULTS ===');
            logLine('Hardware circuit simulation completed successfully!');
            
            // Clear previous results
            if (plotContainer) {
                plotContainer.innerHTML = '';
            }
            
            // Create grid row container for results
            const gridRow = document.createElement('div');
            gridRow.className = 'row';
            
            // Display plot
            if (result.plot && plotContainer) {
                console.log('📊 Displaying plot...');
                const plotCol = document.createElement('div');
                plotCol.className = 'col-12 mb-3';
                const plotCard = document.createElement('div');
                plotCard.className = 'card';
                plotCard.innerHTML = `
                    <div class="card-header">
                        <h5><i class="fas fa-chart-line me-2"></i>Hardware Circuit Simulation</h5>
                    </div>
                    <div class="card-body text-center">
                        <img src="data:image/png;base64,${result.plot}" 
                             alt="Hardware Circuit Simulation" 
                             class="img-fluid" 
                             style="max-width:100%; border-radius: 8px;">
                    </div>
                `;
                plotCol.appendChild(plotCard);
                plotContainer.appendChild(plotCol);
                console.log('✅ Plot displayed');
            } else {
                console.warn('⚠️ No plot to display. plot:', !!result.plot, 'plotContainer:', !!plotContainer);
            }
            
            // Append grid row to plotContainer for other cards
            if (plotContainer) {
                plotContainer.appendChild(gridRow);
            }
            
            // Display LaTeX equations
            console.log('🔍 Checking equations...', {
                'result.equations exists': !!result.equations,
                'result.equations': result.equations,
                'is object': typeof result.equations === 'object',
                'keys': result.equations ? Object.keys(result.equations) : 'N/A',
                'keys length': result.equations ? Object.keys(result.equations).length : 0
            });
            
            if (result.equations && Object.keys(result.equations).length > 0) {
                console.log('📐 Displaying equations...');
                logLine(`Generated ${Object.keys(result.equations).length} differential equations.`);
                
                const equationsCol = document.createElement('div');
                equationsCol.className = 'col-12 mb-3';
                
                const equationsCard = document.createElement('div');
                equationsCard.className = 'analysis-card';
                equationsCard.innerHTML = `
                    <h4><i class="fas fa-calculator text-warning me-2"></i>Protein Expression Equations</h4>
                    <div class="equation-display" id="equations-display">
                    </div>
                `;
                
                equationsCol.appendChild(equationsCard);
                gridRow.appendChild(equationsCol);
                
                const equationsDisplay = document.getElementById('equations-display');
                
                Object.entries(result.equations).forEach(([protein, eq]) => {
                    const eqDiv = document.createElement('div');
                    eqDiv.className = 'equation-item mb-3 p-3';
                    
                    const equationText = eq.latex || eq;
                    const formattedEquation = `$$${equationText}$$`;
                    
                    eqDiv.innerHTML = `
                        <h6 class="mb-2" style="color: var(--primary);"><i class="fas fa-dna me-2"></i>${protein}</h6>
                        <div class="equation-latex" style="font-size: 1.1em; margin: 10px 0;">${formattedEquation}</div>
                        <p class="equation-description mb-0" style="font-size: 0.9em;"><i class="fas fa-info-circle me-1"></i>${eq.description || 'Constitutive production with degradation'}</p>
                    `;
                    equationsDisplay.appendChild(eqDiv);
                });
                
                // Render LaTeX with MathJax
                if (window.MathJax) {
                    console.log('🔢 Rendering LaTeX with MathJax...');
                    MathJax.typesetPromise([equationsDisplay]).catch(err => {
                        console.error('MathJax rendering error:', err);
                    });
                } else {
                    console.warn('⚠️ MathJax not available');
                }
                console.log('✅ Equations displayed');
            } else {
                console.warn('⚠️ No equations to display. equations:', result.equations);
            }
            
            // Display Circuit Information
            console.log('🔍 Checking circuits...', {
                'result.circuits exists': !!result.circuits,
                'result.circuits': result.circuits,
                'is array': Array.isArray(result.circuits),
                'length': result.circuits ? result.circuits.length : 0
            });
            
            if (result.circuits && result.circuits.length > 0) {
                console.log('🔧 Displaying circuit information...');
                logLine(`Detected ${result.circuits.length} circuit(s).`);
                
                const circuitCol = document.createElement('div');
                circuitCol.className = 'col-md-6 mb-3';
                
                const circuitCard = document.createElement('div');
                circuitCard.className = 'analysis-card';
                circuitCard.innerHTML = `
                    <h4><i class="fas fa-check-circle text-success me-2"></i>Modelable Circuits</h4>
                    <div class="circuit-list" id="circuit-info-display">
                    </div>
                `;
                
                circuitCol.appendChild(circuitCard);
                gridRow.appendChild(circuitCol);
                
                const circuitDisplay = document.getElementById('circuit-info-display');
                
                result.circuits.forEach((circuit, index) => {
                    const circuitDiv = document.createElement('div');
                    circuitDiv.className = 'circuit-detail-item';
                    
                    let componentsHTML = '<ul class="mb-2">';
                    if (circuit.components && circuit.components.length > 0) {
                        circuit.components.forEach(comp => {
                            const displayName = comp.custom_name || comp.name || comp.type;
                            componentsHTML += `<li>${displayName}</li>`;
                        });
                    } else {
                        componentsHTML += '<li>No components found</li>';
                    }
                    componentsHTML += '</ul>';
                    
                    let countsHTML = '';
                    if (circuit.component_counts) {
                        countsHTML = '<p class="mb-1"><strong>Component Counts:</strong> ';
                        Object.entries(circuit.component_counts).forEach(([type, count]) => {
                            countsHTML += `${type}: ${count}, `;
                        });
                        countsHTML = countsHTML.slice(0, -2) + '</p>';
                    }
                    
                    circuitDiv.innerHTML = `
                        <h6 class="text-primary mb-2"><i class="fas fa-circuit-board me-2"></i>Circuit ${index + 1}: ${circuit.name || 'Unnamed'}</h6>
                        ${componentsHTML}
                        ${countsHTML}
                    `;
                    circuitDisplay.appendChild(circuitDiv);
                });
                console.log('✅ Circuit information displayed');
            } else {
                console.warn('⚠️ No circuits to display. circuits:', result.circuits);
            }
            
            // Display Regulation Information
            console.log('🔍 Checking regulations...', {
                'result.regulations exists': !!result.regulations,
                'result.regulations': result.regulations,
                'is array': Array.isArray(result.regulations),
                'length': result.regulations ? result.regulations.length : 0
            });
            
            if (result.regulations && result.regulations.length > 0) {
                console.log('🔗 Displaying regulation network...');
                const nonConstitutive = result.regulations.filter(r => r.type !== 'constitutive').length;
                logLine(`Detected ${nonConstitutive} regulatory interaction(s).`);
                
                const regCol = document.createElement('div');
                regCol.className = 'col-md-6 mb-3';
                
                const regCard = document.createElement('div');
                regCard.className = 'analysis-card';
                regCard.innerHTML = `
                    <h4><i class="fas fa-network-wired text-info me-2"></i>Regulatory Networks</h4>
                    <div class="regulation-list" id="regulation-info-display">
                    </div>
                `;
                
                regCol.appendChild(regCard);
                gridRow.appendChild(regCol);
                
                const regDisplay = document.getElementById('regulation-info-display');
                
                result.regulations.forEach((reg, index) => {
                    const regDiv = document.createElement('div');
                    regDiv.className = 'regulation-item';
                    
                    const source = reg.source || 'Constitutive';
                    const target = reg.target || 'Unknown';
                    const type = reg.type || 'constitutive';
                    
                    let explanation = '';
                    if (type === 'constitutive') {
                        explanation = 'Constant production (not regulated)';
                    } else {
                        explanation = `${source} regulates ${target}`;
                    }
                    
                    regDiv.innerHTML = `
                        <strong>${source} → ${target}</strong>
                        <br><small>Type: ${type}, Kr: ${reg.Kr || 'N/A'}, n: ${reg.n || 'N/A'}</small>
                        <br><em>${explanation}</em>
                    `;
                    regDisplay.appendChild(regDiv);
                });
                console.log('✅ Regulation network displayed');
            } else {
                console.warn('⚠️ No regulations to display. regulations:', result.regulations);
            }
            
            console.log('=== RESULTS DISPLAY COMPLETE ===');
            
        } else {
            logLine(`Hardware simulation failed: ${result.message}`);
            
            if (errorDisplay) {
                errorDisplay.textContent = result.message;
                errorDisplay.style.display = 'block';
            }
        }
        
    } catch (err) {
        console.error("Hardware simulation error:", err);
        logLine(`Hardware simulation error: ${err.message}`);
        
        if (errorDisplay) {
            errorDisplay.textContent = "Hardware simulation request failed.";
            errorDisplay.style.display = 'block';
        }
    }
}

// Diagnose individual EEPROMs to see what data they contain
async function diagnoseBoardEEPROMs() {
    if (!port) {
        alert("Please connect to a COM port first.");
        return;
    }

    // Disable button and show progress
    btnDiagnoseBoard.disabled = true;
    btnDiagnoseBoard.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Diagnosing...';
    
    // Clear previous logs
    LOG_LINES = [];
    if (eepromLogArea) {
        eepromLogArea.value = '';
    }
    
    logLine('=== EEPROM Diagnostic Mode ===');
    logLine('Checking each MUX channel for any stored data...');
    logLine('This will show you exactly what is stored on your EEPROMs.');
    
    try {
        // Test channels where your components should be located
        const testChannels = [
            {mux: 'a', channel: 0}, {mux: 'a', channel: 1}, {mux: 'a', channel: 2}, {mux: 'a', channel: 3},
            {mux: 'b', channel: 0}, {mux: 'b', channel: 1}, {mux: 'b', channel: 2}, {mux: 'b', channel: 3}
        ];
        
        for (const {mux, channel} of testChannels) {
            logLine(`\n--- Testing MUX ${mux.toUpperCase()}, Channel ${channel} ---`);
            
            // Select MUX and channel
            const selectCmd = `sm ${mux} ${channel}`;
            if (!(await sendCommand(selectCmd))) {
                continue;
            }
            await waitForResponse(1000);
            
            // Read EEPROM into buffer then hex dump (correct sequence)
            logLine('Reading EEPROM data into buffer...');
            await sendCommand('er 0 128');  // Read 128 bytes from address 0  
            await waitForResponse(1000);
            
            logLine('Hex dumping EEPROM content...');
            await sendCommand('hd 0 128');  // Hex dump starting from address 0
            await waitForResponse(2000);
            
            // Wait between channels
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        logLine('\n=== Diagnostic scan completed ===');
        logLine('Analyzing raw data for any readable content...');
        
        // Parse with enhanced detection
        await parseLogWithBackend();
        
    } catch (err) {
        console.error("Diagnostic error:", err);
        logLine(`Error during diagnostic: ${err.message}`);
        
    } finally {
        // Re-enable button
        btnDiagnoseBoard.disabled = false;
        btnDiagnoseBoard.innerHTML = '<i class="fas fa-search me-2"></i>Diagnose EEPROMs';
    }
}

// Populate visual board from parsed channel data
function populateBoardFromChannelData(channelData) {
    // Clear existing components
    document.querySelectorAll(".cell .placed-component").forEach(el => el.remove());
    document.querySelectorAll(".cell").forEach(cell => {
        cell.style.backgroundColor = '';
        cell.style.color = '';
        cell.textContent = '';
        cell.classList.remove('has-component');
    });
    
    let totalComponents = 0;
    
    for (const channelKey in channelData) {
        const components = channelData[channelKey];
        
        // Parse channel information
        const channelMatch = channelKey.match(/MUX\s+([AB]),\s*Channel\s*(\d+)/);
        if (!channelMatch) continue;
        
        const muxLetter = channelMatch[1];
        const channelNum = parseInt(channelMatch[2], 10);
        
        // Map to board position (8x8 grid)
        // MUX A maps to channels 0-15, MUX B maps to channels 16-31
        const linearPosition = (muxLetter === 'A' ? channelNum : channelNum + 16);
        const row = Math.floor(linearPosition / 8);
        const col = linearPosition % 8;
        
        // Find the corresponding cell
        const cell = document.querySelector(`.cell[data-x="${col}"][data-y="${row}"]`);
        if (!cell) continue;
        
        // Place components in the cell - handle multiple components per channel
        components.forEach((componentName, index) => {
            logLine(`Parsing component: "${componentName}"`);
            const component = parseComponentName(componentName);
            if (component) {
                logLine(`✓ Successfully parsed: ${componentName} → ${component.type} (gene ${component.gene})`);
                // For multiple components in same cell, offset them slightly
                const offsetCell = cell;
                if (index > 0) {
                    // Create a visual indicator for multiple components
                    offsetCell.style.border = '2px solid #ffd700';
                    offsetCell.title = `Multiple components: ${components.join(', ')}`;
                }
                createPlacedComponent(offsetCell, component);
                totalComponents++;
            } else {
                logLine(`✗ Failed to parse component: "${componentName}" - parseComponentName returned null`);
            }
        });
        
        logLine(`Channel ${channelKey}: ${components.join(', ')}`);
    }
    
    logLine(`\nTotal components placed: ${totalComponents}`);
    
    // Auto-create connections for Start/End pairs
    autoConnectRegulatorPairs();
    
    // Run simulation if components were found
    if (totalComponents > 0) {
        logLine(`Running simulation with ${totalComponents} detected components...`);
        runSimulationAfterPopulation();
    } else {
        logLine('No valid components detected on the board.');
        logLine('This might be due to component naming format. Check the diagnostic output above.');
    }
}

// Parse component name to extract type and gene
function parseComponentName(name) {
    // Map based on Excel file component naming format
    const cleanName = name.toLowerCase().trim();
    
    console.log(`[parseComponentName] Input: "${name}", cleanName: "${cleanName}"`);
    
    // Check component type based on Excel file format
    if (cleanName.includes('promotor') || cleanName === 'omo') {
        console.log(`[parseComponentName] Matched: Promoter`);
        return {
            name: name,
            type: 'Promoter',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('rbs')) {
        console.log(`[parseComponentName] Matched: RBS`);
        return {
            name: name,
            type: 'RBS', 
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('cds')) {
        console.log(`[parseComponentName] Matched: CDS`);
        return {
            name: name,
            type: 'CDS',
            gene: extractGeneFromName(name), 
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('terminator') || cleanName === 'termi') {
        console.log(`[parseComponentName] Matched: Terminator`);
        return {
            name: name,
            type: 'Terminator',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    // Repressor Start/End detection - check for hardware format first (repressor_b_start)
    if (cleanName.includes('_start')) {
        console.log(`[parseComponentName] Contains _start, checking regulator type...`);
        if (cleanName.startsWith('repressor')) {
            console.log(`[parseComponentName] Matched: Repressor Start`);
            return {
                name: name,
                type: 'Repressor Start',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
        if (cleanName.startsWith('activator')) {
            console.log(`[parseComponentName] Matched: Activator Start`);
            return {
                name: name,
                type: 'Activator Start',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
        if (cleanName.startsWith('inducer')) {
            console.log(`[parseComponentName] Matched: Inducer Start`);
            return {
                name: name,
                type: 'Inducer Start',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
        if (cleanName.startsWith('inhibitor')) {
            console.log(`[parseComponentName] Matched: Inhibitor Start`);
            return {
                name: name,
                type: 'Inhibitor Start',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
    }
    
    // Repressor/Activator/Inducer/Inhibitor End detection
    if (cleanName.includes('_end')) {
        console.log(`[parseComponentName] Contains _end, checking regulator type...`);
        if (cleanName.startsWith('repressor')) {
            console.log(`[parseComponentName] Matched: Repressor End`);
            return {
                name: name,
                type: 'Repressor End',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
        if (cleanName.startsWith('activator')) {
            console.log(`[parseComponentName] Matched: Activator End`);
            return {
                name: name,
                type: 'Activator End',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
        if (cleanName.startsWith('inducer')) {
            console.log(`[parseComponentName] Matched: Inducer End`);
            return {
                name: name,
                type: 'Inducer End',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
        if (cleanName.startsWith('inhibitor')) {
            console.log(`[parseComponentName] Matched: Inhibitor End`);
            return {
                name: name,
                type: 'Inhibitor End',
                gene: extractGeneFromName(name),
                strength: 'norm'
            };
        }
    }
    
    // Generic repressor (fallback for backward compatibility)
    if (cleanName.startsWith('repressor') || cleanName.startsWith('r_') || cleanName === 'r_a' || cleanName === 'r_b') {
        console.log(`[parseComponentName] Matched: Generic Repressor`);
        return {
            name: name,
            type: 'Repressor',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    // Generic activator (fallback for backward compatibility)
    if (cleanName.startsWith('activator')) {
        console.log(`[parseComponentName] Matched: Generic Activator`);
        return {
            name: name,
            type: 'Activator',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    console.log(`[parseComponentName] No match found for: "${cleanName}"`);
    return null;
    
    if (cleanName === 'or' || cleanName === 'or_a' || cleanName.includes('operator')) {
        return {
            name: name,
            type: 'Operator',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    // If no match found, log it
    logLine(`Unknown component name: ${name}`);
    return null;
}

// Helper function to extract gene identifier from component name
function extractGeneFromName(name) {
    const match = name.match(/_([a-z])(?:_|$)/i);
    return match ? match[1].toUpperCase() : '1';
}

// Create visual component on board AND add to state
function createPlacedComponent(cell, component) {
    const placedEl = document.createElement("div");
    placedEl.className = "placed-component has-parameters";
    placedEl.textContent = component.name;
    placedEl.dataset.component = component.type;
    placedEl.dataset.gene = component.gene;
    placedEl.dataset.strength = component.strength;
    
    // Apply component styling
    const colors = {
        'Promoter': '#FF6B6B',
        'Terminator': '#4ECDC4',
        'RBS': '#FFD166',
        'CDS': '#06D6A0',
        'Repressor Start': '#A78BFA',
        'Repressor End': '#7E22CE',
        'Activator Start': '#3B82F6',
        'Activator End': '#1E40AF',
        'Inducer Start': '#14B8A6',
        'Inducer End': '#0D9488',
        'Inhibitor Start': '#F97316',
        'Inhibitor End': '#EA580C'
    };
    
    placedEl.style.backgroundColor = colors[component.type] || '#999';
    placedEl.style.color = 'white';
    placedEl.style.fontWeight = 'bold';
    placedEl.style.fontSize = '0.6rem';
    placedEl.style.padding = '2px';
    placedEl.style.borderRadius = '2px';
    placedEl.style.textAlign = 'center';
    
    // IMPORTANT: Add to state so simulation can find it
    const x = cell.dataset.x;
    const y = cell.dataset.y;
    
    // Auto-increment component number based on type (like dial mode)
    const baseType = component.type.toLowerCase().replace(' ', '_');
    if (!state.componentCounts[baseType]) {
        state.componentCounts[baseType] = 1;
    } else {
        state.componentCounts[baseType]++;
    }
    
    const stateComponent = {
        type: component.type,
        number: state.componentCounts[baseType],
        strength: component.strength || 'norm',
        gene: component.gene, // CRITICAL: Add gene property for regulator pairing
        x: x,
        y: y,
        id: Date.now() + Math.random(),
        customName: component.name, // Use the parsed name
        parameters: {} // For component parameters
    };
    
    state.placedComponents.push(stateComponent);
    
    // Add click event for parameter editing (CRITICAL FIX)
    placedEl.addEventListener('click', function(e) {
        e.stopPropagation();
        showComponentParameterModal(x, y, component.type, state.componentCounts[baseType], stateComponent);
    });
    
    placedEl.title = `${component.type} - Click to edit parameters`;
    
    cell.appendChild(placedEl);
    cell.classList.add('has-component', 'filled');
    
    // Register component with connector system if it's a regulator
    if (REGULATOR_TYPES.includes(component.type)) {
        console.log(`Registering regulator component: ${component.type}`);
        const connectorComp = registerComponentWithConnectorSystem(stateComponent, cell);
        if (connectorComp) {
            console.log(`Connector component created with ${connectorComp.inputPorts.length} input ports and ${connectorComp.outputPorts.length} output ports`);
            // CRITICAL: Store componentInstance reference for auto-connection
            stateComponent.componentInstance = connectorComp;
        }
    }
    
    console.log(`Added component to state: ${component.type} at (${x}, ${y})`);
}

// Run simulation with populated board
async function runSimulationAfterPopulation() {
    const placedComponents = [];
    
    // Collect all placed components
    document.querySelectorAll(".placed-component").forEach(el => {
        const cell = el.parentElement;
        const type = el.dataset.component;
        const gene = el.dataset.gene;
        const strength = el.dataset.strength;
        const x = cell.dataset.x;
        const y = cell.dataset.y;
        
        placedComponents.push({
            type: type,
            gene: `Gene ${gene}`,
            strength: strength,
            x: x,
            y: y
        });
    });
    
    if (placedComponents.length === 0) {
        logLine('No components to simulate.');
        return;
    }
    
    // Prepare cellboard data
    const cellboard = placedComponents.reduce((acc, comp) => {
        if (!acc[comp.type]) {
            acc[comp.type] = [];
        }
        acc[comp.type].push({
            gene: comp.gene,
            strength: comp.strength,
            x: comp.x,
            y: comp.y
        });
        return acc;
    }, {});
    
    try {
        // Send simulation request
        const response = await fetch("/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cellboard: cellboard })
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            logLine('Simulation completed successfully!');
            
            // Display plot
            if (result.plot && plotContainer) {
                plotContainer.innerHTML = `
                    <img src="data:image/png;base64,${result.plot}" 
                         alt="Hardware Circuit Simulation" 
                         class="plot-image" 
                         style="max-width:100%;">
                `;
            }
            
            // Log circuit information
            if (result.circuits) {
                logLine(`Detected ${result.circuits.length} circuit(s).`);
            }
            if (result.regulations) {
                logLine(`Found ${result.regulations.length} regulatory interaction(s).`);
            }
            
        } else {
            logLine(`Simulation failed: ${result.message}`);
            
            if (errorDisplay) {
                errorDisplay.textContent = result.message;
                errorDisplay.style.display = 'block';
            }
        }
        
    } catch (err) {
        console.error("Simulation request failed:", err);
        logLine(`Simulation request failed: ${err.message}`);
        
        if (errorDisplay) {
            errorDisplay.textContent = "Simulation request failed.";
            errorDisplay.style.display = 'block';
        }
    }
}

// Log message to UI and internal log
function logLine(message) {
    // Add to internal log
    LOG_LINES.push(message);
    
    // Add to UI log area
    if (eepromLogArea) {
        eepromLogArea.value += message + "\n";
        eepromLogArea.scrollTop = eepromLogArea.scrollHeight;
    }
    
    // Also log to console for debugging
    console.log('EEPROM:', message);
}

// Analyze scan failure to provide helpful diagnostics
function analyzeScanFailure() {
    logLine('\n=== DIAGNOSTIC ANALYSIS ===');
    
    // Count different types of responses
    let totalMuxCommands = 0;
    let successfulMuxCommands = 0;
    let totalHexDumps = 0;
    let successfulHexDumps = 0;
    let hexDataFound = 0;
    let failLines = 0;
    
    // Track which hex dumps got data vs failed
    let hexDumpLines = [];
    let currentHexDumpHasData = false;
    
    for (let i = 0; i < LOG_LINES.length; i++) {
        const line = LOG_LINES[i];
        
        // Count MUX commands
        if (line.match(/>\s*sm\s+[ab]\s+\d+/)) {
            totalMuxCommands++;
        }
        
        // Count successful MUX selections
        if (line.match(/MUX [AB], Channel \d+/) || line.match(/Selected MUX [AB], Channel \d+/)) {
            successfulMuxCommands++;
        }
        
        // Count hex dump attempts and track their success
        if (line.match(/>\s*hd\s+(16|64|128)/)) {
            // If we were tracking a previous hex dump, finalize it
            if (totalHexDumps > 0) {
                if (currentHexDumpHasData) {
                    successfulHexDumps++;
                }
            }
            
            totalHexDumps++;
            currentHexDumpHasData = false;
        }
        
        // Count lines that just say "fail"
        if (line.trim() === 'fail') {
            failLines++;
        }
        
        // Count actual hex data lines (broader pattern to catch more formats)
        if (line.match(/^\s*[0-9A-Fa-f]{2,4}:\s+(?:[0-9A-Fa-f]{2}\s+){8,}/)) {
            hexDataFound++;
            currentHexDumpHasData = true;
        }
    }
    
    // Finalize the last hex dump if any
    if (totalHexDumps > 0 && currentHexDumpHasData) {
        successfulHexDumps++;
    }
    
    // Provide diagnosis
    logLine(`Hardware Communication Status:`);
    logLine(`  • MUX Commands: ${successfulMuxCommands}/${totalMuxCommands} successful`);
    logLine(`  • Hex Dump Commands: ${successfulHexDumps}/${totalHexDumps} successful`);
    logLine(`  • Hex Data Lines Found: ${hexDataFound}`);
    
    logLine('\nDiagnosis:');
    
    if (successfulMuxCommands > 0 && successfulHexDumps === 0) {
        logLine('❌ ISSUE: No EEPROMs are responding to read commands');
        logLine('');
        logLine('Possible causes:');
        logLine('  1. No EEPROMs are physically connected to any MUX channels');
        logLine('  2. EEPROMs are connected but not properly wired (VCC, GND, SDA, SCL)');
        logLine('  3. EEPROMs are faulty or damaged');
        logLine('  4. Wrong EEPROM type (expecting 11AA010 or compatible)');
        logLine('  5. I2C address conflicts or wiring issues');
        logLine('');
        logLine('Next Steps:');
        logLine('  • Check physical EEPROM connections on your Cell Board');
        logLine('  • Verify EEPROM power (3.3V) and I2C wiring');
        logLine('  • Test with a known-good EEPROM programmed with component data');
        logLine('  • Use an I2C scanner to verify EEPROM addresses');
    } else if (totalMuxCommands === 0) {
        logLine('❌ ISSUE: No hardware communication detected');
        logLine('');
        logLine('Possible causes:');
        logLine('  • Serial port not connected properly');
        logLine('  • Wrong baud rate or communication settings'); 
        logLine('  • Hardware not powered on');
    } else {
        logLine('⚠️  PARTIAL ISSUE: Mixed communication results');
        logLine('');
        logLine('Some commands work but data reading is inconsistent.');
        logLine('This suggests intermittent connection or hardware issues.');
    }
}

// Clear log, board preview, and simulation results
function clearLogAndBoard() {
    // Clear internal log array
    LOG_LINES.length = 0;
    
    // Clear UI log area
    if (eepromLogArea) {
        eepromLogArea.value = '';
    }
    
    // Clear board preview - remove all placed components
    const placedComponents = document.querySelectorAll('.placed-component');
    placedComponents.forEach(component => {
        component.remove();
    });
    
    // Remove has-component class from cells
    const cellsWithComponents = document.querySelectorAll('.cell.has-component');
    cellsWithComponents.forEach(cell => {
        cell.classList.remove('has-component');
    });
    
    // Clear simulation results
    const plotContainer = document.getElementById('plot-container');
    if (plotContainer) {
        plotContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-microchip" style="color: var(--primary); font-size: 2rem;"></i>
                <p>Connect to hardware and read circuit configuration</p>
            </div>
        `;
    }
    
    // Clear error display
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        errorDisplay.style.display = 'none';
        errorDisplay.textContent = '';
    }
    
    // Hide transfer and debug buttons
    const transferBtn = document.getElementById('btn-transfer-designer');
    if (transferBtn) {
        transferBtn.style.display = 'none';
    }
    
    const debugBtn = document.getElementById('btn-debug-hex');
    if (debugBtn) {
        debugBtn.style.display = 'none';
    }
    
    const analyzeBtn = document.getElementById('btn-analyze-log');
    if (analyzeBtn) {
        analyzeBtn.style.display = 'none';
    }
    
    console.log('EEPROM: Log, board preview, and simulation results cleared');
}

// Removed duplicate global runSimulation function to avoid conflicts
// The runSimulation function is properly defined within the component initialization scope

async function runSimulationFromPlacedComponents() {
    console.log('=== RUNNING SIMULATION FROM PLACED COMPONENTS ===');
    
    const errorDisplay = document.getElementById('error-display');
    const plotContainer = document.getElementById('plot-container');
    const dialForm = document.getElementById('dial-form');
    const simulateBtn = document.getElementById('simulate-btn');
    
    // Clear previous errors
    if (errorDisplay) {
        errorDisplay.style.display = 'none';
        errorDisplay.textContent = '';
    }

    // Show loading in plot container
    if (plotContainer) {
        plotContainer.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Simulating genetic circuit dynamics...</p>
            </div>
        `;
    }

    try {
        // Always sync from DOM first - this handles all existing components
        const domComponents = document.querySelectorAll('.placed-component');
        console.log(`Found ${domComponents.length} visual components on board`);
        
        if (domComponents.length === 0) {
            throw new Error('No components placed on the board. Please place some components first.');
        }
        
        // Build cellboard from DOM components (dial mode format)
        const cellboard = {};
        const componentCounts = {};
        
        domComponents.forEach((el, i) => {
            const cell = el.parentElement;
            const x = parseInt(cell.dataset.x);
            const y = parseInt(cell.dataset.y);
            const componentType = el.dataset.component || el.textContent.split(' ')[0] || 'Unknown';
            
            if (!cellboard[componentType]) {
                cellboard[componentType] = [];
            }
            
            // Auto-increment component number
            const baseType = componentType.toLowerCase().replace(' ', '_');
            if (!componentCounts[baseType]) {
                componentCounts[baseType] = 1;
            } else {
                componentCounts[baseType]++;
            }
            
            // Find the original component object with parameters
            let existingComponent = null;
            
            // Check state.placedComponents first
            if (state.placedComponents) {
                existingComponent = state.placedComponents.find(comp => comp.x === x && comp.y === y);
            }
            
            // Check state.cellboard if not found
            if (!existingComponent && state.cellboard) {
                for (const components of Object.values(state.cellboard)) {
                    existingComponent = components.find(comp => comp.x === x && comp.y === y);
                    if (existingComponent) break;
                }
            }
            
            // Create component object with all properties including parameters
            const componentData = {
                x: x,
                y: y,
                type: componentType,
                strength: el.dataset.strength || 'norm',
                number: componentCounts[baseType]
            };
            
            // Include parameters if they exist
            if (existingComponent && existingComponent.parameters) {
                componentData.parameters = existingComponent.parameters;
                console.log(`Component ${i+1}: ${componentType} at (${x}, ${y}) - HAS PARAMETERS:`, existingComponent.parameters);
            } else {
                console.log(`Component ${i+1}: ${componentType} at (${x}, ${y}) - no parameters`);
            }
            
            cellboard[componentType].push(componentData);
        });
        
        console.log('Prepared cellboard:', cellboard);
        
        // Prepare request data
        const requestData = { cellboard: cellboard };
        
        // Add dial data if available
        if (dialForm) {
            const toggle = document.getElementById('enable_dial_params');
            const includeDial = toggle ? toggle.checked : false;
            requestData.apply_dial = includeDial;
            
            const dialData = {};
            
            // Always collect global parameters (either from form or defaults)
            if (includeDial) {
                // Collect global parameters from dial form
                const inputs = dialForm.querySelectorAll('input[type="number"]:not([disabled])');
                console.log(`[COLLECT] Collecting ${inputs.length} global parameter inputs`);
                
                inputs.forEach(input => {
                    const paramName = input.name || input.id;
                    const value = parseFloat(input.value);
                    if (!isNaN(value) && paramName) {
                        dialData[paramName] = value;
                        console.log(`  [COLLECT] Global - ${paramName}: ${value}`);
                    }
                });
                
                // Collect component-specific parameters from cellboard
                let componentParamCount = 0;
                console.log(`[COLLECT] Scanning cellboard for component parameters...`);
                Object.entries(cellboard).forEach(([type, components]) => {
                    console.log(`[COLLECT] Type "${type}" has ${components.length} components`);
                    components.forEach((comp, idx) => {
                        if (comp.parameters) {
                            console.log(`[COLLECT]   Component ${idx} has parameters:`, comp.parameters);
                            Object.entries(comp.parameters).forEach(([paramId, paramValue]) => {
                                dialData[paramId] = paramValue;
                                componentParamCount++;
                                console.log(`[COLLECT]     Added ${paramId} = ${paramValue}`);
                            });
                        }
                    });
                });
                
                requestData.dial = dialData;
                console.log(`[COLLECT] Dial parameters collected: ${Object.keys(dialData).length} total`);
                console.log('[COLLECT] Final dialData:', dialData);
            } else {
                // When toggle is OFF, send default values of 1.0 for all global parameters
                // Do NOT include any custom component parameters - use defaults only
                console.log('⚠️ TOGGLE IS OFF - Sending default values (1.0) for ALL global parameters');
                console.log('   Custom component parameters will be IGNORED - using base defaults');
                dialData.global_transcription_rate = 1.0;
                dialData.global_translation_rate = 1.0;
                dialData.global_degradation_rate = 1.0;
                dialData.temperature_factor = 1.0;
                dialData.resource_availability = 1.0;
                requestData.dial = dialData;
                console.log('[COLLECT] Default dialData (all 1.0):', dialData);
                console.log('✓ Sending to backend: apply_dial=false, all global params=1.0, NO custom component params');
            }
        } else {
            console.warn('No dial form found - parameters will not be applied');
            requestData.apply_dial = false;
        }
        
        console.log('Sending simulation request:', requestData);
        
        // Send simulation request
        const response = await fetch('/simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Simulation result:', result);

        if (result.status === 'success') {
            // Display results
            if (result.plot && plotContainer) {
                // Clear and display full results
                plotContainer.innerHTML = '';
                
                // Create main results container
                const resultsDiv = document.createElement('div');
                resultsDiv.className = 'simulation-results';
                
                // Plot image
                console.log('📊 Displaying plot...');
                const plotImg = document.createElement('img');
                plotImg.src = `data:image/png;base64,${result.plot}`;
                plotImg.className = 'simulation-plot';
                plotImg.alt = 'Simulation Results';
                plotImg.style.maxWidth = '100%';
                plotImg.style.height = 'auto';
                plotImg.style.borderRadius = '8px';
                plotImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                resultsDiv.appendChild(plotImg);
                
                // Add equations if available (BEFORE circuit analysis)
                if (result.equations) {
                    console.log('📐 Displaying equations...');
                    const equationsDiv = document.createElement('div');
                    equationsDiv.className = 'equations-container';
                    equationsDiv.innerHTML = '<h3>Circuit Equations</h3>';
                    
                    Object.entries(result.equations).forEach(([protein, eq]) => {
                        const eqDiv = document.createElement('div');
                        eqDiv.className = 'equation-item';
                        
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
                
                // Add circuit information
                if (result.circuits && result.circuits.length > 0) {
                    console.log('🔧 Displaying circuit analysis...');
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
                                const displayName = comp.custom_name || comp.name || `${comp.type}`;
                                circuitDetailsHTML += `<li>${displayName}</li>`;
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
                
                // Add global parameters information card
                if (result.global_parameters_applied !== undefined) {
                    console.log('🎛️ Displaying global parameters info...');
                    const globalParamsInfo = document.createElement('div');
                    globalParamsInfo.className = 'global-params-info';
                    
                    let globalHTML = `
                        <h3>Global Parameter Effects</h3>
                        <p><em>Shows how global multipliers affect all circuit components in the calculation.</em></p>
                    `;
                    
                    if (result.global_parameters_applied && result.global_parameters && Object.keys(result.global_parameters).length > 0) {
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
                    } else {
                        globalHTML += `
                            <div class="global-status inactive">Global Parameters DISABLED</div>
                            <p style="color: #999; margin-top: 1rem;">
                                Toggle the switch above to apply global multipliers to all components.
                                When disabled, components use their individual parameter values only.
                            </p>
                        `;
                    }
                    
                    globalParamsInfo.innerHTML = globalHTML;
                    resultsDiv.appendChild(globalParamsInfo);
                }
                
                // Add regulation information
                if (result.regulations && result.regulations.length > 0) {
                    console.log('🔗 Displaying regulatory network...');
                    const regulationInfo = document.createElement('div');
                    regulationInfo.className = 'regulation-info';
                    
                    let regulationHTML = `
                        <h3>Regulatory Network</h3>
                        <p><em>Shows how proteins regulate each other's production. "Constitutive" means constant production without regulation.</em></p>
                        <div class="regulation-list">
                    `;
                    
                    result.regulations.forEach((regulation, index) => {
                        const source = regulation.source || 'Constitutive';
                        const target = regulation.target || 'Unknown';
                        const type = regulation.type || 'constitutive';
                        const params = regulation.parameters || {};
                        const isFloating = params.is_floating || false;
                        
                        // Determine regulation type color and label
                        let typeColor = '#666';
                        let typeLabel = type;
                        
                        if (type === 'constitutive') {
                            typeColor = '#4ECDC4';
                            typeLabel = 'Constitutive';
                        } else if (type === 'transcriptional_repression') {
                            typeColor = '#FF6B6B';
                            typeLabel = 'Repression';
                        } else if (type === 'self_repression') {
                            typeColor = '#E74C3C';
                            typeLabel = 'Self-Repression';
                        } else if (type === 'transcriptional_activation') {
                            typeColor = '#95E1D3';
                            typeLabel = 'Activation';
                        } else if (type === 'self_activation') {
                            typeColor = '#2ECC71';
                            typeLabel = 'Self-Activation';
                        } else if (type === 'induced_activation') {
                            typeColor = '#F8B739';
                            typeLabel = 'Induced Activation';
                        } else if (type === 'environmental_repression') {
                            typeColor = '#E67E22';
                            typeLabel = 'Environmental Repression';
                        }
                        
                        let explanation = '';
                        if (type === 'constitutive' || source === 'Unknown' || source === 'Constitutive') {
                            explanation = 'This promoter produces protein at a constant rate (not regulated by other proteins)';
                        } else if (type === 'self_repression') {
                            explanation = `${source} protein inhibits its own promoter ${target} (negative feedback loop)`;
                        } else if (type === 'self_activation') {
                            explanation = `${source} protein activates its own promoter ${target} (positive feedback loop)`;
                        } else if (type === 'transcriptional_repression') {
                            explanation = `${source} protein inhibits ${target} transcription`;
                        } else if (type === 'transcriptional_activation') {
                            explanation = `${source} protein activates ${target} transcription`;
                        } else if (type === 'induced_activation') {
                            explanation = `Environmental inducer ${source} activates ${target} transcription`;
                        } else if (type === 'environmental_repression') {
                            explanation = `Environmental inhibitor ${source} represses ${target} transcription`;
                        } else {
                            explanation = `${source} protein regulates ${target} transcription`;
                        }
                        
                        // Build parameter display
                        let paramStr = '';
                        if (params.Kr !== undefined) {
                            paramStr += `Kr=${params.Kr.toFixed(3)}`;
                        } else if (params.Ka !== undefined) {
                            paramStr += `Ka=${params.Ka.toFixed(3)}`;
                        }
                        if (params.n !== undefined) {
                            if (paramStr) paramStr += ', ';
                            paramStr += `n=${params.n.toFixed(1)}`;
                        }
                        if (params.concentration !== undefined) {
                            if (paramStr) paramStr += ', ';
                            paramStr += `Conc=${params.concentration.toFixed(2)}`;
                        }
                        
                        const floatingBadge = isFloating ? '<span class="badge badge-floating">External</span>' : '<span class="badge badge-internal">Internal</span>';
                        
                        regulationHTML += `
                            <div class="regulation-item" style="border-left: 4px solid ${typeColor};">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <strong style="color: ${typeColor};">Regulation ${index + 1}: ${typeLabel}</strong>
                                    ${floatingBadge}
                                </div>
                                <div style="font-size: 1.1em; margin: 8px 0;">
                                    ${source} → ${target}
                                </div>
                                ${paramStr ? `<small style="color: #999;">Strength: ${paramStr}</small><br>` : ''}
                                <em style="color: #AAA;">${explanation}</em>
                            </div>
                        `;
                    });
                    
                    regulationHTML += '</div>';
                    regulationInfo.innerHTML = regulationHTML;
                    resultsDiv.appendChild(regulationInfo);
                }
                
                // Display component parameters
                if (result.component_parameters && result.component_parameters.length > 0) {
                    console.log('⚙️ Displaying component parameters...');
                    const paramsInfo = document.createElement('div');
                    paramsInfo.className = 'component-params-info';
                    
                    let paramsHTML = '<h3>Component Parameters</h3>';
                    
                    result.component_parameters.forEach(comp => {
                        paramsHTML += `
                            <div class="parameter-item">
                                <h4>
                                    <i class="fas fa-cube me-2"></i>${comp.name} 
                                    <span class="badge">${comp.type}</span>
                                </h4>
                        `;
                        
                        if (comp.parameters && Object.keys(comp.parameters).length > 0) {
                            paramsHTML += '<table class="params-table">';
                            Object.entries(comp.parameters).forEach(([key, value]) => {
                                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                const displayValue = typeof value === 'number' ? value.toFixed(4) : value;
                                
                                // Add calculation explanation if global parameters were applied
                                let calculation = '';
                                if (result.global_parameters_applied && result.global_parameters) {
                                    const globals = result.global_parameters;
                                    
                                    if (comp.type === 'Promoter' && key === 'strength') {
                                        const factors = [];
                                        if (globals.global_transcription_rate && globals.global_transcription_rate !== 1.0) {
                                            factors.push(`transcription(${globals.global_transcription_rate.toFixed(2)}x)`);
                                        }
                                        if (globals.temperature_factor && globals.temperature_factor !== 1.0) {
                                            factors.push(`temp(${globals.temperature_factor.toFixed(2)}x)`);
                                        }
                                        if (globals.resource_availability && globals.resource_availability !== 1.0) {
                                            factors.push(`resources(${globals.resource_availability.toFixed(2)}x)`);
                                        }
                                        if (factors.length > 0) {
                                            calculation = `<br><small style="color: #95E1D3; font-style: italic;">Applied: ${factors.join(' × ')}</small>`;
                                        }
                                    } else if (comp.type === 'RBS' && key === 'efficiency') {
                                        const factors = [];
                                        if (globals.global_translation_rate && globals.global_translation_rate !== 1.0) {
                                            factors.push(`translation(${globals.global_translation_rate.toFixed(2)}x)`);
                                        }
                                        if (globals.resource_availability && globals.resource_availability !== 1.0) {
                                            factors.push(`resources(${globals.resource_availability.toFixed(2)}x)`);
                                        }
                                        if (factors.length > 0) {
                                            calculation = `<br><small style="color: #95E1D3; font-style: italic;">Applied: ${factors.join(' × ')}</small>`;
                                        }
                                    } else if (comp.type === 'CDS') {
                                        if (key === 'translation_rate') {
                                            const factors = [];
                                            if (globals.global_translation_rate && globals.global_translation_rate !== 1.0) {
                                                factors.push(`translation(${globals.global_translation_rate.toFixed(2)}x)`);
                                            }
                                            if (globals.temperature_factor && globals.temperature_factor !== 1.0) {
                                                factors.push(`temp(${globals.temperature_factor.toFixed(2)}x)`);
                                            }
                                            if (factors.length > 0) {
                                                calculation = `<br><small style="color: #95E1D3; font-style: italic;">Applied: ${factors.join(' × ')}</small>`;
                                            }
                                        } else if (key === 'degradation_rate') {
                                            if (globals.global_degradation_rate && globals.global_degradation_rate !== 1.0) {
                                                calculation = `<br><small style="color: #FFD166; font-style: italic;">Applied: degradation(${globals.global_degradation_rate.toFixed(2)}x)</small>`;
                                            }
                                        }
                                    }
                                }
                                
                                paramsHTML += `
                                    <tr>
                                        <td class="param-name">${displayKey}:</td>
                                        <td class="param-value">${displayValue}${calculation}</td>
                                    </tr>
                                `;
                            });
                            paramsHTML += '</table>';
                        }
                        
                        paramsHTML += '</div>';
                    });
                    
                    paramsInfo.innerHTML = paramsHTML;
                    resultsDiv.appendChild(paramsInfo);
                }
                
                plotContainer.appendChild(resultsDiv);
                
                // Render LaTeX equations if MathJax is available
                if (window.MathJax) {
                    MathJax.typesetPromise([plotContainer]).catch(err => {
                        console.error('MathJax error:', err);
                    });
                }
                
            } else if (plotContainer) {
                plotContainer.innerHTML = '<p class="text-center">Simulation completed successfully</p>';
            }

            // Add animation
            if (plotContainer) {
                plotContainer.classList.add('placed');
                setTimeout(() => {
                    plotContainer.classList.remove('placed');
                }, 300);
            }

            // Log detailed results
            if (result.circuits) {
                console.log('Detected circuits:', result.circuits);
            }
            if (result.regulations) {
                console.log('Regulatory networks:', result.regulations);
            }
            if (result.warnings && result.warnings.length > 0) {
                console.warn('Simulation warnings:', result.warnings);
            }

        } else {
            throw new Error(result.message || 'Unknown simulation error');
        }

    } catch (error) {
        console.error('Simulation failed:', error);
        
        // Display error
        if (errorDisplay) {
            errorDisplay.textContent = `Error: ${error.message}`;
            errorDisplay.style.display = 'block';
        }

        // Show error in plot container
        if (plotContainer) {
            plotContainer.innerHTML = `
                <div class="loading">
                    <i class="fas fa-exclamation-triangle" style="color: var(--error); font-size: 2rem;"></i>
                    <p>Simulation failed</p>
                    <small class="text-muted">${error.message}</small>
                </div>
            `;
        }

    } finally {
        // Re-enable button
        if (simulateBtn) {
            simulateBtn.disabled = false;
            simulateBtn.innerHTML = '<i class="fas fa-play me-2"></i>Run Simulation';
        }
    }
}

// Expose functions for debugging  
window.eepromInterface = {
    LOG_LINES,
    logLine,
    sendCommand,
    parseLogAndPopulateBoard,
    populateBoardFromChannelData,
    clearLogAndBoard,
    runSimulation
};

// Test function to debug button clicks
function testButtonClick() {
    console.log('Test button click function called');
    const simulateBtn = document.getElementById('simulate-btn');
    console.log('Simulate button:', simulateBtn);
    if (simulateBtn) {
        console.log('Button found, triggering click...');
        simulateBtn.click();
    } else {
        console.log('Button not found!');
    }
}

// Expose test function
window.testButtonClick = testButtonClick;

// Auto-test on load for debugging
setTimeout(() => {
    console.log('=== AUTO DEBUG TEST ===');
    const simulateBtn = document.getElementById('simulate-btn');
    console.log('Simulate button found:', !!simulateBtn);
    if (simulateBtn) {
        console.log('Button text:', simulateBtn.textContent.trim());
        console.log('Button disabled:', simulateBtn.disabled);
        console.log('Button listeners:', simulateBtn.onclick);
    }
    
    const placedComponents = document.querySelectorAll('.placed-component');
    console.log('Placed components found:', placedComponents.length);
    placedComponents.forEach((el, i) => {
        console.log(`  Component ${i+1}:`, el.textContent, 'at', el.parentElement.dataset.x, el.parentElement.dataset.y);
    });
}, 2000);

// Simple debug function for component clicking
window.simpleComponentTest = function() {
    console.log('=== SIMPLE COMPONENT TEST ===');
    const promoter = document.querySelector('[data-component="Promoter"]');
    if (promoter) {
        console.log('Found Promoter component:', promoter);
        console.log('Current state before click:', state.currentComponent);
        console.log('Has click listeners:', promoter._hasListeners);
        
        // Test direct click
        promoter.click();
        console.log('Current state after click:', state.currentComponent);
        
        // Test manual event trigger
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        console.log('Triggering manual click event...');
        promoter.dispatchEvent(event);
        console.log('Current state after manual event:', state.currentComponent);
    } else {
        console.log('Promoter component not found!');
    }
    
    // Check all components
    const allComponents = document.querySelectorAll('.component');
    console.log(`Total components found: ${allComponents.length}`);
    allComponents.forEach((comp, i) => {
        console.log(`  ${i+1}. ${comp.dataset.component} - Has listeners: ${comp._hasListeners}`);
    });
};

// Debug function to test component selection
window.testComponentSelection = function() {
    console.log('=== TESTING COMPONENT SELECTION ===');
    const components = document.querySelectorAll('.component');
    console.log(`Found ${components.length} components:`);
    
    components.forEach((comp, index) => {
        console.log(`  ${index + 1}. ${comp.dataset.component} - Listeners: ${comp._hasListeners ? 'YES' : 'NO'}`);
        console.log(`    Element:`, comp);
    });
    
    console.log('State:', {
        currentComponent: state.currentComponent,
        currentStrength: state.currentStrength,
        placedComponents: state.placedComponents.length
    });
    
    if (components.length > 0) {
        console.log('Simulating click on first component (Promoter)...');
        components[0].click();
        
        setTimeout(() => {
            console.log('After click - State:', {
                currentComponent: state.currentComponent,
                currentStrength: state.currentStrength
            });
        }, 100);
    }
};

// Debug function to manually set up component listeners
window.debugComponentSetup = function() {
    console.log('=== MANUALLY SETTING UP COMPONENTS ===');
    const components = document.querySelectorAll('.component');
    console.log(`Setting up ${components.length} components...`);
    
    components.forEach((comp, index) => {
        if (!comp._hasListeners) {
            comp.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log(`Manual click handler: ${this.dataset.component}`);
                state.currentComponent = this.dataset.component;
                state.currentStrength = 'norm';
                console.log('Updated state:', state.currentComponent);
            });
            comp._hasListeners = true;
            console.log(`Added listener to ${comp.dataset.component}`);
        }
    });
};

// Debug function to test all buttons
window.testAllButtons = function() {
    console.log('=== TESTING ALL BUTTONS ===');
    
    const simulateBtn = document.getElementById('simulate-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    console.log('Simulate button found:', !!simulateBtn);
    console.log('Clear button found:', !!clearBtn);
    
    if (simulateBtn) {
        console.log('Simulate button click listeners:', simulateBtn.onclick);
        console.log('Testing simulate button...');
        simulateBtn.click();
    }
    
    setTimeout(() => {
        if (clearBtn) {
            console.log('Clear button click listeners:', clearBtn.onclick);
            console.log('Testing clear button...');
            // Don't actually clear, just test the function exists
            console.log('clearBoard function available:', typeof clearBoard === 'function');
        }
        
        console.log('resetParameters function available:', typeof window.resetParameters === 'function');
        
    }, 1000);
};

// Removed entire duplicate script section that was causing component selection conflicts

// ===== GLOBAL MODE FUNCTIONALITY =====
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

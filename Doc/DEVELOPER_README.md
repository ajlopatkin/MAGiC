# Genetic Circuit Designer - Developer Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [File Structure & Responsibilities](#file-structure--responsibilities)
3. [Key Systems & Where to Find Them](#key-systems--where-to-find-them)
4. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
5. [Development Workflow](#development-workflow)

---

## Project Overview

A Flask-based web application for designing and simulating genetic circuits with hardware integration (EEPROM board) and advanced parameter tuning capabilities.

**Main Entry Point:** `main.py` → `app.py`

---

## File Structure & Responsibilities

### Core Python Files

#### `app.py` (Main Application - 1261 lines)
**Purpose:** Flask web server and application logic

**Key Functions:**
- `generate_equation_display()` - Generates LaTeX equations for proteins
- `/api/simulate` - Main simulation endpoint
- `/api/export_project` - Project export with plots
- Routes: `/`, `/home`, `/dial`, `/eeprom`, `/about`

**Dependencies:**
- `circuit_model.py` - Circuit simulation engine
- `constants.py` - Component parameters

#### `circuit_model.py` (Circuit Engine - 1080 lines)
**Purpose:** Core circuit modeling and simulation logic

**Key Classes:**
- `Component` - Represents individual genetic components
- `OntologyBuilderUnified` - Main circuit builder and parser
- `simulate_circuit()` - ODE-based simulation function

**Critical Methods:**
- `parse_channels()` - Parses EEPROM hardware data into circuits
- `build_circuit_structure()` - Converts parsed data to circuit objects
- `build_regulations()` - Determines regulatory interactions
- `assign_protein_names()` - Maps CDS to protein identifiers

#### `constants.py` (185 lines)
**Purpose:** Biological parameters for components

**Contains:**
- Promoter strengths
- RBS efficiencies
- CDS translation/degradation rates
- Regulator dissociation constants (Kd)
- Hill coefficients (n)

#### `main.py`
**Purpose:** Application entry point - runs Flask server on port 8000

---

### Frontend Files

#### HTML Templates (`templates/`)

1. **`home.html`** - Landing page with navigation
2. **`dial.html`** - Main circuit designer interface (SOFTWARE MODE)
3. **`eeprom.html`** - Hardware interface (HARDWARE MODE)
4. **`about.html`** - About page
5. **`loading.html`** - Loading screen

#### JavaScript (`static/js/`)

1. **`script.js`** - Main circuit designer logic for dial.html
2. **`eeprom.js`** (3741 lines) - EEPROM board interface and controls
3. **`tooltip.js`** - Tooltip functionality

**Active Files:** `script.js`, `eeprom.js`, `tooltip.js`

#### CSS (`static/css/`)

1. **`styles.css`** - Global styles
2. **`dial.css`** - Dial mode specific styles
3. **`eeprom.css`** - EEPROM mode specific styles
4. **`about.css`** - About page styles

**Active Files:** All 4 CSS files above

---

## Key Systems & Where to Find Them

### EEPROM Board Controls & Hardware Integration

#### Where to Look:

**Frontend (JavaScript):**
- **File:** `static/js/eeprom.js`
- **Key Sections:**
  - **Lines 1-200:** EEPROM state management and initialization
  - **Lines 500-800:** Component parsing from hardware channels
  - **Lines 1000-1500:** Channel-to-component mapping logic
  - **Lines 2000-2500:** Hardware data transmission/reception
  - **Lines 3500-3741:** Event handlers for board controls

**Backend (Python):**
- **File:** `circuit_model.py`
- **Key Methods:**
  - `parse_channels()` (Line ~100-300) - Parses 128 channels (A0-H15) into circuits
  - `Component.__init__()` (Line ~15-45) - Hardware channel mapping
  - `build_circuit_structure()` (Line ~400-600) - Converts channels to circuit objects

**Template:**
- **File:** `templates/eeprom.html`
- Board control UI elements and channel selectors

#### Channel Structure:
- 8 Multiplexers (A-H) × 16 Channels (0-15) = 128 total positions
- Each channel can hold one component (promoter, RBS, CDS, etc.)
- Channel format: `{mux}{channel}` (e.g., "A0", "B5", "H15")

---

### Component Parsing & Population

#### Where to Look:

**Parsing Hardware Data:**
- **File:** `circuit_model.py`
- **Method:** `parse_channels()` (starts around line 100)
  ```python
  def parse_channels(self, channels_data: Dict[str, Any]) -> List[Dict]:
      # Converts raw channel data into circuit structures
      # Groups components by multiplexer
      # Identifies circuit boundaries (promoter → terminator)
  ```

**Populating Component Properties:**
- **File:** `circuit_model.py`
- **Class:** `Component` (line ~15)
  - Stores: type, label, channel, mux_chr, constants, strength
  - Determines if component is a regulator
  - Extracts position info (start/end) from labels

**Adding Components to UI:**
- **File:** `static/js/eeprom.js`
  - Component palette definitions (line ~100-500)
  - Drag-and-drop handlers (line ~1500-2000)
  - Channel population logic (line ~2500-3000)

**Component Types Recognized:**
- Promoters, RBS, CDS, Terminators
- Regulators: Activators, Repressors, Inducers, Inhibitors
- Special: Origins, Resistances

---

### Connector System

#### Where to Look:

**Visual Connectors (jsPlumb):**
- **File:** `static/js/script.js`
- **Library:** jQuery jsPlumb (`static/vendor/jquery.jsPlumb-1.7.11-min.js`)
- **Key Sections:**
  - Connection initialization (search for `jsPlumb.connect`)
  - Connection validation (search for `beforeDrop`)
  - Connection styling (search for `paintStyle`)

**Logical Connections (Circuit Flow):**
- **File:** `circuit_model.py`
- **Method:** `build_circuit_structure()`
  - Determines component order in circuit
  - Links promoters → RBS → CDS → terminators
  - Establishes regulatory connections

**Regulation Connections:**
- **File:** `circuit_model.py`
- **Method:** `build_regulations()` (line ~600-800)
  - Maps activators/repressors to target promoters
  - Determines regulation type (activation/repression)
  - Handles self-regulation vs cross-regulation

**Connection Rules:**
- Promoter → RBS → CDS → Terminator (sequential)
- Regulators connect to promoters (regulatory)
- Floating regulators can target any promoter
- Position-specific regulators (start/end) target specific genes

---

### Dynamic Parameters & Equation System

#### Where to Look:

**Parameter Definitions:**
- **File:** `constants.py`
  - Default values for all components
  - Organized by component type

**Parameter Updates from UI:**
- **File:** `app.py`
- **Endpoint:** `/api/simulate` (line ~165-500)
  - Receives `dynamic_parameters` from frontend
  - Applies to circuit simulation

**Equation Generation:**
- **File:** `app.py`
- **Function:** `generate_equation_display()` (line ~19-139)
  - Creates LaTeX representations
  - Uses actual parameter values from regulations

**Simulation with Parameters:**
- **File:** `circuit_model.py`
- **Function:** `simulate_circuit()` (line ~900-1080)
  - ODE system using scipy.integrate.odeint
  - Applies dynamic parameters to differential equations

---

## Common Issues & Troubleshooting

###  Issue 1: Dynamic Parameter Updates Not Reflecting in Equations

**Symptom:** You update a parameter value in the UI (e.g., Kd, hill coefficient), but the equation display or simulation doesn't change.

**Root Causes & Solutions:**

1. **Parameters Not Passed to Backend**
   - **Check:** `static/js/script.js` or `static/js/eeprom.js`
   - **Look for:** AJAX call to `/api/simulate`
   - **Verify:** `dynamic_parameters` object includes your parameter
   ```javascript
   const requestData = {
       circuits: circuitData,
       dynamic_parameters: dynamicParams, // ← Must be present
       // ...
   };
   ```

2. **Parameter Not Applied in Simulation**
   - **Check:** `circuit_model.py` → `simulate_circuit()` function
   - **Look for:** Where parameters are extracted and used
   - **Fix:** Ensure your parameter is read from `dynamic_parameters` dict
   ```python
   # Example:
   Kd = reg.get('parameters', {}).get('Kd', 5.0)  # Use dynamic value
   ```

3. **Equation Display Not Using Dynamic Values**
   - **Check:** `app.py` → `generate_equation_display()` function
   - **Problem:** May be using default constants instead of dynamic values
   - **Fix:** Pass `dynamic_parameters` to equation generator
   - **Line to check:** ~19-139 in app.py

4. **Parameter Name Mismatch**
   - Frontend sends: `"hill_coefficient"` 
   - Backend expects: `"n"`
   - **Solution:** Ensure consistent naming in both frontend and backend

**Debugging Steps:**
```python
# Add to app.py in /api/simulate endpoint:
print("Received dynamic_parameters:", request.json.get('dynamic_parameters'))

# Add to circuit_model.py in simulate_circuit():
print("Using Kd value:", Kd)
print("Using hill coefficient:", n)
```

---

###  Issue 2: Component Not Appearing in EEPROM Mode

**Symptom:** Component placed on channel but doesn't show up in circuit.

**Check:**
1. **Channel Data Format** - `static/js/eeprom.js`
   - Ensure channel data structure is correct:
   ```javascript
   {
       "A0": {
           "component": "promoter_1",
           "strength": "norm"  // Optional
       }
   }
   ```

2. **Parser Recognition** - `circuit_model.py` → `parse_channels()`
   - Verify component label matches expected patterns
   - Check `_infer_type()` method recognizes your component

3. **Constants Definition** - `constants.py`
   - Ensure component has entry in `COMPONENT_CONSTANTS`
   ```python
   "promoter_1": {"strength": 5.0, "type": "promoter"}
   ```

---

###  Issue 3: Regulation Not Working

**Symptom:** Activator/repressor doesn't affect target protein expression.

**Check:**
1. **Regulation Detection** - `circuit_model.py` → `build_regulations()`
   - Verify regulator position (start/end) matches target gene
   - Check floating vs positional regulator logic

2. **Regulation Parameters** - `constants.py`
   - Ensure regulator has Kd and n values defined
   ```python
   "repressor_start_1": {
       "Kd": 5.0,
       "n": 2,
       "type": "repressor"
   }
   ```

3. **Equation Application** - `circuit_model.py` → `simulate_circuit()`
   - Verify Hill function is applied in ODE system
   - Check for correct repression/activation formula

---

###  Issue 4: jsPlumb Connections Not Showing

**Symptom:** Components placed but visual connections missing.

**Check:**
1. **jsPlumb Initialization** - `static/js/script.js`
   - Ensure `jsPlumb.ready()` is called
   - Check container is set: `jsPlumb.setContainer()`

2. **Component IDs** - HTML elements must have unique IDs
   - Format: `component_${type}_${index}`

3. **Connection Timing** - Connections created after DOM ready
   - Use `setTimeout()` if needed for async rendering

---

###  Issue 5: Export Not Including Plots

**Symptom:** Exported ZIP missing simulation plots.

**Check:**
- **File:** `app.py` → `/api/export_project` (line ~200-400)
- **Issue:** Plot generation may fail silently
- **Debug:** Check matplotlib backend is 'Agg'
```python
import matplotlib
matplotlib.use('Agg')  # Must be before pyplot import
```

---

## Development Workflow

### Adding a New Component Type

1. **Add to constants.py**
   ```python
   "new_component_1": {
       "parameter1": value,
       "type": "new_component"
   }
   ```

2. **Update circuit_model.py**
   - Add recognition in `Component._infer_type()`
   - Handle in `parse_channels()` if needed

3. **Update frontend**
   - Add to component palette in `eeprom.js` or `script.js`
   - Add CSS styling in relevant CSS file

### Adding a New Parameter

1. **Frontend:** Add UI control (slider, input, etc.)
2. **Frontend:** Include in `dynamic_parameters` object
3. **Backend:** Extract in `/api/simulate` endpoint
4. **Backend:** Apply in `simulate_circuit()` ODE system
5. **Backend:** Use in `generate_equation_display()`

### Testing Changes

1. **Start server:** `python main.py`
2. **Check console:** Look for Python errors
3. **Browser console:** Check for JavaScript errors
4. **Network tab:** Verify API calls sending correct data
5. **Print debugging:** Add print statements in Python

---

## Unused Files (Safe to Delete)

### Backups:
- `about.html` (root) - use `templates/about.html`
- `about.css` (root) - use `static/css/about.css`
- `templates/dial.html.bak`, `templates/dial.html.bak2`
- `static/css/*.backup`, `static/css/*.bak`
- `static/js/script_backup.js`, `static/js/eeprom.js.backup`

### Standalone Scripts (Not Part of Application):
- `circuit_analysis.py` - Visualization utility
- `comment_strength_menus.py` - One-time HTML modifier

### Unused JSON Files:
- `circuit_configs.json`
- `ontology_output_adjusted.json`
- `constants_realistic_ordered.json`

---

## Quick Reference

### File Sizes (Complexity)
- `app.py`: 1,261 lines
- `circuit_model.py`: 1,080 lines
- `eeprom.js`: 3,741 lines
- `script.js`: Large (main designer)

### Tech Stack
- **Backend:** Flask, NumPy, Matplotlib, SciPy
- **Frontend:** jQuery, jsPlumb, Bootstrap
- **Math:** LaTeX (KaTeX for rendering)

### Ports
- Default: 8000 (set in `main.py`)
- Configurable via PORT environment variable

---

## Backend Circuit Calculation Deep Dive

### Overview of Circuit Simulation Engine

The circuit simulation uses **Ordinary Differential Equations (ODEs)** to model protein expression over time, incorporating:
- Transcription (DNA → RNA)
- Translation (RNA → Protein)
- Protein degradation
- Regulatory interactions (activation/repression)
- Hill functions for cooperative binding

---

### Mathematical Foundation

#### Basic Gene Expression ODE

For a simple constitutive gene (no regulation):

```
d[Protein]/dt = k_prod - γ * [Protein]
```

Where:
- `k_prod` = production rate (depends on promoter strength, RBS efficiency)
- `γ` = degradation rate
- `[Protein]` = protein concentration

#### With Regulation

For regulated genes, the production term is modified by Hill functions:

**Repression:**
```
d[Protein]/dt = k_prod * (Kr^n / (Kr^n + [Repressor]^n)) - γ * [Protein]
```

**Activation:**
```
d[Protein]/dt = k_prod * ([Activator]^n / (Ka^n + [Activator]^n)) - γ * [Protein]
```

Where:
- `n` = Hill coefficient (cooperativity, typically 2-4)
- `Kr` = Repression dissociation constant
- `Ka` = Activation dissociation constant

---

### Code Structure: Circuit Calculation Flow

#### Location: `circuit_model.py`

**Main Classes:**

1. **`Component` class** (Lines 13-120)
   - Represents single genetic part (promoter, RBS, CDS, etc.)
   - Stores parameters from `constants.py`
   - Identifies regulator type and position

2. **`OntologyBuilderUnified` class** (Lines 122-800)
   - Parses circuits from input data
   - Builds regulatory network
   - Detects errors and misplacements

3. **`simulate_circuit()` function** (Lines 802-1080)
   - Sets up and solves ODEs
   - Generates plots
   - Returns simulation results

---

### Detailed Function Explanations

#### 1. Component Initialization (`Component.__init__`)

**Location:** `circuit_model.py` lines 15-45

**Purpose:** Create a component object with all necessary parameters

**Process:**
```python
def __init__(self, raw_label, channel, mux_chr, constants, strength='norm'):
    self.label = raw_label.strip()
    self.type = self._infer_type(self.label)  # promoter, rbs, cds, etc.
    self.channel = channel                     # 0-15
    self.mux_chr = mux_chr                     # A-H
    self.global_idx = (ord(mux_chr) - ord('A')) * 16 + channel  # 0-127
    self.id = f"{self.type}_{mux_chr}{channel}"
    self.strength = strength
    self.constants = constants.get(self.label, {})
    self.is_regulator = self.type in ("activator", "repressor", "inducer", "inhibitor")
```

**Key Operations:**
1. Parse label to determine component type
2. Calculate global position in 128-channel grid
3. Load constants from `constants.py`
4. Identify if component is a regulator

---

#### 2. Type Inference (`Component._infer_type`)

**Location:** `circuit_model.py` lines 75-113

**Purpose:** Determine component type from label string

**Logic:**
```python
def _infer_type(self, label):
    lc = label.lower()
    if "promoter" in lc or lc.startswith("p"):
        return "promoter"
    elif "rbs" in lc:
        return "rbs"
    elif "cds" in lc or "gene" in lc:
        return "cds"
    # ... more patterns
```

**Supports:**
- Standard names: `promoter_1`, `rbs_a`, `cds_2`
- Short forms: `p1`, `r2`, `g3`
- Regulator patterns: `repressor_start_1`, `activator_b_end`

---

#### 3. Circuit Parsing (`OntologyBuilderUnified.parse_text_file`)

**Location:** `circuit_model.py` lines 155-230

**Purpose:** Convert hardware channel data into component list

**Input Format:**
```
MUX A, Channel 0: ['promoter_1'] strength=norm
MUX A, Channel 1: ['rbs_1'] strength=norm
MUX A, Channel 2: ['cds_1'] strength=norm
MUX A, Channel 3: ['terminator_1'] strength=norm

MUX B, Channel 0: ['promoter_2'] strength=high
...
```

**Process:**
1. Parse each line with regex
2. Extract component name, MUX letter, channel number
3. Create `Component` objects
4. Insert `None` on empty lines (circuit boundaries)
5. Register regulators for later analysis

**Circuit Breaking Rules:**
- Empty line → circuit boundary
- New promoter after CDS → start new circuit

---

#### 4. Circuit Building (`OntologyBuilderUnified.build`)

**Location:** `circuit_model.py` lines 232-247

**Purpose:** Group components into valid circuits

**Process:**
```python
def build(self):
    block = []
    for item in self.items + [None]:
        if item is None:
            if block:
                self._finalize_block(block)  # Process complete circuit
                block = []
            continue
        block.append(item)
    
    self._detect_unpaired_regulators()
    self._build_regulations()
    self._add_constitutive_regulations()
```

**Steps:**
1. Group components between `None` markers
2. Finalize each block as a circuit
3. Detect regulator issues
4. Build regulation network
5. Add constitutive regulations

---

#### 5. Block Finalization (`OntologyBuilderUnified._finalize_block`)

**Location:** `circuit_model.py` lines 249-330

**Purpose:** Validate and configure a single circuit

**Process:**

```python
def _finalize_block(self, comps):
    # 1. Assign parameters from constants
    for comp in comps:
        params = self.constants.get(comp.label, {})
        if comp.type == "promoter":
            comp.parameters["strength"] = params.get("strength", 1.0)
        elif comp.type == "rbs":
            comp.parameters["efficiency"] = params.get("efficiency", 1.0)
        elif comp.type == "cds":
            comp.parameters["translation_rate"] = params.get("translation_rate", 5.0)
            comp.parameters["degradation_rate"] = params.get("degradation_rate", 0.1)
    
    # 2. Skip if no CDS (incomplete circuit)
    if not any(c.type == "cds" for c in comps):
        return
    
    # 3. Assign circuit name and register components
    name = f"circuit_{len(self.circuits) + 1}"
    for c in comps:
        c.circuit_name = name
    
    # 4. Detect misplaced components
    # - Promoter after CDS
    # - RBS after CDS
    # - Terminator before CDS
    
    # 5. Store circuit structure
    self.circuits.append({
        "name": name,
        "components": [comp.to_dict() for comp in comps]
    })
```

**Validation Checks:**
- Must have at least one CDS
- Components in correct order
- No duplicate promoters
- No extra RBS beyond what's needed

---

#### 6. Regulation Detection (`OntologyBuilderUnified._build_regulations`)

**Location:** `circuit_model.py` lines 450-650

**Purpose:** Determine which regulators affect which promoters

**Logic:**

```python
def _build_regulations(self):
    for reg_key, reg_data in self.regulators.items():
        starts = reg_data["starts"]
        ends = reg_data["ends"]
        reg_type = reg_data["type"]
        
        # Case 1: Floating regulator (affects all promoters)
        if reg_data["is_floating"]:
            for circuit in self.circuits:
                for comp in circuit["components"]:
                    if comp["type"] == "promoter":
                        self.regulations.append({
                            "source": starts[0].label,
                            "target": comp["name"],
                            "type": f"environmental_{reg_type}"
                        })
        
        # Case 2: Positional regulator (start/end genes)
        else:
            # Extract gene identifier from regulator name
            gene_id = extract_gene_from_regulator(reg_key)
            
            # Find CDS with matching gene
            for circuit in self.circuits:
                cds_list = [c for c in circuit["components"] if c["type"] == "cds"]
                
                for i, cds in enumerate(cds_list):
                    if matches_gene(cds["name"], gene_id):
                        # Determine target based on position
                        if "start" in reg_key:
                            target_promoter = find_promoter_before(cds)
                        elif "end" in reg_key:
                            target_promoter = find_promoter_after(cds)
                        
                        # Add regulation
                        self.regulations.append({
                            "source": cds["name"],  # CDS produces the regulator
                            "target": target_promoter,
                            "type": f"transcriptional_{reg_type}",
                            "parameters": {
                                "Kd": self.constants.get(starts[0].label, {}).get("Kd", 5.0),
                                "n": self.constants.get(starts[0].label, {}).get("n", 2)
                            }
                        })
```

**Regulator Types:**

1. **Floating Regulator** (`floating_repressor`)
   - No gene assignment
   - Affects ALL promoters in system
   - Used for environmental controls

2. **Positional Regulator** (`repressor_start_1`, `activator_end_2`)
   - Linked to specific gene
   - `start` → regulates promoter BEFORE gene
   - `end` → regulates promoter AFTER gene
   - Extracts gene ID from name pattern

3. **Self-Regulation**
   - Detected when source CDS = target promoter's CDS
   - Type becomes `self_repression` or `self_activation`

---

#### 7. ODE System Setup (`simulate_circuit` function)

**Location:** `circuit_model.py` lines 802-950

**Purpose:** Prepare differential equations for numerical solving

**Process:**

```python
def simulate_circuit(builder, dynamic_parameters=None):
    # 1. Extract all CDS (proteins to simulate)
    cds_list = []
    for circuit in builder.circuits:
        for comp in circuit["components"]:
            if comp["type"] == "cds":
                cds_list.append(comp["id"])
    
    # 2. Build parameter dictionary for each protein
    cds_params = {}
    for cds_id in cds_list:
        comp = id2comp[cds_id]
        
        # Get promoter and RBS affecting this CDS
        promoter = find_upstream_promoter(comp)
        rbs = find_upstream_rbs(comp)
        
        # Calculate production rate
        k_prod = (promoter["strength"] * 
                  rbs["efficiency"] * 
                  comp["translation_rate"])
        
        cds_params[cds_id] = {
            "k0": 0.0,  # Basal rate
            "kprod": k_prod,  # Regulated production
            "degradation": comp["degradation_rate"],
            "initial_conc": comp.get("init_conc", 0.01)
        }
    
    # 3. Build regulation map
    reg_map = defaultdict(list)
    for reg in builder.regulations:
        target_promoter = reg["target"]
        # Find CDS controlled by this promoter
        target_cds = find_cds_controlled_by(target_promoter)
        reg_map[target_cds].append(reg)
    
    # 4. Define ODE right-hand side
    def rhs(p, t):
        dpdt = np.zeros(len(p))
        
        for i, cds_id in enumerate(cds_list):
            pars = cds_params[cds_id]
            
            # Get regulations affecting this protein
            regs = reg_map[cds_id]
            
            # Calculate Hill functions
            f_vals = []
            for reg in regs:
                source_cds = reg["source"]
                source_idx = cds_list.index(source_cds)
                source_conc = p[source_idx]
                
                Kd = reg["parameters"]["Kd"]
                n = reg["parameters"]["n"]
                
                if "repression" in reg["type"]:
                    # Repression Hill function
                    hill = Kd**n / (Kd**n + source_conc**n)
                elif "activation" in reg["type"]:
                    # Activation Hill function
                    hill = source_conc**n / (Kd**n + source_conc**n)
                
                f_vals.append(hill)
            
            # Combine all regulations (multiply)
            f_total = np.prod(f_vals) if f_vals else 1.0
            
            # Compute rate of change
            dpdt[i] = pars["k0"] + pars["kprod"] * f_total - pars["degradation"] * p[i]
        
        return dpdt
    
    return rhs
```

**Key Concepts:**

1. **Production Rate Calculation:**
   ```
   k_prod = promoter_strength × RBS_efficiency × translation_rate
   ```

2. **Hill Function (Repression):**
   ```python
   hill = Kr^n / (Kr^n + [Repressor]^n)
   ```
   - When [Repressor] = 0 → hill = 1.0 (no repression)
   - When [Repressor] >> Kr → hill ≈ 0 (full repression)

3. **Hill Function (Activation):**
   ```python
   hill = [Activator]^n / (Ka^n + [Activator]^n)
   ```
   - When [Activator] = 0 → hill = 0 (no production)
   - When [Activator] >> Ka → hill ≈ 1.0 (full activation)

4. **Multiple Regulations:**
   - Combined by multiplication: `f_total = f1 × f2 × f3 × ...`
   - Represents AND logic (all conditions must be satisfied)

---

#### 8. Numerical Integration (`odeint` solver)

**Location:** `circuit_model.py` lines 950-980

**Purpose:** Solve ODEs over time

```python
# Initial conditions
p0 = np.array([cds_params[cds]["initial_conc"] for cds in cds_list])

# Time points (0 to 24 hours, 200 samples)
t = np.linspace(0, 24, 200)

# Solve using scipy's odeint
from scipy.integrate import odeint
solution = odeint(rhs, p0, t)

# solution shape: (200 time points, N proteins)
```

**What `odeint` does:**
1. Starts at initial concentrations `p0`
2. Evaluates `rhs` function at each time step
3. Uses adaptive step size for accuracy
4. Returns protein concentrations at each time point

**Special Cases:**

- **Repressilator (oscillating system):**
  - Breaks symmetry in initial conditions
  - Uses different starting values: `[1.0, 0.1, 0.05]`
  - Ensures oscillations develop

- **Constitutive circuits:**
  - Equal initial values: `[0.01, 0.01, 0.01]`
  - Reaches steady state

---

#### 9. Plot Generation

**Location:** `circuit_model.py` lines 982-1045

**Purpose:** Create visualization of results

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(10, 6))

# Plot each protein
for i, cds_id in enumerate(cds_list):
    protein_name = display_names[i]
    concentrations = solution[:, i]
    
    ax.plot(t, concentrations, label=protein_name, linewidth=2)

ax.set_xlabel("Time (hours)")
ax.set_ylabel("Concentration (μM)")
ax.legend()
ax.grid(True)

# Convert to base64 for web display
import io, base64
buffer = io.BytesIO()
fig.savefig(buffer, format='png', dpi=150)
buffer.seek(0)
plot_base64 = base64.b64encode(buffer.read()).decode()
```

**Features:**
- Different colors per circuit
- Noise added for visual separation (constitutive circuits)
- Legend with protein names
- Grid for readability

---

## Complete Control Flow Diagrams

### Flow 1: User Clicks "Simulate" Button

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Click "Simulate" Button                    │
│    Location: templates/dial.html or templates/eeprom.html  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. JAVASCRIPT: Collect Circuit Data                        │
│    File: static/js/script.js or static/js/eeprom.js        │
│    Function: simulateCircuit() or similar                  │
│                                                             │
│    Actions:                                                 │
│    - Gather all placed components                          │
│    - Extract connections/regulations                       │
│    - Collect dynamic parameters (Kd, n, strengths)         │
│    - Build JSON payload                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. AJAX REQUEST: POST to /api/simulate                     │
│    Payload:                                                 │
│    {                                                        │
│      "circuits": [...],                                     │
│      "dynamic_parameters": {...},                          │
│      "mode": "hardware" or "software"                       │
│    }                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. FLASK ENDPOINT: /api/simulate                           │
│    File: app.py                                             │
│    Line: ~165-500                                           │
│                                                             │
│    Actions:                                                 │
│    - Parse JSON request                                    │
│    - Extract circuits and parameters                       │
│    - Load COMPONENT_CONSTANTS from constants.py            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. CREATE BUILDER: OntologyBuilderUnified                  │
│    File: circuit_model.py                                  │
│    Line: ~122                                               │
│                                                             │
│    builder = OntologyBuilderUnified(COMPONENT_CONSTANTS)   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. PARSE CIRCUITS: builder.parse_text_file()               │
│    File: circuit_model.py                                  │
│    Line: ~155-230                                           │
│                                                             │
│    For each component line:                                │
│    - Extract component name, MUX, channel                  │
│    - Create Component object                               │
│    - Register regulators                                   │
│    - Detect circuit boundaries                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. BUILD CIRCUITS: builder.build()                         │
│    File: circuit_model.py                                  │
│    Line: ~232-247                                           │
│                                                             │
│    Steps:                                                   │
│    a. Group components into blocks                         │
│    b. For each block: _finalize_block()                    │
│       - Validate circuit structure                         │
│       - Assign parameters from constants                   │
│       - Detect errors/misplacements                        │
│    c. _detect_unpaired_regulators()                        │
│    d. _build_regulations()                                 │
│       - Match regulators to targets                        │
│       - Create regulation objects                          │
│    e. _add_constitutive_regulations()                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. APPLY DYNAMIC PARAMETERS                                │
│    File: app.py                                             │
│    Line: ~300-400                                           │
│                                                             │
│    Override default parameters with user values:           │
│    - Promoter strengths                                    │
│    - Regulator Kd values                                   │
│    - Hill coefficients (n)                                 │
│    - Degradation rates                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. SIMULATE: simulate_circuit(builder, dynamic_params)     │
│    File: circuit_model.py                                  │
│    Line: ~802-1080                                          │
│                                                             │
│    Steps:                                                   │
│    a. Extract all CDS (proteins)                           │
│    b. Build parameter dict for each protein                │
│    c. Create regulation map                                │
│    d. Define ODE system (rhs function)                     │
│    e. Set initial conditions                               │
│    f. Call scipy.odeint(rhs, p0, t)                        │
│    g. Generate matplotlib plot                             │
│    h. Convert plot to base64                               │
│    i. Prepare time series data                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. GENERATE EQUATIONS: generate_equation_display()        │
│     File: app.py                                            │
│     Line: ~19-139                                           │
│                                                             │
│     For each protein:                                       │
│     - Find controlling promoter                            │
│     - Find affecting regulations                           │
│     - Build LaTeX equation string                          │
│     - Include actual parameter values                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. RETURN RESULTS: JSON Response                          │
│     File: app.py                                            │
│                                                             │
│     {                                                       │
│       "status": "success",                                  │
│       "plot": "base64_image_data",                         │
│       "time_series": {...},                                │
│       "equations": {...},                                  │
│       "circuits": [...],                                   │
│       "regulations": [...],                                │
│       "warnings": [...],                                   │
│       "errors": []                                         │
│     }                                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. JAVASCRIPT: Display Results                            │
│     File: static/js/script.js or eeprom.js                 │
│                                                             │
│     Actions:                                                │
│     - Render plot image                                    │
│     - Display LaTeX equations (via KaTeX)                  │
│     - Show time series data                                │
│     - Display warnings/errors                              │
│     - Update UI with final concentrations                  │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Hardware EEPROM Mode - Channel Population

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Drag Component to Channel                  │
│    Location: templates/eeprom.html                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. JAVASCRIPT: Handle Drop Event                           │
│    File: static/js/eeprom.js                               │
│    Line: ~1500-2000                                        │
│                                                             │
│    - Get component type from dragged element               │
│    - Get target channel (MUX + Channel number)             │
│    - Validate placement rules                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. UPDATE STATE: eepromState object                        │
│    File: static/js/eeprom.js                               │
│    Line: ~100-500                                          │
│                                                             │
│    eepromState.channels["A0"] = {                          │
│      component: "promoter_1",                              │
│      strength: "norm"                                      │
│    }                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. UPDATE UI: Render component in channel                  │
│    File: static/js/eeprom.js                               │
│                                                             │
│    - Create visual representation                          │
│    - Add to channel display                                │
│    - Update channel counter                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ (User continues adding components)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. USER ACTION: Click "Run Simulation"                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. JAVASCRIPT: Build Hardware Format                       │
│    File: static/js/eeprom.js                               │
│    Line: ~2500-3000                                        │
│                                                             │
│    Convert channel state to text format:                   │
│    "MUX A, Channel 0: ['promoter_1'] strength=norm"        │
│    "MUX A, Channel 1: ['rbs_1'] strength=norm"             │
│    ""  <- empty line = circuit boundary                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. CONTINUE: Same as Simulation Flow from step 3           │
│    (POST to /api/simulate)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Parameter Update Not Reflecting

**Problem:** User changes Kd slider but equation doesn't update

```
BROKEN FLOW:

User adjusts Kd slider
    │
    ▼
JavaScript updates local variable
    │
    ▼
Simulate button clicked
    │
    ▼
AJAX request sent
    │
    ▼
Backend receives request
    │
    ▼
dynamic_parameters NOT included in request  ← PROBLEM
    │
    ▼
Simulation uses default Kd from constants.py
    │
    ▼
Equation generated with default value
```

```
 CORRECT FLOW:

User adjusts Kd slider
    │
    ▼
JavaScript updates dynamicParameters object  ← Key step
    │
    ▼
Simulate button clicked
    │
    ▼
Build request with dynamic_parameters included
    │
    ▼
POST /api/simulate with:
{
  "circuits": [...],
  "dynamic_parameters": {
    "repressor_1_Kd": 2.5,  ← User's value
    "hill_coefficient": 3
  }
}
    │
    ▼
Backend extracts dynamic_parameters
    │
    ▼
Override default constants with dynamic values
    │
    ▼
simulate_circuit() uses overridden values
    │
    ▼
generate_equation_display() uses overridden values
    │
    ▼
Results reflect user's parameters
```

**Fix Locations:**

1. **Frontend:** `static/js/script.js` or `eeprom.js`
   - Ensure parameter changes update `dynamicParameters` object
   - Include in AJAX payload

2. **Backend:** `app.py` line ~300-400
   - Extract `dynamic_parameters` from request
   - Apply to builder before simulation

3. **Equation Generator:** `app.py` line ~19-139
   - Access dynamic parameters
   - Use in LaTeX generation

---

### Flow 4: Export Project

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Click "Export Project"                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. JAVASCRIPT: Collect All Data                            │
│    File: static/js/script.js or eeprom.js                  │
│                                                            │
│    - Current circuit design                                │
│    - Component placements                                  │
│    - Parameter values                                      │
│    - Regulation settings                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. POST to /api/export_project                             │
│    File: app.py                                             │
│    Line: ~200-400                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RUN SIMULATION: simulate_circuit()                      │
│    (Same as simulation flow)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. CREATE ZIP ARCHIVE                                      │
│    File: app.py                                            │
│                                                            │
│    Using zipfile module:                                   │
│    - Add circuit_data.json                                 │
│    - Add simulation_plot.png                               │
│    - Add equations.txt                                     │
│    - Add parameters.json                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. RETURN ZIP FILE: send_file()                             │
│    Flask sends ZIP as download                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. BROWSER: Download ZIP                                    │
│    User saves exported project                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Parameter Precedence Chain

Understanding where parameter values come from:

```
┌─────────────────────────────────────────────────────────────┐
│ LOWEST PRIORITY                                             │
│                                                             │
│ 1. Hardcoded Defaults in Code                              │
│    circuit_model.py: Kd=5.0, n=2, etc.                     │
│                                                             │
│         ↓ Overridden by                                    │
│                                                             │
│ 2. constants.py - COMPONENT_CONSTANTS                      │
│    "repressor_1": {"Kd": 3.5, "n": 2}                      │
│                                                             │
│         ↓ Overridden by                                    │
│                                                             │
│ 3. User's Dynamic Parameters (UI Sliders/Inputs)           │
│    dynamic_parameters = {"repressor_1_Kd": 2.0}            │
│                                                             │
│ HIGHEST PRIORITY                                            │
└─────────────────────────────────────────────────────────────┘
```

**To change a parameter:**
1. **Temporary (current session):** Use UI sliders → dynamic_parameters
2. **Permanent (default):** Edit `constants.py`
3. **Fallback:** Change hardcoded default in `circuit_model.py`

---

## Support Documentation

- `README.md` - User-facing setup instructions
- `USER_GUIDE.md` - Beginner installation guide
- `Doc/CODEBASE_ARCHITECTURE.md` - Architecture overview 

---

**Last Updated:** December 9, 2025
**Version:** 17.1

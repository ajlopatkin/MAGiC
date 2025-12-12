# MAGiC - Genetic Circuit Designer - Codebase Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [File Organization](#file-organization)
4. [Core Components Deep Dive](#core-components-deep-dive)
5. [Data Flow](#data-flow)
6. [Key Algorithms](#key-algorithms)
7. [Frontend-Backend Integration](#frontend-backend-integration)

---

## Overview

MAGiC (Modular Automated Genetic Circuit) is a web-based genetic circuit designer that allows users to visually design, simulate, and analyze genetic circuits. The system combines a drag-and-drop interface with sophisticated biological modeling to predict circuit behavior using ordinary differential equations (ODEs).

**Tech Stack:**
- **Backend**: Flask (Python 3.x), NumPy, SciPy, Matplotlib
- **Frontend**: HTML5, CSS3 (Bootstrap 5), JavaScript (jQuery, jsPlumb)
- **Modeling**: ODE-based genetic circuit simulation with Hill kinetics
- **Hardware Integration**: EEPROM-based component storage and retrieval

## File Organization

### Core Backend Files

#### **1. app.py** (1117 lines)
**Purpose**: Flask application entry point and request routing

**Key Responsibilities**:
- Route handling (`/`, `/simulate`, `/dial`, `/eeprom`, `/about`)
- Data transformation (cellboard → hardware format)
- Parameter adjustment from dial controls
- Hardware log interpretation
- Project export functionality

**Critical Functions**:
```python
@app.route('/simulate', methods=['POST'])
def simulate():
    # Main simulation endpoint
    # Converts cellboard → hardware format → circuit model → ODE solution
    
def generate_equation_display(builder, result):
    # Generates LaTeX representations of circuit ODEs
    
def parse_hardware_log(log_lines):
    # Parses EEPROM hex data to extract component information
    
def convert_hardware_to_cellboard(channel_data):
    # Maps hardware positions to visual board coordinates
```

---

#### **2. circuit_model.py** (1064+ lines)
**Purpose**: Core circuit modeling and ontology building

**Key Classes**:

##### **Component Class**
Represents a single genetic circuit component with its properties:
```python
class Component:
    def __init__(self, label, type_str, mux, channel, strength="norm"):
        self.label = label           # e.g., "promoter_1"
        self.type = type_str          # promoter, rbs, cds, terminator
        self.mux = mux                # Hardware MUX identifier
        self.channel = channel        # Hardware channel number
        self.strength = strength      # norm/high/low
        self.parameters = {}          # Filled from constants.py
        self.is_regulator = False     # True for start/end elements
        self.position = None          # "start" or "end"
        self.reg_key = None          # Unique regulator identifier
        self.circuit_name = None     # Assigned circuit membership
        self.global_idx = None       # Position in component sequence
```

**Component Types**:
- **Structural**: `promoter`, `rbs`, `cds`, `terminator`
- **Regulatory**: `activator_start/end`, `repressor_start/end`, `inducer_start/end`, `inhibitor_start/end`

---

##### **OntologyBuilderUnified Class**
Main circuit builder and analyzer:

```python
class OntologyBuilderUnified:
    def __init__(self, constants):
        self.constants = constants           # Component parameters
        self.items = []                      # All parsed components
        self.circuits = []                   # Valid circuit blocks
        self.regulations = []                # Regulatory relationships
        self.regulators = defaultdict(...)   # Regulator tracking
        self.unpaired_regulators = []        # Validation issues
        self.extra_components_found = {}     # Misplaced/extra components
```

**Key Methods**:

1. **`parse_text_file(lines)`**
   - Parses hardware format text lines
   - Creates Component objects
   - Detects regulators vs structural components
   ```python
   # Example input:
   # MUX A, Channel 0: ['promoter_1']
   # MUX A, Channel 1: ['repressor_a_start'] 
   # MUX A, Channel 2: ['rbs_1'] 
   # MUX A, Channel 3: ['cds_1'] 
   # MUX A, Channel 4: ['repressor_a_end'] 
   # MUX A, Channel 5: ['terminator_1'] 
   ```

2. **`build()`**
   - Groups components into circuits
   - Detects regulatory networks
   - Validates circuit structure
   - Assigns parameters from constants
   
3. **`_finalize_block(components)`**
   - Assigns parameters to each component from `constants.py`
   - Validates component ordering (Promoter → RBS → CDS → Terminator)
   - Detects extra/misplaced components
   - Generates fallback parameters for incomplete circuits
   
4. **`_build_regulations()`**
   - Pairs regulator start/end elements
   - Determines regulatory targets (which CDS are affected)
   - Classifies regulation types (activation, repression, self-regulation)
   - Creates regulation records with Hill coefficients

5. **`_validate_rbs_sequence_patterns()`**
   - Detects invalid RBS sequences (e.g., rbs-rbs-cds-cds)
   - Validates alternating (rbs-cds-rbs-cds) or grouped patterns (rbs-cds-cds-cds)

---

#### **3. constants.py** (118 lines)
**Purpose**: Biological parameter definitions

**Structure**:
```python
COMPONENT_CONSTANTS = {
    "promoter_1": {
        "strength": 5.0,              # Transcription rate
        "type": "promoter"
    },
    "rbs_1": {
        "efficiency": 1.0,            # Translation efficiency
        "type": "rbs"
    },
    "cds_1": {
        "degradation_rate": 1.0,      # Protein degradation (γ)
        "translation_rate": 7.0,      # mRNA → Protein rate
        "init_conc": 0.0,            # Initial protein concentration
        "type": "cds"
    },
    "repressor_a": {
        "Kr": 0.5,                    # Repression threshold
        "n": 2,                       # Hill coefficient
        "type": "repressor",
        "is_floating": False          # External vs circuit-encoded
    }
}
```

**Parameter Types**:
- **Promoter**: `strength` (transcription rate)
- **RBS**: `efficiency`, `translation_rate`
- **CDS**: `translation_rate`, `degradation_rate`, `init_conc`, `max_expression`
- **Terminator**: `efficiency` (termination strength)
- **Repressor**: `Kr` (repression threshold), `n` (cooperativity)
- **Activator**: `Ka` (activation threshold), `n` (cooperativity)

---

#### **4. circuit_analysis.py** (284 lines)
**Purpose**: Standalone circuit simulation and visualization

**Main Function**: `simulate_circuit(builder)`
- Builds ODE system from circuit structure
- Implements Hill kinetics for regulation
- Solves ODEs using SciPy's `odeint`
- Generates matplotlib plots
- Returns base64-encoded plot images

**ODE Implementation**:
```python
def rhs(p, t):
    """Right-hand side of protein ODEs"""
    dpdt = np.zeros(len(cds_list))
    
    for i, cds_id in enumerate(cds_list):
        pars = cds_params[cds_id]
        
        # Base production: k0 + kprod * regulation_factor
        # Degradation: -γ * [Protein]
        
        # Hill function for repression:
        # f_rep = Kr^n / (Kr^n + [Repressor]^n)
        
        # Hill function for activation:
        # f_act = [Activator]^n / (Ka^n + [Activator]^n)
        
        f_prod = product_of_all_regulation_factors
        dpdt[i] = pars["k0"] + pars["kprod"] * f_prod - pars["degradation"] * p[i]
    
    return dpdt
```

---

## Detailed File Analysis

### Constants.py - The Biological Parameter Database

**Purpose**: Centralized repository of all biological parameters for genetic circuit components

**File Structure**: Single dictionary `COMPONENT_CONSTANTS` with component-specific parameters

#### **CRITICAL: How constants.py is Actually Used**

**YES - constants.py IS ACTIVELY USED and CRITICAL to calculations:**

1. **Loaded at Application Start**:
   ```python
   # app.py line 18
   from constants import COMPONENT_CONSTANTS
   
   # app.py line 136
   circuit_builder = OntologyBuilderUnified(COMPONENT_CONSTANTS)
   ```

2. **Passed to Circuit Model**:
   ```python
   # circuit_model.py - Component class receives constants
   def __init__(self, raw_label: str, channel: int, mux_chr: str, constants: Dict[str, Any]):
       self.constants = constants.get(self.label, {})  # Extract parameters for this component
   ```

3. **Parameter Assignment During Circuit Building**:
   ```python
   # circuit_model.py lines 228-245 (_finalize_block method)
   for comp in comps:
       params = self.constants.get(comp.label, {})  # Look up from COMPONENT_CONSTANTS
       
       if comp.type == "promoter":
           comp.parameters["strength"] = params.get("strength", 1.0)  # USED IN CALCULATION
       elif comp.type == "rbs":
           comp.parameters["efficiency"] = params.get("efficiency", 1.0)  # USED IN CALCULATION
       elif comp.type == "cds":
           comp.parameters["translation_rate"] = params.get("translation_rate", 5.0)  # USED
           comp.parameters["degradation_rate"] = params.get("degradation_rate", 0.1)  # USED
           comp.parameters["init_conc"] = params.get("init_conc", 0.01)  # USED
   ```

4. **Direct Impact on ODE Calculations**:
   ```python
   # circuit_model.py line 829 - kprod calculation
   kprod = prom_s * rbs_e * 1.0
   # where prom_s comes from comp.parameters["strength"] (from constants.py)
   # where rbs_e comes from comp.parameters["efficiency"] (from constants.py)
   
   # circuit_model.py line 905 - ODE right-hand side
   dpdt[i] = pars["k0"] + pars["kprod"] * f_prod - pars["degradation"] * p[i]
   # degradation comes from comp.parameters["degradation_rate"] (from constants.py)
   ```

5. **Dial Parameter Overrides**:
   ```python
   # app.py line 260 - User can adjust constants via dial interface
   adjusted_constants = COMPONENT_CONSTANTS.copy()
   # Then override specific values based on user input
   adjusted_constants["promoter_1"]["strength"] = 10.0  # User override
   
   # Create new builder with adjusted constants
   builder = OntologyBuilderUnified(adjusted_constants)
   ```

6. **API Endpoint for Frontend**:
   ```python
   # app.py line 568
   @app.route('/api/constants')
   def get_constants():
       return jsonify(COMPONENT_CONSTANTS)  # Sent to frontend for dial interface
   ```

#### **Value Added to Calculations**

**Direct Mathematical Impact**:

| Constant Parameter | Where Used | Calculation Impact |
|-------------------|------------|-------------------|
| `promoter.strength` | kprod calculation | **kprod = strength × efficiency × 1.0** → Higher strength = more protein production |
| `rbs.efficiency` | kprod calculation | **kprod = strength × efficiency × 1.0** → Higher efficiency = more translation |
| `cds.degradation_rate` | ODE term | **-degradation_rate × [Protein]** → Higher degradation = faster decay |
| `cds.translation_rate` | (Currently not multiplied, but stored) | Available for future enhancements |
| `cds.init_conc` | Initial conditions | **p0[i] = init_conc** → Starting protein concentration |
| `repressor.Kr` | Hill function | **Kr^n / (Kr^n + [P]^n)** → Repression threshold |
| `activator.Ka` | Hill function | **[P]^n / (Ka^n + [P]^n)** → Activation threshold |
| `regulator.n` | Hill coefficient | Controls cooperativity (steepness of response) |

**Example Calculation Path**:

```
User places promoter_1 on board
         ↓
constants.py: promoter_1 = {strength: 5.0}
         ↓
circuit_model.py: comp.parameters["strength"] = 5.0
         ↓
ODE construction: kprod = 5.0 * 1.0 * 1.0 = 5.0
         ↓
ODE solution: dpdt = 0.01 + 5.0 * f_reg - 1.0 * p
         ↓
Protein concentration over time depends on kprod=5.0
         ↓
If user changes strength to 10.0 via dial:
  kprod = 10.0 → 2× more protein production
```

---

#### **Dynamic Override Mechanism - How User Adjustments Work**

**User dial adjustments OVERRIDE constants.py values dynamically**

The system implements a **3-tier parameter priority system**:

```
Priority 1 (HIGHEST): Individual Component Overrides (promoter1_strength: 10.0)
         ↓
Priority 2 (MEDIUM): Global Type Overrides (global_transcription_rate: 1.5)
         ↓
Priority 3 (LOWEST): constants.py Defaults (strength: 5.0)
```

**Step-by-Step Override Process**:

```python
# STEP 1: Start with constants.py defaults
# constants.py
COMPONENT_CONSTANTS = {
    "promoter_1": {"strength": 5.0, "type": "promoter"},
    "promoter_2": {"strength": 5.0, "type": "promoter"},
    "cds_1": {"degradation_rate": 1.0, "translation_rate": 7.0}
}

# STEP 2: User adjusts dial controls in frontend
// script.js - User moves slider
dialParameters = {
    promoter1_strength: 10.0,           // Individual override for promoter_1
    cds1_degradation_rate: 0.5,         // Individual override for cds_1
    global_transcription_rate: 1.5,     // Global multiplier for all promoters
    global_degradation_rate: 0.8        // Global multiplier for all CDS
};

// STEP 3: Send to backend with override flag
fetch('/simulate', {
    body: JSON.stringify({
        cellboard: cellboard,
        dial: dialParameters,
        apply_dial: true  // ✅ CRITICAL FLAG - must be true for overrides
    })
});

// STEP 4: Backend processes overrides
// app.py lines 260-450
adjusted_constants = COMPONENT_CONSTANTS.copy()  // Start with defaults

// Priority 1: Individual component overrides (HIGHEST)
if 'promoter1_strength' in dial_data:
    adjusted_constants["promoter_1"]["strength"] = 10.0
    // OLD: 5.0 → NEW: 10.0 ✅ OVERRIDDEN

if 'cds1_degradation_rate' in dial_data:
    adjusted_constants["cds_1"]["degradation_rate"] = 0.5
    // OLD: 1.0 → NEW: 0.5 ✅ OVERRIDDEN

// Priority 2: Global multipliers (MEDIUM - applied after individual overrides)
for comp_name in adjusted_constants:
    if comp_type == 'promoter':
        original = adjusted_constants[comp_name]["strength"]
        adjusted_constants[comp_name]["strength"] = original * 1.5
        // promoter_1: 10.0 * 1.5 = 15.0 (individual override × global multiplier)
        // promoter_2: 5.0 * 1.5 = 7.5 (default × global multiplier)

// STEP 5: Create builder with ADJUSTED constants (not original)
builder = OntologyBuilderUnified(adjusted_constants)  // Uses overridden values
builder.build()

// STEP 6: Parameters flow through to ODE calculation
// circuit_model.py uses adjusted_constants
comp.parameters["strength"] = adjusted_constants[comp.label]["strength"]
// promoter_1 gets 15.0 (not 5.0 from constants.py)

// STEP 7: ODE calculation uses overridden value
kprod = 15.0 * rbs_efficiency * 1.0  // 3× original default value
```

---

**Real Example: Promoter Strength Override**

| Stage | promoter_1 Value | Source |
|-------|-----------------|--------|
| **Default** | 5.0 | constants.py |
| **After Individual Override** | 10.0 | User dial: `promoter1_strength: 10.0` |
| **After Global Multiplier** | 15.0 | User dial: `global_transcription_rate: 1.5` → 10.0 × 1.5 |
| **In ODE Calculation** | 15.0 | kprod = **15.0** × 1.0 × 1.0 = 15.0 |
| **Result** | **3× more protein** | Compared to default of 5.0 |

---

**Complete Override Code Flow**:

```python
# app.py /simulate endpoint - The override logic

def simulate():
    dial_data = data.get('dial', {})
    apply_dial = bool(data.get('apply_dial', True))
    
    # Create copy of constants (original unchanged)
    adjusted_constants = COMPONENT_CONSTANTS.copy()
    
    if apply_dial and dial_data:
        component_overrides = {}
        global_overrides = {'promoter': {}, 'rbs': {}, 'cds': {}}
        
        # ═══════════════════════════════════════════════════════
        # PRIORITY 1: INDIVIDUAL COMPONENT OVERRIDES
        # ═══════════════════════════════════════════════════════
        for param_name, value in dial_data.items():
            # promoter1_strength → promoter_1.strength = 10.0
            if param_name.startswith('promoter') and '_strength' in param_name:
                comp_num = param_name.replace('promoter', '').replace('_strength', '')
                comp_key = f"promoter_{comp_num}"
                component_overrides[comp_key] = {'strength': float(value)}
            
            # cds1_degradation_rate → cds_1.degradation_rate = 0.5
            elif param_name.startswith('cds') and '_degradation_rate' in param_name:
                comp_num = param_name.replace('cds', '').replace('_degradation_rate', '')
                comp_key = f"cds_{comp_num}"
                component_overrides[comp_key] = {'degradation_rate': float(value)}
            
            # ... similar for rbs, translation_rate, etc.
        
        # Apply individual overrides
        for comp_name, overrides in component_overrides.items():
            if comp_name in adjusted_constants:
                for param, value in overrides.items():
                    original = adjusted_constants[comp_name].get(param)
                    adjusted_constants[comp_name][param] = value
                    print(f"✅ OVERRIDE: {comp_name}.{param} = {original} → {value}")
        
        # ═══════════════════════════════════════════════════════
        # PRIORITY 2: GLOBAL MULTIPLIERS
        # ═══════════════════════════════════════════════════════
        global_transcription = dial_data.get('global_transcription_rate', 1.0)
        global_degradation = dial_data.get('global_degradation_rate', 1.0)
        
        for comp_name in adjusted_constants:
            comp_type = adjusted_constants[comp_name].get('type')
            
            # Apply global transcription multiplier to ALL promoters
            if comp_type == 'promoter' and 'strength' in adjusted_constants[comp_name]:
                original = adjusted_constants[comp_name]['strength']
                adjusted_constants[comp_name]['strength'] = original * global_transcription
                print(f"✅ GLOBAL: {comp_name}.strength = {original} × {global_transcription} = {original * global_transcription}")
            
            # Apply global degradation multiplier to ALL CDS
            if comp_type == 'cds' and 'degradation_rate' in adjusted_constants[comp_name]:
                original = adjusted_constants[comp_name]['degradation_rate']
                adjusted_constants[comp_name]['degradation_rate'] = original * global_degradation
                print(f"✅ GLOBAL: {comp_name}.degradation_rate = {original} × {global_degradation} = {original * global_degradation}")
    
    # ═══════════════════════════════════════════════════════
    # PRIORITY 3: USE ADJUSTED CONSTANTS (original unchanged)
    # ═══════════════════════════════════════════════════════
    builder = OntologyBuilderUnified(adjusted_constants)  # NOT COMPONENT_CONSTANTS
    builder.build()
    result = simulate_circuit(builder)
    
    # constants.py file remains unchanged on disk
    # Only this simulation uses the adjusted values
```

---

**Important Behaviors**:

1. **Original constants.py is NEVER modified** - Only in-memory copy is changed
2. **Each simulation is independent** - Different dial settings don't interfere
3. **apply_dial flag controls behavior**:
   ```javascript
   apply_dial: true  → Use dial overrides
   apply_dial: false → Ignore dial, use constants.py defaults
   ```

4. **Cumulative effect** - Individual override THEN global multiplier:
   ```
   promoter_1 default: 5.0
   + Individual override: 10.0
   × Global multiplier: 1.5
   = Final value: 15.0
   ```

5. **Override precedence**:
   ```
   If user sets: promoter1_strength = 8.0
   AND global_transcription_rate = 2.0
   
   Result: 8.0 × 2.0 = 16.0 (NOT 5.0 × 2.0 = 10.0)
   Individual override applied FIRST, then multiplier
   ```

---

**Frontend Interface Example**:

```html
<!-- dial.html - User controls -->
<div class="parameter-controls">
    <!-- Individual Component Control -->
    <label>Promoter 1 Strength</label>
    <input type="range" id="promoter1-strength" 
           min="0.1" max="10.0" step="0.1" value="5.0">
    <span id="promoter1-value">5.0</span>
    
    <!-- Global Multiplier Control -->
    <label>Global Transcription Rate</label>
    <input type="range" id="global-transcription" 
           min="0.1" max="3.0" step="0.1" value="1.0">
    <span id="global-transcription-value">1.0×</span>
    
    <!-- Enable/Disable Overrides -->
    <label>
        <input type="checkbox" id="apply-dial-checkbox" checked>
        Apply Dial Adjustments
    </label>
</div>

<script>
// Capture user adjustments
$('#promoter1-strength').on('input', function() {
    dialParameters.promoter1_strength = parseFloat($(this).val());
    $('#promoter1-value').text($(this).val());
});

$('#global-transcription').on('input', function() {
    dialParameters.global_transcription_rate = parseFloat($(this).val());
    $('#global-transcription-value').text($(this).val() + '×');
});

// Send with apply_dial flag
const applyDial = $('#apply-dial-checkbox').is(':checked');
fetch('/simulate', {
    body: JSON.stringify({
        cellboard: cellboard,
        dial: dialParameters,
        apply_dial: applyDial  // User can disable overrides
    })
});
</script>
```

---

**Testing Override Behavior**:

```python
# Test Case 1: No overrides
dial_data = {}
apply_dial = True
# Result: Uses constants.py defaults (strength = 5.0)

# Test Case 2: Individual override only
dial_data = {'promoter1_strength': 8.0}
apply_dial = True
# Result: strength = 8.0 (overridden)

# Test Case 3: Global multiplier only
dial_data = {'global_transcription_rate': 2.0}
apply_dial = True
# Result: strength = 5.0 × 2.0 = 10.0 (default × multiplier)

# Test Case 4: Both individual and global
dial_data = {
    'promoter1_strength': 8.0,
    'global_transcription_rate': 2.0
}
apply_dial = True
# Result: strength = 8.0 × 2.0 = 16.0 (override × multiplier)

# Test Case 5: Overrides disabled
dial_data = {'promoter1_strength': 8.0}
apply_dial = False
# Result: strength = 5.0 (ignores dial_data, uses constants.py)
```

---

**Why This Design?**

1. **Non-Destructive**: Original constants.py preserved
2. **Flexible**: Users can experiment without permanent changes
3. **Reversible**: Uncheck "Apply Dial" to revert to defaults
4. **Layered**: Individual precision + global convenience
5. **Reproducible**: Save dial settings to recreate experiments

**Without constants.py, simulations would:**
- Have no default parameters (would crash or use hardcoded fallbacks)
- Be impossible to customize via dial interface
- Lose biological realism (arbitrary values instead of literature-based parameters)
- Require code changes for every parameter adjustment

#### **Why This Design is Essential**

1. **Separation of Data and Logic**: Parameters separate from calculation code
2. **Biological Accuracy**: Values based on real experimental measurements
3. **User Customization**: Dial interface modifies constants without code changes
4. **Reproducibility**: Same constants file = same simulation results
5. **Extensibility**: Easy to add new components by adding to dictionary

#### **Parameter Categories**

##### **1. Promoters - Transcription Initiation**
```python
"promoter_1": {
    "strength": 5.0,        # Transcription rate (RNA polymerase binding/activity)
    "type": "promoter"      # Component classification
}
```

**Biological Meaning**:
- `strength`: Rate at which mRNA is produced from DNA template
- Units: Arbitrary units (AU), normalized to typical E. coli promoters
- Range: 0.1 (weak) to 10.0+ (strong)
- Real examples: 
  - Weak promoter (Plac): ~1.0
  - Medium promoter (Ptet): ~5.0
  - Strong promoter (PT7): ~10.0

**How It's Used**:
```python
# In ODE system:
kprod = promoter_strength * rbs_efficiency * cds_translation_rate
transcription_rate = promoter_strength * RNA_polymerase_availability
```

---

##### **2. RBS (Ribosome Binding Sites) - Translation Efficiency**
```python
"rbs_1": {
    "efficiency": 1.0,           # Translation initiation efficiency
    "translation_rate": 5.0,     # Optional: direct translation rate
    "type": "rbs"
}
```

**Biological Meaning**:
- `efficiency`: How effectively ribosomes bind and initiate translation
- Range: 0.1 (poor binding) to 2.0 (optimal binding)
- Affects: mRNA → Protein conversion rate
- Real factors: Shine-Dalgarno sequence strength, spacing from start codon

**Impact on System**:
```python
protein_production = mRNA_level * rbs_efficiency * ribosome_availability
# Higher efficiency → More protein per mRNA molecule
```

---

##### **3. CDS (Coding Sequences) - Protein Production & Degradation**
```python
"cds_1": {
    "degradation_rate": 1.0,      # Protein degradation rate (γ)
    "translation_rate": 7.0,      # mRNA → Protein conversion rate
    "init_conc": 0.0,            # Initial protein concentration
    "max_expression": 100.0,      # Optional: saturation level
    "type": "cds"
}
```

**Biological Meaning**:

*degradation_rate (γ)*:
- Rate at which protein is degraded by proteases or diluted by cell division
- Units: per hour (h⁻¹)
- Range: 0.01 (stable proteins) to 5.0 (unstable/tagged proteins)
- Half-life relationship: t₁/₂ = ln(2)/γ ≈ 0.693/γ
  - γ = 1.0 → t₁/₂ = 0.7 hours (42 minutes)
  - γ = 0.1 → t₁/₂ = 7 hours

*translation_rate*:
- Speed of ribosome movement along mRNA + initiation frequency
- Higher values → Faster protein accumulation
- Combined with RBS efficiency to determine total protein production

*init_conc*:
- Starting protein concentration at t=0
- Usually 0.0 (no protein initially)
- Can be set >0 for pre-induced systems or carrying over from previous growth

**ODE Usage**:
```python
d[Protein]/dt = translation_rate * [mRNA] - degradation_rate * [Protein]
#               ↑ Production term          ↑ Degradation term
```

---

##### **4. Terminators - Transcription Termination**
```python
"terminator_1": {
    "efficiency": 0.99,      # Fraction of transcripts terminated
    "type": "terminator"
}
```

**Biological Meaning**:
- `efficiency`: Probability that transcription stops at this point
- 0.99 = 99% termination (very strong)
- 0.5 = 50% read-through (weak terminator)
- Prevents transcription of downstream genes

**System Impact**:
```python
# Strong terminator (0.99) → Minimal cross-circuit interference
# Weak terminator (0.5) → Possible read-through to next gene
# Used in validation but not directly in ODE (affects circuit isolation)
```

---

##### **5. Repressors - Negative Regulation**
```python
"repressor_a": {
    "Kr": 0.5,                    # Repression threshold (dissociation constant)
    "n": 2,                       # Hill coefficient (cooperativity)
    "type": "repressor",
    "is_floating": False          # Circuit-encoded vs external
}
```

**Biological Meaning**:

*Kr (Repression Constant)*:
- Protein concentration at which repression is 50% effective
- Units: μM (micromolar)
- Lower Kr → More sensitive repression (less protein needed)
- Range: 0.01 (very sensitive) to 10.0 (insensitive)

*n (Hill Coefficient)*:
- Cooperativity of repressor binding
- n=1: Non-cooperative (gradual response)
- n=2: Moderate cooperativity (sigmoidal response)
- n=4+: Strong cooperativity (switch-like behavior)

*is_floating*:
- `False`: Repressor protein produced by CDS within circuit
- `True`: External repressor (e.g., IPTG-inducible system)

**Hill Function**:
```python
f_repression = Kr^n / (Kr^n + [Repressor]^n)

# Example with Kr=0.5, n=2:
[Repressor] = 0.0  → f = 1.0   (no repression, full expression)
[Repressor] = 0.5  → f = 0.5   (50% repression, half expression)
[Repressor] = 5.0  → f = 0.01  (99% repression, minimal expression)
```

**Real Examples**:
- TetR repressor: Kr ≈ 0.4 μM, n ≈ 2
- LacI repressor: Kr ≈ 0.1 μM, n ≈ 2
- CI repressor (λ phage): Kr ≈ 0.05 μM, n ≈ 3

---

##### **6. Activators - Positive Regulation**
```python
"activator_a": {
    "Ka": 0.4,                    # Activation threshold
    "n": 2,                       # Hill coefficient
    "type": "activator",
    "is_floating": False
}
```

**Biological Meaning**:

*Ka (Activation Constant)*:
- Protein concentration for 50% maximal activation
- Similar to Kr but for positive regulation
- Lower Ka → More sensitive activation

**Hill Function**:
```python
f_activation = [Activator]^n / (Ka^n + [Activator]^n)

# Example with Ka=0.4, n=2:
[Activator] = 0.0  → f = 0.0   (no activation, no expression)
[Activator] = 0.4  → f = 0.5   (50% activation, half-maximal)
[Activator] = 4.0  → f = 0.99  (99% activation, near-maximal)
```

---

#### **Parameter Ranges for Dial Mode**

```python
PARAMETER_RANGES = {
    "strength": (0.1, 5.0),                    # Promoter strength
    "efficiency": (0.1, 2.0),                  # RBS/Terminator efficiency
    "translation_rate": (1.0, 20.0),           # Protein synthesis rate
    "degradation_rate": (0.01, 1.0),           # Protein decay rate
    "binding_affinity": (0.01, 1.0),           # Regulatory binding
    "cooperativity": (0.5, 3.0),               # Hill coefficient
    "global_transcription_rate": (0.1, 3.0),   # System-wide multiplier
    "global_translation_rate": (0.1, 3.0),     # System-wide multiplier
    "global_degradation_rate": (0.1, 3.0),     # System-wide multiplier
    "temperature_factor": (0.5, 2.0),          # Temperature effects
    "resource_availability": (0.1, 2.0)        # Nutrient/ribosome availability
}
```

**How Dial Overrides Work**:
```python
# User adjusts dial: promoter1_strength = 10.0
# Backend creates adjusted_constants:
adjusted_constants = COMPONENT_CONSTANTS.copy()
adjusted_constants["promoter_1"]["strength"] = 10.0  # Override default 5.0

# Global multipliers affect all components of that type:
for comp in adjusted_constants:
    if comp_type == 'promoter':
        adjusted_constants[comp]["strength"] *= global_transcription_rate
```

---

### Template Files - The User Interface Layer

Flask uses Jinja2 templating to generate dynamic HTML pages. Templates live in `/templates/` directory.

#### **1. loading.html - Landing Page**

**Purpose**: Entry point and mode selection

**Structure**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>MAGiC - Genetic Circuit Designer</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/dial.css') }}">
</head>
<body>
    <!-- Splash Screen (3-second DNA animation) -->
    <div id="splash-screen">
        <h1 class="glowing-title">MAGiC</h1>
        <div class="dna-animation">🧬</div>
    </div>
    
    <!-- Home Page (mode selection) -->
    <div id="home-page" style="display: none;">
        <div class="logo-section">
            <h1 class="glowing-title">MAGiC</h1>
            <p class="subtitle">Modular Automated Genetic Circuit Designer</p>
        </div>
        
        <div class="button-container">
            <a href="/dial" class="mode-button">Dial Mode</a>
            <a href="/eeprom" class="mode-button">EEPROM Mode</a>
            <a href="/about" class="mode-button">About</a>
        </div>
        
        <div class="powered-by">Powered by MIT Synthetic Biology</div>
    </div>
    
    <script>
        // Show home page after 3-second splash
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('home-page').style.display = 'block';
        }, 3000);
    </script>
</body>
</html>
```

**Key Features**:
- **Glowing Title Effect**: Triple-layer text-shadow for neon glow
- **Splash Screen**: Auto-advances after 3 seconds
- **Mode Selection**: Three primary pathways (Dial/EEPROM/About)
- **Responsive Design**: Centers content, adapts to screen sizes

**CSS Linkage**: Uses `{{ url_for('static', filename='css/dial.css') }}`
- Flask function that generates correct path to static files
- Ensures paths work regardless of deployment location

---

#### **2. dial.html - Circuit Designer Interface**

**Purpose**: Main drag-and-drop circuit designer with simulation

**Key Sections**:

##### **Navigation Bar** (Liquid Glass Effect)
```html
<nav class="navbar navbar-expand-lg navbar-dark liquid-glass-nav">
    <div class="container-fluid">
        <a class="navbar-brand glowing-text" href="/">MAGiC</a>
        <div class="navbar-nav ms-auto">
            <a class="nav-link" href="/dial">Dial Mode</a>
            <a class="nav-link" href="/eeprom">EEPROM</a>
            <a class="nav-link" href="/about">About</a>
        </div>
    </div>
</nav>
```

##### **Component Palette** (Draggable Elements)
```html
<div class="component-palette">
    <h5>Genetic Components</h5>
    
    <!-- Structural Components -->
    <div class="palette-section">
        <h6>Structural</h6>
        <div class="component-item promoter" data-type="Promoter">
            <i class="fas fa-play"></i> Promoter
        </div>
        <div class="component-item rbs" data-type="RBS">
            <i class="fas fa-link"></i> RBS
        </div>
        <div class="component-item cds" data-type="CDS">
            <i class="fas fa-dna"></i> CDS (Gene)
        </div>
        <div class="component-item terminator" data-type="Terminator">
            <i class="fas fa-stop"></i> Terminator
        </div>
    </div>
    
    <!-- Regulatory Components -->
    <div class="palette-section">
        <h6>Regulators</h6>
        <div class="component-item repressor-start" data-type="Repressor Start">
            Repressor Start
        </div>
        <div class="component-item repressor-end" data-type="Repressor End">
            Repressor End
        </div>
        <!-- ... activators, inducers, inhibitors ... -->
    </div>
</div>
```

##### **8×8 Cell Board** (Drop Target)
```html
<div class="cellboard" id="cellboard">
    <!-- 64 cells generated by JavaScript -->
    <!-- Each cell: <div class="cell" data-x="0" data-y="0"></div> -->
</div>

<script>
    // Generate 8×8 grid
    const cellboard = document.getElementById('cellboard');
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cellboard.appendChild(cell);
        }
    }
</script>
```

##### **Control Panel**
```html
<div class="control-panel">
    <button id="simulate-btn" class="btn btn-success">
        <i class="fas fa-play"></i> Simulate Circuit
    </button>
    <button id="clear-btn" class="btn btn-danger">
        <i class="fas fa-trash"></i> Clear Board
    </button>
    <button id="export-btn" class="btn btn-info">
        <i class="fas fa-download"></i> Export
    </button>
</div>
```

##### **Results Display**
```html
<div id="results-container" style="display: none;">
    <div class="plot-container">
        <h4>Simulation Results</h4>
        <img id="plot-image" src="" alt="Circuit dynamics plot">
    </div>
    
    <div class="equations-container">
        <h4>System Equations</h4>
        <div id="equations-display">
            <!-- LaTeX equations rendered here -->
        </div>
    </div>
    
    <div class="circuits-container">
        <h4>Detected Circuits</h4>
        <div id="circuits-display">
            <!-- Circuit analysis shown here -->
        </div>
    </div>
</div>
```

**Data Flow in dial.html**:
```
User drags component → script.js captures drop event
                    → Updates cellboard state object
                    → Renders component on grid

User clicks Simulate → script.js sends POST /simulate
                     → Receives plot + equations + circuits
                     → Updates results-container with data
```

---

#### **3. eeprom.html - Hardware Integration Interface**

**Purpose**: Read physical EEPROM chips and import circuit designs

**Key Sections**:

##### **Serial Connection Panel**
```html
<div class="connection-panel">
    <button id="connect-serial" class="btn btn-primary">
        <i class="fas fa-plug"></i> Connect to Arduino
    </button>
    <div id="connection-status" class="status-indicator">
        Disconnected
    </div>
</div>
```

##### **Board Scanning Controls**
```html
<div class="scan-controls">
    <button id="scan-board" class="btn btn-success">
        <i class="fas fa-search"></i> Scan EEPROM Board
    </button>
    <div class="progress-bar">
        <div id="scan-progress" style="width: 0%"></div>
    </div>
    <div id="scan-status">Ready to scan</div>
</div>
```

##### **Hardware Log Display**
```html
<div class="log-container">
    <h5>Scan Log</h5>
    <textarea id="hardware-log" readonly>
> sm a 0
00: 70 72 6F 6D 6F 74 65 72 5F 31 00 ...
> sm a 1
00: 72 62 73 5F 31 00 ...
    </textarea>
</div>
```

##### **Interpreted Results**
```html
<div id="interpretation-results" style="display: none;">
    <h4>Detected Components</h4>
    <table class="results-table">
        <thead>
            <tr>
                <th>Channel</th>
                <th>Component</th>
                <th>Position (x, y)</th>
            </tr>
        </thead>
        <tbody id="components-table-body">
            <!-- Populated by eeprom.js -->
        </tbody>
    </table>
    
    <button id="load-to-dial" class="btn btn-primary">
        Load to Dial Mode
    </button>
</div>
```

**Hardware Communication Flow**:
```
1. User clicks "Connect to Arduino"
   → eeprom.js requests WebSerial port
   → Browser shows device selection dialog
   → Establishes serial connection

2. User clicks "Scan EEPROM Board"
   → Loop through 64 channels (MUX A/B, 0-15)
   → Send "sm a 0" (Select MUX A, Channel 0)
   → Send "dr 0 64" (Dump Read 64 bytes)
   → Collect hex response
   → Repeat for all channels

3. Scan complete
   → POST /interpret_hardware with log_lines
   → Backend parses hex → ASCII → component names
   → Returns cellboard format

4. User clicks "Load to Dial Mode"
   → localStorage.setItem('imported_board', JSON.stringify(cellboard))
   → window.location.href = '/dial'
   → dial.html reads localStorage on load
   → Populates board with imported components
```

---

#### **4. about.html - Project Information**

**Purpose**: Team info, technology stack, project background

**Structure**:
```html
<!-- Hero Section -->
<div class="hero-section">
    <h1 class="glowing-title">About MAGiC</h1>
    <p class="subtitle">Revolutionizing Genetic Circuit Design</p>
</div>

<!-- Mission Statement -->
<div class="mission-card glassmorphic-card">
    <h3>Our Mission</h3>
    <p>Making synthetic biology accessible through intuitive design tools...</p>
</div>

<!-- Technology Stack -->
<div class="tech-stack">
    <div class="tech-card">
        <i class="fas fa-server"></i>
        <h4>Backend</h4>
        <ul>
            <li>Flask (Python)</li>
            <li>NumPy & SciPy</li>
            <li>Matplotlib</li>
        </ul>
    </div>
    <!-- ... more tech cards ... -->
</div>

<!-- Team Section -->
<div class="team-grid">
    <div class="team-card">
        <img src="..." alt="Team member">
        <h4>Name</h4>
        <p>Role</p>
    </div>
    <!-- ... more team members ... -->
</div>
```

---

### Static Files - Assets and Client-Side Logic

Static files are served directly by Flask without processing. Located in `/static/` directory.

#### **Static File Structure**
```
static/
├── css/
│   ├── dial.css          # Main stylesheet (all pages)
│   ├── eeprom.css        # EEPROM-specific styles
│   └── about.css         # About page styles
├── js/
│   ├── script.js         # Dial mode logic
│   ├── eeprom.js         # Hardware communication
│   └── tooltip.js        # UI tooltips
├── images/
│   └── (logo, icons, etc.)
└── vendor/
    ├── jquery-3.6.0.min.js
    └── jquery.jsPlumb-1.7.11-min.js
```

---

#### **CSS Files - Styling and Visual Design**

##### **1. dial.css - Main Stylesheet (Shared Across Pages)**

**Purpose**: Global styles, navbar, glassmorphism effects, component colors

**Key Style Groups**:

**A. Liquid Glass Navbar**
```css
.liquid-glass-nav {
    background: linear-gradient(
        135deg,
        rgba(27, 38, 39, 0.9),
        rgba(27, 38, 39, 0.7)
    );
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(178, 243, 95, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.navbar-brand.glowing-text {
    color: rgba(178, 243, 95, 1);
    text-shadow: 
        0 0 10px rgba(178, 243, 95, 0.5),
        0 0 20px rgba(178, 243, 95, 0.3),
        0 0 30px rgba(178, 243, 95, 0.2);
    font-weight: 700;
    font-size: 1.5rem;
}
```

**B. Glassmorphic Cards**
```css
.glassmorphic-card {
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.05),
        rgba(255, 255, 255, 0.02)
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

**C. Component Colors**
```css
.component-item.promoter {
    background: linear-gradient(135deg, #FF6B6B, #FF5252);
    border: 2px solid rgba(255, 107, 107, 0.5);
}

.component-item.rbs {
    background: linear-gradient(135deg, #FFD166, #FFC107);
}

.component-item.cds {
    background: linear-gradient(135deg, #06D6A0, #00BFA5);
}

.component-item.terminator {
    background: linear-gradient(135deg, #4ECDC4, #26C6DA);
}

.component-item.repressor-start {
    background: linear-gradient(135deg, #A78BFA, #9333EA);
}
```

**D. Grid and Board Styling**
```css
.cellboard {
    display: grid;
    grid-template-columns: repeat(8, 60px);
    grid-template-rows: repeat(8, 60px);
    gap: 2px;
    background: rgba(27, 38, 39, 0.9);
    padding: 10px;
    border-radius: 12px;
    border: 2px solid rgba(178, 243, 95, 0.3);
}

.cell {
    width: 60px;
    height: 60px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    position: relative;
    transition: all 0.3s ease;
}

.cell:hover {
    background: rgba(178, 243, 95, 0.1);
    border-color: rgba(178, 243, 95, 0.5);
    transform: scale(1.05);
}

.cell.occupied {
    background: rgba(178, 243, 95, 0.2);
    border-color: rgba(178, 243, 95, 0.8);
}
```

**E. Responsive Design**
```css
@media (max-width: 768px) {
    .cellboard {
        grid-template-columns: repeat(8, 45px);
        grid-template-rows: repeat(8, 45px);
    }
    
    .component-palette {
        width: 100%;
        margin-bottom: 1rem;
    }
}
```

---

##### **2. eeprom.css - Hardware Interface Styling**

```css
.connection-panel {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(27, 38, 39, 0.95);
    border-radius: 12px;
}

.status-indicator {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
}

.status-indicator.connected {
    background: rgba(6, 214, 160, 0.2);
    color: #06D6A0;
    border: 1px solid rgba(6, 214, 160, 0.5);
}

.status-indicator.disconnected {
    background: rgba(255, 107, 107, 0.2);
    color: #FF6B6B;
    border: 1px solid rgba(255, 107, 107, 0.5);
}

#hardware-log {
    width: 100%;
    height: 300px;
    background: #1a1a1a;
    color: #00ff00;  /* Terminal green */
    font-family: 'Courier New', monospace;
    padding: 1rem;
    border: 1px solid rgba(0, 255, 0, 0.3);
    border-radius: 8px;
}
```

---

#### **JavaScript Files - Client-Side Logic**

##### **1. script.js - Dial Mode Application Logic**

**Key Functions**:

**A. Cellboard State Management**
```javascript
let cellboard = {
    Promoter: [],
    RBS: [],
    CDS: [],
    Terminator: [],
    'Repressor Start': [],
    'Repressor End': [],
    'Activator Start': [],
    'Activator End': []
};

function addComponentToBoard(type, x, y, gene, strength) {
    const component = {
        x: x.toString(),
        y: y.toString(),
        gene: gene,
        strength: strength || 'norm'
    };
    
    if (!cellboard[type]) {
        cellboard[type] = [];
    }
    
    cellboard[type].push(component);
    renderComponent(type, x, y, gene);
}

function removeComponentFromBoard(x, y) {
    for (let type in cellboard) {
        cellboard[type] = cellboard[type].filter(
            comp => !(comp.x === x.toString() && comp.y === y.toString())
        );
    }
    clearCell(x, y);
}
```

**B. Drag and Drop Implementation**
```javascript
// Make palette items draggable
$('.component-item').draggable({
    helper: 'clone',
    revert: 'invalid',
    start: function(event, ui) {
        $(ui.helper).css('opacity', 0.7);
    }
});

// Make cells droppable
$('.cell').droppable({
    accept: '.component-item',
    drop: function(event, ui) {
        const componentType = ui.draggable.data('type');
        const x = parseInt($(this).data('x'));
        const y = parseInt($(this).data('y'));
        
        // Check if cell is occupied
        if ($(this).hasClass('occupied')) {
            alert('Cell already occupied!');
            return;
        }
        
        // Show gene selection dialog
        showGeneDialog(componentType, x, y);
    },
    over: function() {
        $(this).addClass('hover');
    },
    out: function() {
        $(this).removeClass('hover');
    }
});
```

**C. Simulation API Call**
```javascript
$('#simulate-btn').click(function() {
    // Collect dial parameters
    const dialParams = {
        promoter1_strength: $('#promoter1-strength-slider').val(),
        global_transcription_rate: $('#global-transcription-slider').val(),
        // ... more parameters
    };
    
    // Send simulation request
    $.ajax({
        url: '/simulate',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            cellboard: cellboard,
            dial: dialParams,
            apply_dial: $('#apply-dial-checkbox').is(':checked')
        }),
        success: function(response) {
            if (response.status === 'success') {
                displayResults(response);
            } else {
                showError(response.message);
            }
        },
        error: function(xhr, status, error) {
            showError('Simulation failed: ' + error);
        }
    });
});

function displayResults(response) {
    // Show results container
    $('#results-container').show();
    
    // Display plot
    $('#plot-image').attr('src', 'data:image/png;base64,' + response.plot);
    
    // Display equations (LaTeX rendering)
    let equationsHTML = '';
    for (let protein in response.equations) {
        const eq = response.equations[protein];
        equationsHTML += `
            <div class="equation-card">
                <h5>${protein}</h5>
                <div class="latex-equation">$$${eq.latex}$$</div>
                <p>${eq.description}</p>
            </div>
        `;
    }
    $('#equations-display').html(equationsHTML);
    
    // Trigger MathJax to render LaTeX
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
    
    // Display circuits
    displayCircuits(response.circuits);
    displayRegulations(response.regulations);
    
    // Show warnings/errors
    if (response.warnings.length > 0) {
        showWarnings(response.warnings);
    }
}
```

**D. Board Rendering**
```javascript
function renderComponent(type, x, y, gene) {
    const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
    cell.addClass('occupied');
    cell.css('background-color', getComponentColor(type));
    
    const icon = getComponentIcon(type);
    cell.html(`
        <div class="component-display">
            <i class="${icon}"></i>
            <span class="gene-label">${gene}</span>
        </div>
        <button class="remove-btn" onclick="removeComponentFromBoard(${x}, ${y})">
            <i class="fas fa-times"></i>
        </button>
    `);
}

function getComponentColor(type) {
    const colors = {
        'Promoter': '#FF6B6B',
        'RBS': '#FFD166',
        'CDS': '#06D6A0',
        'Terminator': '#4ECDC4',
        'Repressor Start': '#A78BFA',
        'Repressor End': '#7E22CE'
    };
    return colors[type] || '#999';
}
```

---

##### **2. eeprom.js - Hardware Communication**

**Key Functions**:

**A. WebSerial Connection**
```javascript
let serialPort = null;
let reader = null;
let writer = null;

async function connectSerial() {
    try {
        // Request serial port
        serialPort = await navigator.serial.requestPort();
        
        // Open connection (9600 baud, 8N1)
        await serialPort.open({
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        // Set up reader/writer
        reader = serialPort.readable.getReader();
        writer = serialPort.writable.getWriter();
        
        updateConnectionStatus('connected');
        console.log('Serial port connected');
        
        // Start reading responses
        readSerialData();
        
    } catch (error) {
        console.error('Serial connection error:', error);
        alert('Failed to connect: ' + error.message);
    }
}

async function readSerialData() {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            // Convert Uint8Array to string
            const text = new TextDecoder().decode(value);
            appendToLog(text);
        }
    } catch (error) {
        console.error('Read error:', error);
    }
}
```

**B. Board Scanning**
```javascript
async function scanBoard() {
    if (!serialPort) {
        alert('Please connect to Arduino first');
        return;
    }
    
    logLines = [];  // Clear previous scan
    updateScanProgress(0);
    
    // Scan MUX A and MUX B (channels 0-15 each)
    const muxes = ['a', 'b'];
    const totalChannels = 32;  // 16 per MUX
    let scannedCount = 0;
    
    for (let mux of muxes) {
        for (let channel = 0; channel < 16; channel++) {
            // Select MUX and channel
            await sendCommand(`sm ${mux} ${channel}\n`);
            await delay(100);  // Wait for MUX to switch
            
            // Dump EEPROM contents
            await sendCommand(`dr 0 64\n`);  // Read 64 bytes from address 0
            await delay(200);  // Wait for read response
            
            // Update progress
            scannedCount++;
            updateScanProgress((scannedCount / totalChannels) * 100);
        }
    }
    
    // Scan complete - interpret results
    interpretHardware();
}

async function sendCommand(command) {
    const encoder = new TextEncoder();
    const data = encoder.encode(command);
    await writer.write(data);
    logLines.push('> ' + command.trim());
}
```

**C. Hardware Interpretation**
```javascript
function interpretHardware() {
    $.ajax({
        url: '/interpret_hardware',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            log_lines: logLines
        }),
        success: function(response) {
            if (response.status === 'success') {
                displayInterpretedComponents(response.cellboard);
                detectedCellboard = response.cellboard;
                
                $('#load-to-dial').show();
            } else {
                alert('Interpretation failed: ' + response.message);
            }
        },
        error: function(xhr, status, error) {
            alert('Interpretation error: ' + error);
        }
    });
}

$('#load-to-dial').click(function() {
    // Save to localStorage
    localStorage.setItem('imported_board', JSON.stringify(detectedCellboard));
    
    // Navigate to dial mode
    window.location.href = '/dial';
});

// In dial mode (script.js):
$(document).ready(function() {
    // Check for imported board
    const importedBoard = localStorage.getItem('imported_board');
    if (importedBoard) {
        cellboard = JSON.parse(importedBoard);
        renderImportedBoard(cellboard);
        localStorage.removeItem('imported_board');  // Clear after loading
    }
});
```

---

### Summary: How Static Files and Templates Work Together

**Request Flow**:
```
1. User navigates to /dial
   ↓
2. Flask route: @app.route('/dial')
   ↓
3. return render_template('dial.html')
   ↓
4. Jinja2 processes dial.html
   - Replaces {{ url_for('static', filename='css/dial.css') }}
   - With: /static/css/dial.css
   ↓
5. Browser receives HTML with <link href="/static/css/dial.css">
   ↓
6. Browser requests /static/css/dial.css
   ↓
7. Flask serves file directly (no processing)
   ↓
8. Browser applies CSS styling
   ↓
9. Browser loads <script src="/static/js/script.js">
   ↓
10. script.js initializes board, adds event listeners
   ↓
11. User interacts → JavaScript → AJAX → Flask → Database → Response
```

**Why This Architecture**:
- **Templates**: Dynamic content (user data, simulation results)
- **Static Files**: Unchanging assets (CSS, JS, images)
- **Separation of Concerns**: Backend logic (Python) vs Frontend logic (JavaScript)
- **Caching**: Static files can be cached by browser for performance
- **Modularity**: CSS/JS can be updated without touching Python code

---

## Core Components Deep Dive

### 1. Circuit Parsing Pipeline

```
User Drags Components on Board
         ↓
┌────────────────────────────┐
│ Cellboard Format (JSON)    │
│ {                          │
│   "Promoter": [            │
│     {x: 0, y: 0, ...}      │
│   ],                       │
│   "RBS": [...],            │
│   "CDS": [...]             │
│ }                          │
└────────┬───────────────────┘
         ↓
app.py converts to Hardware Format
         ↓
┌────────────────────────────┐
│ Hardware Format (TXT)      │
│ MUX A, Channel 0: ['promoter_1'] 
│ MUX A, Channel 1: ['rbs_1'] 
│ MUX A, Channel 2: ['cds_1'] 
│                            │
└────────┬───────────────────┘
         ↓
circuit_model.py parses lines
         ↓
┌────────────────────────────┐
│ Component Objects          │
│ Component(                 │
│   label="promoter_1",      │
│   type="promoter",         │
│   parameters={             │
│     "strength": 5.0        │
│   }                        │
│ )                          │
└────────┬───────────────────┘
         ↓
OntologyBuilder.build()
         ↓
┌────────────────────────────┐
│ Circuit Blocks             │
│ circuit_1: {               │
│   components: [...],       │
│   regulations: [...]       │
│ }                          │
└────────────────────────────┘
```

---

### 2. Regulation Detection Algorithm

The system detects regulatory relationships by pairing start/end elements:

```python
# Example circuit with repression:
# promoter_1 → repressor_a_start → rbs_1 → cds_1 → repressor_a_end → terminator_1
# promoter_2 → rbs_2 → cds_2 → terminator_2

# Step 1: Group start/end pairs by reg_key
regulators["repressor_a"] = {
    "starts": [repressor_a_start Component],
    "ends": [repressor_a_end Component]
}

# Step 2: For each end element, find nearest previous promoter
nearest_promoter = promoter_2  # End is after promoter_2

# Step 3: Find all CDS downstream of that promoter
affected_cds = [cds_2]  # CDS after promoter_2

# Step 4: For each start element, find source CDS
source_cds = cds_1  # Start follows cds_1

# Step 5: Create regulation
regulation = {
    "type": "transcriptional_repression",
    "source": "cds_1",           # Produces repressor protein
    "targets": ["cds_2"],        # Represses cds_2 promoter
    "Kr": 0.5,                   # From constants.py
    "n": 2                       # Hill coefficient
}
```

**Regulation Types**:
- `transcriptional_activation` - Activator protein enhances transcription
- `transcriptional_repression` - Repressor protein inhibits transcription
- `induced_activation` - External inducer molecule enables transcription
- `environmental_repression` - External inhibitor blocks transcription
- `self_activation` - Protein activates its own promoter
- `self_repression` - Protein represses its own promoter

---

### 3. ODE System Construction

For each CDS (protein-coding gene), the system builds an ODE:

**Mathematical Form**:
```
d[Protein_i]/dt = k0 + kprod * f_regulation - γ * [Protein_i]

Where:
- k0 = basal production rate (small constant)
- kprod = maximum production rate (from promoter, RBS, CDS parameters)
- f_regulation = product of all Hill functions affecting this protein
- γ = degradation_rate (from CDS parameters)
```

**Parameter Calculation**:
```python
kprod = promoter_strength * rbs_efficiency * cds_translation_rate
      = 5.0 * 1.0 * 7.0 = 35.0

k0 = 0.01 * kprod = 0.35  # Basal leakage
```

**Hill Functions**:

*Repression*:
```
f_rep = Kr^n / (Kr^n + [Repressor]^n)

When [Repressor] = 0:  f_rep = 1 (no repression, full expression)
When [Repressor] >> Kr: f_rep → 0 (strong repression, no expression)
```

*Activation*:
```
f_act = [Activator]^n / (Ka^n + [Activator]^n)

When [Activator] = 0:  f_act = 0 (no activation, no expression)
When [Activator] >> Ka: f_act → 1 (strong activation, full expression)
```

**Combined Regulations**:
```python
# If protein has multiple regulators:
f_regulation = f_rep1 * f_rep2 * f_act1 * ...

# Example: Protein repressed by P1 and activated by P2
f = (Kr1^n / (Kr1^n + [P1]^n)) * ([P2]^n / (Ka2^n + [P2]^n))
```

---

### 4. Classic Repressilator Example

**Circuit Structure**:
```
Circuit 1: promoter_1 → rbs_1 → cds_1 (Protein A) → repressor_a_end → terminator_1
                              ↓ repressor_a_start
Circuit 2: promoter_2 → rbs_2 → cds_2 (Protein B) → repressor_b_end → terminator_2
                              ↓ repressor_b_start
Circuit 3: promoter_3 → rbs_3 → cds_3 (Protein C) → repressor_c_end → terminator_3
                              ↓ repressor_c_start
                              (loops back to Circuit 1)
```

**Regulatory Network**:
- Protein A represses Protein B
- Protein B represses Protein C
- Protein C represses Protein A
→ Forms negative feedback loop → Oscillations

**ODE System**:
```
d[A]/dt = k0 + kprod * (Kr^n / (Kr^n + [C]^n)) - γ*[A]
d[B]/dt = k0 + kprod * (Kr^n / (Kr^n + [A]^n)) - γ*[B]
d[C]/dt = k0 + kprod * (Kr^n / (Kr^n + [B]^n)) - γ*[C]
```

**Initial Conditions** (symmetry breaking):
```python
[A](0) = 1.0    # High initial concentration
[B](0) = 0.1    # Medium
[C](0) = 0.05   # Low
```

This asymmetry ensures oscillations start instead of settling to equilibrium.

---

## Data Flow

### Complete Request-Response Cycle

```
1. USER ACTION: Drag components on dial.html board
   ↓
2. FRONTEND: script.js captures board state
   cellboard = {
     "Promoter": [{x: 0, y: 0, gene: "Gene 1", strength: "norm"}],
     "RBS": [{x: 1, y: 0, gene: "Gene 1", strength: "norm"}],
     "CDS": [{x: 2, y: 0, gene: "Gene 1", strength: "norm"}]
   }
   ↓
3. FRONTEND: User clicks "Simulate" → AJAX POST to /simulate
   fetch('/simulate', {
     method: 'POST',
     body: JSON.stringify({
       cellboard: cellboard,
       dial: dialParameters,  // Optional parameter adjustments
       apply_dial: true
     })
   })
   ↓
4. BACKEND: app.py /simulate endpoint receives request
   ↓
5. CONVERSION: cellboard → hardware format
   - Calculate channel = y*8 + x
   - Map component types to hardware names
   - Create MUX/Channel lines:
     "MUX A, Channel 0: ['promoter_1'] strength=norm"
   ↓
6. PARAMETER ADJUSTMENT: Apply dial overrides (if provided)
   - Individual: promoter1_strength, cds2_translation_rate
   - Global: global_transcription_rate, global_degradation_rate
   - Create adjusted_constants by copying COMPONENT_CONSTANTS
   - Override specific values
   ↓
7. PARSING: OntologyBuilderUnified.parse_text_file(lines)
   - Create Component objects
   - Detect regulators vs structural components
   - Assign global indices
   ↓
8. BUILDING: OntologyBuilderUnified.build()
   a) Group components into circuits (blocks separated by gaps)
   b) Assign parameters from adjusted_constants
   c) Detect unpaired regulators
   d) Build regulation network
   e) Validate circuit structure
   ↓
9. SIMULATION: simulate_circuit(builder)
   a) Extract CDS list (proteins to model)
   b) Build regulation mappings
   c) Create parameter dictionaries (kprod, k0, Kr, Ka, n, γ)
   d) Define ODE system (rhs function)
   e) Set initial conditions p0
   f) Solve: sol = odeint(rhs, p0, t)
   ↓
10. VISUALIZATION: Generate matplotlib plot
    - Plot each protein concentration vs time
    - Add noise for visual separation (constitutive circuits)
    - Convert to base64 PNG
    ↓
11. EQUATION GENERATION: generate_equation_display()
    - Create LaTeX representations of ODEs
    - Include regulation descriptions
    ↓
12. RESPONSE: Return JSON to frontend
    {
      status: 'success',
      plot: 'data:image/png;base64,...',
      circuits: [...],
      regulations: [...],
      equations: {...},
      time_series: {time: [...], Protein1: [...], Protein2: [...]},
      warnings: [...],
      errors: []
    }
    ↓
13. FRONTEND: script.js receives response
    - Display plot image
    - Show circuit analysis
    - Display equations
    - Highlight warnings/errors
```

---

### Hardware (EEPROM) Data Flow

```
1. USER ACTION: Click "Scan Board" in eeprom.html
   ↓
2. FRONTEND: eeprom.js sends serial commands
   - Connect to Arduino via WebSerial API
   - Loop through 64 channels (MUX A/B, channels 0-15)
   - Send command: "sm a 0" (Select MUX A, Channel 0)
   - Send command: "dr 0 64" (Dump Read from address 0, 64 bytes)
   ↓
3. HARDWARE: Arduino reads EEPROM chip
   - I2C communication with 24LC256 EEPROM
   - Returns hex dump:
     "00: 70 72 6F 6D 6F 74 65 72 5F 31 00 ..."
     (ASCII: "promoter_1")
   ↓
4. FRONTEND: Collect all hex dumps into log array
   log_lines = [
     "> sm a 0",
     "00: 70 72 6F 6D 6F 74 65 72 5F 31 00 ...",
     "> sm a 1",
     "00: 72 62 73 5F 31 00 ...",
     ...
   ]
   ↓
5. FRONTEND: POST to /interpret_hardware
   fetch('/interpret_hardware', {
     body: JSON.stringify({log_lines: log_lines})
   })
   ↓
6. BACKEND: app.py parse_hardware_log()
   a) Parse "sm a 0" commands to track current channel
   b) Extract hex data from dump lines
   c) Convert hex → ASCII
   d) Detect component names (promoter_1, rbs_a, cds_2, etc.)
   e) Build channel_data:
      {
        "MUX_A_CH_0": ["promoter_1"],
        "MUX_A_CH_1": ["rbs_1"],
        "MUX_A_CH_2": ["cds_1"]
      }
   ↓
7. BACKEND: convert_hardware_to_cellboard()
   - Parse channel position (MUX A/B, Channel 0-15)
   - Calculate board coordinates: x = channel % 8, y = channel // 8
   - Map component names to types
   - Create cellboard format
   ↓
8. RESPONSE: Return cellboard to frontend
   {
     status: 'success',
     cellboard: {
       "Promoter": [{x: 0, y: 0, gene: "Gene 1"}],
       "RBS": [{x: 1, y: 0, gene: "Gene 1"}]
     },
     component_count: 3
   }
   ↓
9. FRONTEND: Populate dial.html board with scanned components
   - Clear existing board
   - Place components at specified positions
   - User can now simulate hardware-defined circuit
```

---

## GUI Data Flow and Partitioning

### Overview: Data Lifecycle in the GUI

The MAGiC GUI implements a **multi-layer data architecture** where information flows through distinct stages, each with specific responsibilities and data structures. Understanding this partitioning is crucial for debugging, extending functionality, and maintaining data integrity.

---

### Data Partitioning Layers

The application partitions data across **5 distinct layers**:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: VISUAL LAYER (DOM/Canvas)                             │
│  - HTML elements (<div class="cell">)                           │
│  - CSS styles (colors, positions)                               │
│  - Visual feedback (hover states, animations)                   │
│  Purpose: User sees and interacts with components               │
└────────────┬────────────────────────────────────────────────────┘
             │ ↕ Events (click, drag, drop)
┌────────────▼────────────────────────────────────────────────────┐
│  LAYER 2: FRONTEND STATE (JavaScript Objects)                   │
│  - cellboard object (component positions)                       │
│  - dialParameters object (user adjustments)                     │
│  - simulationResults object (cached results)                    │
│  Purpose: Single source of truth for UI state                   │
└────────────┬────────────────────────────────────────────────────┘
             │ ↕ JSON serialization
┌────────────▼────────────────────────────────────────────────────┐
│  LAYER 3: TRANSPORT LAYER (HTTP/JSON)                           │
│  - Request payloads (POST /simulate)                            │
│  - Response payloads (plot, circuits, equations)                │
│  Purpose: Stateless communication between client/server         │
└────────────┬────────────────────────────────────────────────────┘
             │ ↕ Parsing & transformation
┌────────────▼────────────────────────────────────────────────────┐
│  LAYER 4: BACKEND STATE (Python Objects)                        │
│  - Component instances (Python classes)                         │
│  - OntologyBuilder state (circuits, regulations)                │
│  - NumPy arrays (ODE solutions)                                 │
│  Purpose: Business logic and scientific computation             │
└────────────┬────────────────────────────────────────────────────┘
             │ ↕ Mathematical modeling
┌────────────▼────────────────────────────────────────────────────┐
│  LAYER 5: COMPUTATIONAL LAYER (Numerical Data)                  │
│  - Time series arrays (protein concentrations)                  │
│  - Parameter matrices (kprod, Kr, Ka, n)                        │
│  - Solution vectors (ODE integration results)                   │
│  Purpose: Scientific simulation and analysis                    │
└─────────────────────────────────────────────────────────────────┘
```

---

### Layer 1: Visual Layer - The DOM Representation

**What Lives Here:**
- HTML elements rendered in the browser
- CSS classes and inline styles
- Event listeners attached to DOM nodes
- Animation states and transitions

**Data Structure:**
```html
<!-- Cell in the 8×8 grid -->
<div class="cell occupied" 
     data-x="2" 
     data-y="1" 
     style="background-color: #06D6A0;">
    <div class="component-display">
        <i class="fas fa-dna"></i>
        <span class="gene-label">Gene 1</span>
    </div>
    <button class="remove-btn" onclick="removeComponentFromBoard(2, 1)">
        <i class="fas fa-times"></i>
    </button>
</div>
```

**Key Attributes:**
- `data-x`, `data-y`: Grid coordinates (0-7)
- `class="occupied"`: Visual state indicator
- `style="background-color"`: Component type visual encoding
- Event handlers: `onclick`, drag/drop listeners

**Partitioning Purpose:**
- **Separation of Concerns**: Visual representation separate from business logic
- **Performance**: DOM updates batched and optimized
- **User Feedback**: Immediate visual response without waiting for backend

**Data Flow:**
```javascript
// Visual Layer → Frontend State
$('.cell').on('click', function() {
    const x = $(this).data('x');
    const y = $(this).data('y');
    // Read from DOM, update state
    removeComponentFromBoard(x, y);
});

// Frontend State → Visual Layer
function renderComponent(type, x, y, gene) {
    const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
    cell.addClass('occupied');
    cell.html(/* component HTML */);
}
```

---

### Layer 2: Frontend State - JavaScript Data Structures

**What Lives Here:**
- Application state (which components are placed where)
- User input parameters (dial settings)
- Cached simulation results
- UI state flags (loading, error states)

**Primary Data Structure: cellboard Object**

```javascript
// Global state object (lives in script.js)
let cellboard = {
    "Promoter": [
        {
            x: "0",           // Grid x-coordinate (string for JSON)
            y: "0",           // Grid y-coordinate
            gene: "Gene 1",   // Which gene this component belongs to
            strength: "norm"  // Strength level (norm/high/low)
        },
        {x: "4", y: "2", gene: "Gene 2", strength: "high"}
    ],
    "RBS": [
        {x: "1", y: "0", gene: "Gene 1", strength: "norm"}
    ],
    "CDS": [
        {x: "2", y: "0", gene: "Gene 1", strength: "norm"}
    ],
    "Terminator": [
        {x: "3", y: "0", gene: "Gene 1", strength: "norm"}
    ],
    "Repressor Start": [],
    "Repressor End": [],
    "Activator Start": [],
    "Activator End": [],
    "Inducer Start": [],
    "Inducer End": [],
    "Inhibitor Start": [],
    "Inhibitor End": []
};
```

**Why This Structure:**
1. **Type Grouping**: Components grouped by type for easy iteration
2. **Position Tracking**: x, y coordinates map to 8×8 grid
3. **Gene Association**: Multiple genes can exist on same board
4. **Parameter Storage**: Strength levels stored per-component
5. **JSON-Ready**: Directly serializable for backend communication

**Secondary Data Structure: dialParameters Object**

```javascript
let dialParameters = {
    // Individual component overrides
    promoter1_strength: 10.0,
    promoter2_strength: 5.0,
    rbs1_efficiency: 1.5,
    cds1_translation_rate: 12.0,
    cds1_degradation_rate: 0.5,
    protein1_initial_conc: 0.1,
    
    // Global multipliers
    global_transcription_rate: 1.2,
    global_translation_rate: 1.0,
    global_degradation_rate: 0.8,
    
    // Environmental factors
    temperature_factor: 1.0,
    resource_availability: 1.0,
    
    // Regulatory parameters
    binding_affinity: 0.5,
    cooperativity: 2.0,
    repressor_strength: 1.0,
    activator_strength: 1.0
};
```

**Tertiary Data Structure: simulationResults Object**

```javascript
let simulationResults = {
    status: 'success',
    plot: 'data:image/png;base64,iVBORw0KG...',  // Base64 encoded plot
    circuits: [
        {
            name: 'circuit_1',
            components: [
                {type: 'promoter', name: 'promoter_1'},
                {type: 'rbs', name: 'rbs_1'},
                {type: 'cds', name: 'cds_1'}
            ],
            extras: [],
            misplaced: []
        }
    ],
    regulations: [
        {
            type: 'transcriptional_repression',
            source: 'cds_1',
            targets: ['cds_2'],
            Kr: 0.5,
            n: 2
        }
    ],
    equations: {
        'Protein 1, Gene 1': {
            latex: '\\frac{d[P1]}{dt} = k_{prod} - \\gamma \\cdot [P1]',
            description: 'Degradation rate (γ)'
        }
    },
    time_series: {
        time: [0, 0.12, 0.24, ...],
        'Protein 1, Gene 1': [0.01, 0.15, 0.28, ...]
    },
    warnings: [],
    errors: []
};
```

**State Management Operations:**

```javascript
// CREATE: Add component to board
function addComponentToBoard(type, x, y, gene, strength = 'norm') {
    const component = {
        x: x.toString(),
        y: y.toString(),
        gene: gene,
        strength: strength
    };
    
    if (!cellboard[type]) {
        cellboard[type] = [];
    }
    
    cellboard[type].push(component);
    renderComponent(type, x, y, gene);  // Update Layer 1
}

// READ: Check if cell is occupied
function isCellOccupied(x, y) {
    for (let type in cellboard) {
        const found = cellboard[type].find(
            comp => comp.x === x.toString() && comp.y === y.toString()
        );
        if (found) return true;
    }
    return false;
}

// UPDATE: Change component strength
function updateComponentStrength(x, y, newStrength) {
    for (let type in cellboard) {
        const comp = cellboard[type].find(
            c => c.x === x.toString() && c.y === y.toString()
        );
        if (comp) {
            comp.strength = newStrength;
            break;
        }
    }
}

// DELETE: Remove component
function removeComponentFromBoard(x, y) {
    for (let type in cellboard) {
        cellboard[type] = cellboard[type].filter(
            comp => !(comp.x === x.toString() && comp.y === y.toString())
        );
    }
    clearCell(x, y);  // Update Layer 1
}
```

**Partitioning Purpose:**
- **Single Source of Truth**: All UI state in one place
- **Undo/Redo**: Easy to snapshot state for undo functionality
- **Persistence**: Can save to localStorage or backend
- **Debugging**: Inspect state in browser console
- **Testing**: Mock state for unit tests

---

### Layer 3: Transport Layer - HTTP Request/Response

**What Lives Here:**
- Serialized JSON payloads
- HTTP headers and metadata
- API endpoint routing information
- Error codes and status messages

**Request Payload Structure:**

```javascript
// Constructed in script.js before AJAX call
const requestPayload = {
    cellboard: {
        "Promoter": [{x: "0", y: "0", gene: "Gene 1", strength: "norm"}],
        "RBS": [{x: "1", y: "0", gene: "Gene 1", strength: "norm"}],
        "CDS": [{x: "2", y: "0", gene: "Gene 1", strength: "norm"}],
        "Terminator": [{x: "3", y: "0", gene: "Gene 1", strength: "norm"}]
    },
    dial: {
        promoter1_strength: 10.0,
        global_transcription_rate: 1.2
    },
    apply_dial: true  // Flag to use dial parameters
};

// Sent via AJAX
$.ajax({
    url: '/simulate',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(requestPayload),
    success: function(response) { /* ... */ },
    error: function(xhr, status, error) { /* ... */ }
});
```

**Response Payload Structure:**

```json
{
    "status": "success",
    "plot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "circuits": [
        {
            "name": "circuit_1",
            "components": [
                {"type": "promoter", "name": "promoter_1", "parameters": {...}},
                {"type": "rbs", "name": "rbs_1", "parameters": {...}},
                {"type": "cds", "name": "cds_1", "parameters": {...}}
            ],
            "component_counts": {"promoter": 1, "rbs": 1, "cds": 1},
            "extras": [],
            "misplaced": [],
            "fallback_by_cds": {}
        }
    ],
    "regulations": [
        {
            "type": "transcriptional_repression",
            "source": "cds_1",
            "targets": ["cds_2"],
            "Kr": 0.5,
            "n": 2,
            "description": "Protein 1 represses Protein 2"
        }
    ],
    "equations": {
        "Protein 1, Gene 1": {
            "latex": "\\frac{d[P1]}{dt} = k_{prod} - \\gamma \\cdot [P1]",
            "description": "Degradation rate (γ)",
            "components": ["Degradation rate (γ)"]
        }
    },
    "protein_mapping": {
        "Protein 1, Gene 1": "cds_1"
    },
    "time_series": {
        "time": [0.0, 0.12, 0.24, 0.36, ...],
        "Protein 1, Gene 1": [0.01, 0.15, 0.28, 0.42, ...]
    },
    "components_analyzed": 4,
    "warnings": ["Regulator issue: ..."],
    "errors": []
}
```

**Data Transformation at Transport Boundary:**

**Frontend → Backend (Serialization):**
```javascript
// JavaScript objects → JSON string
const payload = {
    cellboard: cellboard,
    dial: dialParameters,
    apply_dial: true
};
const jsonString = JSON.stringify(payload);

// HTTP transmission
fetch('/simulate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: jsonString
});
```

**Backend → Frontend (Deserialization):**
```python
# Flask receives JSON string
data = request.get_json()  # Parses JSON → Python dict

# Access nested data
cellboard = data['cellboard']
dial_data = data.get('dial', {})
apply_dial = bool(data.get('apply_dial', True))

# Return response (Python dict → JSON)
response = {
    'status': 'success',
    'plot': plot_base64,
    'circuits': builder.circuits,  # List of dicts
    'regulations': builder.regulations
}
return jsonify(response)  # Converts to JSON string
```

**Partitioning Purpose:**
- **Protocol Independence**: Could swap HTTP for WebSockets
- **Versioning**: API versioning through headers
- **Validation**: Validate at transport boundary
- **Caching**: Cache responses at HTTP layer
- **Security**: Authentication/authorization at transport layer

---

### Layer 4: Backend State - Python Objects and Business Logic

**What Lives Here:**
- Component class instances
- OntologyBuilderUnified state
- Circuit validation results
- Parameter dictionaries
- Regulation network graphs

**Data Transformation: cellboard → Hardware Format**

```python
# Input: Cellboard from frontend
cellboard = {
    'Promoter': [{'x': '0', 'y': '0', 'gene': 'Gene 1', 'strength': 'norm'}],
    'RBS': [{'x': '1', 'y': '0', 'gene': 'Gene 1', 'strength': 'norm'}],
    'CDS': [{'x': '2', 'y': '0', 'gene': 'Gene 1', 'strength': 'norm'}]
}

# Step 1: Flatten to positioned components
placed_components = []
for component_type, components in cellboard.items():
    for comp in components:
        x = int(comp['x'])
        y = int(comp['y'])
        channel = y * 8 + x  # Convert 2D to 1D position
        
        placed_components.append({
            'channel': channel,
            'name': f"{component_type.lower()}_{len([...]) + 1}",
            'type': component_type,
            'strength': comp.get('strength', 'norm'),
            'position': channel
        })

# Step 2: Sort by position (left-to-right, top-to-bottom)
placed_components.sort(key=lambda x: x['position'])

# Step 3: Generate hardware format lines
lines = []
for comp in placed_components:
    line = f"MUX A, Channel {comp['channel']}:  ['{comp['name']}'] strength={comp['strength']}"
    lines.append(line)

# Output: Hardware format (parseable by circuit_model.py)
# ['MUX A, Channel 0:  [\'promoter_1\'] strength=norm',
#  'MUX A, Channel 1:  [\'rbs_1\'] strength=norm',
#  'MUX A, Channel 2:  [\'cds_1\'] strength=norm']
```

**Component Instance Creation:**

```python
# Parse hardware format → Component objects
class Component:
    def __init__(self, label, type_str, mux, channel, strength="norm"):
        self.label = label           # "promoter_1"
        self.type = type_str          # "promoter"
        self.mux = mux                # "A"
        self.channel = channel        # 0
        self.strength = strength      # "norm"
        self.parameters = {}          # Filled later from constants
        self.is_regulator = False
        self.circuit_name = None
        self.global_idx = None

# Created by OntologyBuilderUnified.parse_text_file()
comp = Component(
    label="promoter_1",
    type_str="promoter",
    mux="A",
    channel=0,
    strength="norm"
)
```

**OntologyBuilder State:**

```python
class OntologyBuilderUnified:
    def __init__(self, constants):
        # Component storage
        self.items = []                    # List[Component] - all parsed components
        self.comp_to_circuit = {}          # {comp_id: circuit_name}
        self.valid_comp_ids = set()        # Set of valid component IDs
        
        # Circuit storage
        self.circuits = []                 # List[Dict] - circuit blocks
        
        # Regulation tracking
        self.regulations = []              # List[Dict] - regulation relationships
        self.regulators = defaultdict(lambda: {
            "starts": [], "ends": [], "type": None, "is_floating": None
        })
        
        # Validation results
        self.unpaired_regulators = []      # List[Dict] - validation issues
        self.regulator_issues = []         # List[Dict] - placement issues
        self.extra_components_found = {
            "within_valid_circuits": [],   # Extra components inside circuits
            "misplaced_components": [],    # Components in wrong positions
            "outside_any_circuit": []      # Orphaned components
        }
        
        # Parameters
        self.constants = constants         # Component parameter database

# After parsing and building
builder.circuits = [
    {
        'name': 'circuit_1',
        'components': [
            {'type': 'promoter', 'name': 'promoter_1', 'parameters': {...}},
            {'type': 'rbs', 'name': 'rbs_1', 'parameters': {...}},
            {'type': 'cds', 'name': 'cds_1', 'parameters': {...}}
        ],
        'extras': [],
        'misplaced': [],
        'component_counts': {'promoter': 1, 'rbs': 1, 'cds': 1},
        'fallback_by_cds': {}
    }
]

builder.regulations = [
    {
        'type': 'transcriptional_repression',
        'source': 'cds_1',
        'targets': ['cds_2'],
        'Kr': 0.5,
        'n': 2
    }
]
```

**Parameter Dictionary Construction:**

```python
# Build per-CDS parameter dictionaries for ODE system
cds_params = {}

for cds_id in cds_list:
    comp = id2comp[cds_id]  # Component object
    circuit = id2circ[cds_id]  # Circuit dict
    
    # Extract biological parameters
    promoter_strength = find_promoter(circuit)['parameters']['strength']
    rbs_efficiency = find_rbs(circuit)['parameters']['efficiency']
    translation_rate = comp['parameters']['translation_rate']
    degradation_rate = comp['parameters']['degradation_rate']
    initial_conc = comp['parameters']['init_conc']
    
    # Calculate production rate
    kprod = promoter_strength * rbs_efficiency * translation_rate
    k0 = 0.01 * kprod  # Basal leakage
    
    # Store in parameter dict
    cds_params[cds_id] = {
        'kprod': kprod,
        'k0': k0,
        'degradation': degradation_rate,
        'initial_conc': initial_conc,
        'Kr': {},  # Filled per-regulation
        'Ka': {},  # Filled per-regulation
        'n': {}    # Filled per-regulation
    }

# Add regulation parameters
for reg in builder.regulations:
    source = reg['source']
    targets = reg['targets']
    
    for target in targets:
        if reg['type'] in ['transcriptional_repression', 'self_repression']:
            cds_params[target]['Kr'][source] = reg['Kr']
            cds_params[target]['n'][source] = reg['n']
        elif reg['type'] in ['transcriptional_activation', 'self_activation']:
            cds_params[target]['Ka'][source] = reg['Ka']
            cds_params[target]['n'][source] = reg['n']
```

**Partitioning Purpose:**
- **Business Logic Isolation**: Circuit validation separate from transport
- **Type Safety**: Python type hints and validation
- **Testability**: Unit test business logic without HTTP
- **Scalability**: Could move to microservices architecture
- **Domain Modeling**: Rich object model matches biological concepts

---

### Layer 5: Computational Layer - Numerical Data and Scientific Computing

**What Lives Here:**
- NumPy arrays (time series, concentrations)
- SciPy ODE solutions
- Matplotlib figure objects
- Parameter matrices
- Hill function evaluations

**ODE System Construction:**

```python
import numpy as np
from scipy.integrate import odeint

# Map CDS IDs to indices
cds_list = ['cds_1', 'cds_2', 'cds_3']  # From circuit analysis
num_proteins = len(cds_list)

# Initial conditions vector
p0 = np.array([
    cds_params['cds_1']['initial_conc'],  # Protein 1
    cds_params['cds_2']['initial_conc'],  # Protein 2
    cds_params['cds_3']['initial_conc']   # Protein 3
])
# Shape: (3,)

# Time vector
t = np.linspace(0, 24, 200)  # 0-24 hours, 200 time points
# Shape: (200,)

# Define ODE system
def rhs(p, t):
    """
    Right-hand side of protein ODEs
    p: protein concentration vector [P1, P2, P3, ...]
    t: current time (not used in autonomous system)
    Returns: dpdt vector [dP1/dt, dP2/dt, dP3/dt, ...]
    """
    dpdt = np.zeros(num_proteins)  # Shape: (3,)
    
    for i, cds_id in enumerate(cds_list):
        pars = cds_params[cds_id]
        
        # Start with maximum production
        f_vals = []  # Regulation factors
        
        # Apply repression factors
        for source_cds, Kr in pars['Kr'].items():
            n = pars['n'][source_cds]
            source_idx = cds_list.index(source_cds)
            repressor_conc = p[source_idx]
            
            # Hill function for repression
            f_rep = Kr**n / (Kr**n + repressor_conc**n)
            f_vals.append(f_rep)
        
        # Apply activation factors
        for source_cds, Ka in pars['Ka'].items():
            n = pars['n'][source_cds]
            source_idx = cds_list.index(source_cds)
            activator_conc = p[source_idx]
            
            # Hill function for activation
            f_act = activator_conc**n / (Ka**n + activator_conc**n)
            f_vals.append(f_act)
        
        # Combined regulation effect (product of all factors)
        f_prod = np.prod(f_vals) if f_vals else 1.0
        
        # ODE: dP/dt = production - degradation
        dpdt[i] = pars['k0'] + pars['kprod'] * f_prod - pars['degradation'] * p[i]
    
    return dpdt

# Solve ODE system
sol = odeint(rhs, p0, t)
# Shape: (200, 3) - 200 time points × 3 proteins
```

**Solution Array Structure:**

```python
# sol is a 2D NumPy array
# Rows: time points (200)
# Columns: proteins (3)

sol.shape  # (200, 3)

# Extract individual protein time series
protein1_timeseries = sol[:, 0]  # All time points for protein 1
protein2_timeseries = sol[:, 1]  # All time points for protein 2
protein3_timeseries = sol[:, 2]  # All time points for protein 3

# Time point extraction
initial_concentrations = sol[0, :]   # [P1(0), P2(0), P3(0)]
final_concentrations = sol[-1, :]    # [P1(24h), P2(24h), P3(24h)]
midpoint_concentrations = sol[100, :] # [P1(12h), P2(12h), P3(12h)]
```

**Visualization Generation:**

```python
import matplotlib.pyplot as plt

# Create figure
fig, ax = plt.subplots(figsize=(10, 6))

# Plot each protein
colors = ['#1f77b4', '#ff7f0e', '#2ca02c']
display_names = ['Protein 1, Gene 1', 'Protein 2, Gene 2', 'Protein 3, Gene 3']

for i, (cds_id, display_name) in enumerate(zip(cds_list, display_names)):
    # Add noise for visual separation (constitutive circuits)
    noise_amplitude = 0.02 * np.max(sol[:, i])
    noise = np.random.normal(0, noise_amplitude, len(t))
    
    data_to_plot = sol[:, i] + noise
    
    ax.plot(t, data_to_plot, 
            linewidth=2, 
            label=display_name,
            color=colors[i],
            alpha=0.9)

ax.set_xlabel('Time (hours)')
ax.set_ylabel('Concentration (μM)')
ax.set_title('Genetic Circuit Simulation')
ax.legend(shadow=True)
ax.grid(True, alpha=0.3)

# Convert to base64 for transport
import io, base64
img_buffer = io.BytesIO()
fig.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
img_buffer.seek(0)
plot_base64 = base64.b64encode(img_buffer.read()).decode()
plt.close(fig)

# plot_base64 can now be sent to frontend
```

**Data Export Structure:**

```python
# Prepare time series for JSON export
time_series = {
    'time': t.tolist(),  # NumPy array → Python list
    'Protein 1, Gene 1': sol[:, 0].tolist(),
    'Protein 2, Gene 2': sol[:, 1].tolist(),
    'Protein 3, Gene 3': sol[:, 2].tolist()
}

# Final concentrations
final_concentrations = {
    'Protein 1, Gene 1': float(sol[-1, 0]),  # NumPy float → Python float
    'Protein 2, Gene 2': float(sol[-1, 1]),
    'Protein 3, Gene 3': float(sol[-1, 2])
}

# Statistics
statistics = {
    'max_concentrations': {
        'Protein 1, Gene 1': float(np.max(sol[:, 0])),
        'Protein 2, Gene 2': float(np.max(sol[:, 1])),
        'Protein 3, Gene 3': float(np.max(sol[:, 2]))
    },
    'min_concentrations': {
        'Protein 1, Gene 1': float(np.min(sol[:, 0])),
        'Protein 2, Gene 2': float(np.min(sol[:, 1])),
        'Protein 3, Gene 3': float(np.min(sol[:, 2]))
    },
    'mean_concentrations': {
        'Protein 1, Gene 1': float(np.mean(sol[:, 0])),
        'Protein 2, Gene 2': float(np.mean(sol[:, 1])),
        'Protein 3, Gene 3': float(np.mean(sol[:, 2]))
    }
}
```

**Partitioning Purpose:**
- **Performance**: Vectorized NumPy operations (100x faster than Python loops)
- **Scientific Accuracy**: Use validated numerical libraries
- **Scalability**: Handle large parameter spaces
- **Reproducibility**: Deterministic numerical results
- **Analysis**: Statistical analysis on raw numerical data

---

### Cross-Layer Data Flow: Complete Example

Let's trace a single component placement through all layers:

#### **User Action: Drag promoter to position (2, 1)**

```
LAYER 1: Visual Layer
├─ Event: jQuery draggable 'drop' event fired
├─ DOM Element: <div class="cell" data-x="2" data-y="1">
└─ Visual Feedback: Cell highlights on hover
           ↓
LAYER 2: Frontend State
├─ Update: cellboard.Promoter.push({x: "2", y: "1", gene: "Gene 1", strength: "norm"})
├─ State: cellboard now has 1 promoter
└─ Render: Call renderComponent() to update Layer 1
           ↓
           User clicks "Simulate"
           ↓
LAYER 3: Transport Layer
├─ Serialization: JSON.stringify(cellboard)
├─ HTTP POST: /simulate endpoint
├─ Payload Size: ~500 bytes (1 promoter + metadata)
└─ Content-Type: application/json
           ↓
LAYER 4: Backend State
├─ Deserialization: request.get_json()
├─ Transformation: cellboard → hardware format
│  └─ "MUX A, Channel 17:  ['promoter_1'] strength=norm"
├─ Parsing: Create Component(label="promoter_1", type="promoter", ...)
├─ Building: OntologyBuilder groups into circuits
├─ Parameters: Assign strength=5.0 from constants.py
└─ Validation: Check circuit structure
           ↓
LAYER 5: Computational Layer
├─ Parameter: promoter_strength = 5.0
├─ ODE Construction: kprod = 5.0 * rbs_efficiency * translation_rate
├─ Simulation: odeint(rhs, p0, t)
├─ Solution: NumPy array shape (200, 1) - 1 protein over 200 time points
├─ Visualization: Matplotlib plot generation
└─ Export: Convert to base64 PNG
           ↓
LAYER 4: Backend State
├─ Response Construction: Build JSON response
├─ Include: plot, circuits, equations, time_series
└─ Return: jsonify(response)
           ↓
LAYER 3: Transport Layer
├─ Serialization: Python dict → JSON string
├─ HTTP 200: Success response
└─ Payload Size: ~50 KB (base64 plot + data)
           ↓
LAYER 2: Frontend State
├─ Deserialization: JSON.parse(responseText)
├─ Update: simulationResults = response
└─ Cache: Store for later display
           ↓
LAYER 1: Visual Layer
├─ DOM Update: $('#plot-image').attr('src', plot_base64)
├─ MathJax: Render LaTeX equations
└─ Display: Show results container
```

---

### Data Persistence and Caching

**Where Data Persists:**

1. **Browser Memory (Ephemeral)**
   - `cellboard` object
   - `simulationResults` object
   - Cleared on page refresh

2. **LocalStorage (Persistent)**
   ```javascript
   // Save board state
   localStorage.setItem('saved_board', JSON.stringify(cellboard));
   
   // Load board state
   const savedBoard = JSON.parse(localStorage.getItem('saved_board'));
   
   // Transfer between pages (EEPROM → Dial)
   localStorage.setItem('imported_board', JSON.stringify(cellboard));
   ```

3. **Session Memory (Per-Tab)**
   ```javascript
   sessionStorage.setItem('current_simulation', JSON.stringify(results));
   ```

4. **Server Memory (Stateless)**
   - Flask application: No persistent state
   - Each request is independent
   - No database in current architecture

**Future Extension: Database Layer**

```python
# Potential Layer 6: Persistence Layer
class SimulationRecord:
    id: int
    user_id: int
    cellboard: JSON  # Stored as JSON column
    parameters: JSON
    results: JSON
    created_at: datetime
    
# Save simulation
db.session.add(SimulationRecord(
    user_id=current_user.id,
    cellboard=cellboard,
    results=simulation_results
))
db.session.commit()
```

---

### Data Validation at Each Layer

**Layer 1 (Visual):**
- Cell occupancy checking
- Drag bounds validation
- Component type validation

**Layer 2 (Frontend State):**
```javascript
function validateCellboard(cellboard) {
    // Check for duplicate positions
    const positions = new Set();
    for (let type in cellboard) {
        for (let comp of cellboard[type]) {
            const key = `${comp.x},${comp.y}`;
            if (positions.has(key)) {
                return {valid: false, error: 'Duplicate position'};
            }
            positions.add(key);
        }
    }
    
    // Check for required components
    const hasCDS = cellboard.CDS && cellboard.CDS.length > 0;
    if (!hasCDS) {
        return {valid: false, error: 'At least one CDS required'};
    }
    
    return {valid: true};
}
```

**Layer 3 (Transport):**
```python
# Flask validation
data = request.get_json()
if not data or 'cellboard' not in data:
    return jsonify({'status': 'error', 'message': 'Invalid request'}), 400
```

**Layer 4 (Backend State):**
```python
# Circuit validation
if not any(c.type == "cds" for c in components):
    return  # Skip circuit without CDS

# Regulation validation
if len(starts) != len(ends):
    self.unpaired_regulators.append({
        'issue': 'Missing start/end pairs'
    })
```

**Layer 5 (Computational):**
```python
# Numerical validation
if np.any(np.isnan(sol)):
    raise ValueError('ODE solver produced NaN values')
    
if np.any(sol < 0):
    warnings.append('Negative concentrations detected (numerical artifact)')
```

---

### Summary: Data Partitioning Benefits

| Layer | Responsibility | Data Format | Why Partitioned |
|-------|----------------|-------------|-----------------|
| **Visual** | User interaction | HTML/DOM | Immediate feedback, platform-specific rendering |
| **Frontend State** | Application logic | JavaScript objects | Single source of truth, testable logic |
| **Transport** | Communication | JSON | Protocol independence, API versioning |
| **Backend State** | Business logic | Python objects | Domain modeling, type safety |
| **Computational** | Scientific computing | NumPy arrays | Performance, numerical accuracy |

**Key Insights:**

1. **Unidirectional Flow**: Data flows down (user → computation) then back up (results → user)
2. **Transformation Points**: Each layer boundary transforms data format
3. **Validation Cascade**: Each layer validates data appropriate to its responsibility
4. **Performance Optimization**: Heavy computation isolated in Layer 5
5. **Maintainability**: Each layer can be modified independently

This architecture ensures **separation of concerns**, **testability**, **scalability**, and **maintainability** while providing a seamless user experience.

---

## Key Algorithms

### 1. Circuit Block Detection

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
```

**Logic**: Components separated by gaps (missing positions) are treated as separate circuits.

---

### 2. Extra Component Detection

```python
# Detect extra promoters (only 1 allowed per circuit)
if type_counts["promoter"] > 1:
    promoter_comps = [c for c in comps if c.type == "promoter"]
    for i in range(1, len(promoter_comps)):
        extras.append({...promoter_comps[i], "reason": "Extra promoter"})

# Detect invalid RBS sequences (rbs-rbs-cds-cds is invalid)
# Valid: rbs-cds-rbs-cds (alternating) or rbs-cds-cds-cds (grouped)
extras.extend(_validate_rbs_sequence_patterns(comps))
```

---

### 3. Regulation Building

```python
for end in regulator_ends:
    # Find promoter immediately before this end element
    prom = _nearest_prev_non_reg(end)
    
    # Find all CDS downstream of that promoter
    affected_cds = _downstream_cds(end.circuit_name, prom.global_idx)
    
    for start in regulator_starts:
        # Find CDS that produces this regulator protein
        source_cds = _nearest_prev_non_reg(start)
        
        # Create regulation record
        regulation = {
            "type": regulation_type_map[regulator.type],
            "source": source_cds.label,
            "targets": affected_cds,
            "Kr" or "Ka": regulator.parameters["Kr" or "Ka"],
            "n": regulator.parameters["n"]
        }
```

---

### 4. ODE Solution with Symmetry Breaking

```python
# Initial conditions
p0 = [cds_params[cds]["init_conc"] for cds in cds_list]

# For repressilator (3+ proteins with feedback), break symmetry
if len(p0) >= 3 and has_regulatory_feedback and all(p == 0 for p in p0):
    p0 = [1.0, 0.1, 0.05]  # Asymmetric start → enables oscillations
else:
    p0 = [0.01] * len(p0)  # Equal small start → constitutive circuits

# Solve ODEs
t = np.linspace(0, 24, 200)  # 24 hours, 200 time points
sol = odeint(rhs, p0, t)
```

---

## Frontend-Backend Integration

### API Endpoints

#### **POST /simulate**
**Request**:
```json
{
  "cellboard": {
    "Promoter": [{"x": "0", "y": "0", "gene": "Gene 1", "strength": "norm"}],
    "RBS": [{"x": "1", "y": "0", "gene": "Gene 1", "strength": "norm"}],
    "CDS": [{"x": "2", "y": "0", "gene": "Gene 1", "strength": "norm"}]
  },
  "dial": {
    "promoter1_strength": 10.0,
    "global_transcription_rate": 1.5
  },
  "apply_dial": true
}
```

**Response**:
```json
{
  "status": "success",
  "plot": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "circuits": [
    {
      "name": "circuit_1",
      "components": [
        {"type": "promoter", "name": "promoter_1"},
        {"type": "rbs", "name": "rbs_1"},
        {"type": "cds", "name": "cds_1"}
      ]
    }
  ],
  "regulations": [],
  "equations": {
    "Protein 1, Gene 1": {
      "latex": "\\frac{d[P1]}{dt} = k_{prod} - \\gamma \\cdot [P1]",
      "description": "Degradation rate (γ)"
    }
  },
  "time_series": {
    "time": [0, 0.12, 0.24, ...],
    "Protein 1, Gene 1": [0.01, 0.15, 0.28, ...]
  },
  "warnings": [],
  "errors": []
}
```

---

#### **POST /interpret_hardware**
**Request**:
```json
{
  "log_lines": [
    "> sm a 0",
    "00: 70 72 6F 6D 6F 74 65 72 5F 31 00",
    "> sm a 1",
    "00: 72 62 73 5F 31 00"
  ]
}
```

**Response**:
```json
{
  "status": "success",
  "channel_data": {
    "MUX_A_CH_0": ["promoter_1"],
    "MUX_A_CH_1": ["rbs_1"]
  },
  "cellboard": {
    "Promoter": [{"x": "0", "y": "0", "gene": "Gene 1"}],
    "RBS": [{"x": "1", "y": "0", "gene": "Gene 1"}]
  },
  "component_count": 2
}
```

---

#### **GET /api/constants**
**Response**: Returns `COMPONENT_CONSTANTS` dictionary for dial interface

---

## Summary

### How Each File Adds Value

| File | Primary Value | Data Handled |
|------|--------------|--------------|
| **app.py** | Request routing, data transformation | HTTP requests → hardware format → JSON responses |
| **circuit_model.py** | Core biological modeling, circuit validation | Component objects, regulations, circuit structure |
| **circuit_analysis.py** | ODE simulation engine | Numerical integration, protein concentrations over time |
| **constants.py** | Biological parameter database | Transcription rates, degradation rates, Hill coefficients |
| **dial.html** | Visual circuit designer | User interactions, component placement |
| **eeprom.html** | Hardware integration | Serial communication, EEPROM hex data |
| **script.js** | Frontend state management | Cellboard state, drag-drop events, API calls |
| **eeprom.js** | Hardware communication | WebSerial commands, hex parsing |

---

### Data Transformation Pipeline

```
User Visual Design (cellboard)
  → Hardware Format (MUX/Channel lines)
    → Component Objects (parsed structure)
      → Circuit Blocks (validated groups)
        → ODE System (mathematical model)
          → Numerical Solution (protein concentrations)
            → Matplotlib Plot (visualization)
              → Base64 PNG (web response)
                → Display in Browser
```

This architecture enables seamless integration between biological modeling, hardware interfacing, and user interaction, making genetic circuit design accessible through an intuitive web interface.


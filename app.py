from services.hardware_parser import (
    parse_hardware_log,
    convert_hardware_to_cellboard,
)
from services.equations import generate_equation_display
from services.cellboard import cellboard_to_hardware_lines
from services.dial_params import apply_dial_adjustments

import os
import logging
import json
import base64
import zipfile
import tempfile
from io import BytesIO
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import matplotlib.colors as mcolors


from circuit_model import OntologyBuilderUnified, simulate_circuit
from constants import COMPONENT_CONSTANTS

last_simulation_export_data = None

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")
CORS(app)

# Initialize circuit model with constants
circuit_builder = OntologyBuilderUnified(COMPONENT_CONSTANTS)

@app.route('/')
def loading():
    """Loading splash screen"""
    return render_template('loading.html')

@app.route('/home')
def home():
    """Home page with navigation menu"""
    return render_template('home.html')

@app.route('/dial')
def dial():
    """Dial mode page for parameter adjustment"""
    return render_template('dial.html')

@app.route('/eeprom')
def eeprom():
    """EEPROM control page for hardware integration"""
    return render_template('eeprom.html')

@app.route('/about')
def about():
    """About page with team information"""
    return render_template('about.html')

@app.route('/simulate', methods=['POST'])
def simulate():
    """Enhanced simulation endpoint using Version 15.3 modeling"""
    try:
        data = request.get_json()
        
        if not data or 'cellboard' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Invalid request data. Expected cellboard configuration.'
            }), 400
        
        cellboard = data['cellboard']

       
        # Explicit flag from client telling whether dial overrides should be applied
        apply_dial = bool(data.get('apply_dial', False))
        # Always use dial_data if present (it contains 1.0 defaults when toggle is off)
        dial_data = data.get('dial', {})
        
        # Debug logging
        print(f"\n{'='*80}")
        print(f"[SIMULATION REQUEST]")
        print(f"{'='*80}")
        print(f"  - Apply dial flag: {apply_dial}")
        print(f"  - Dial data present in request: {'dial' in data}")
        print(f"  - Dial parameters received: {len(dial_data)} items")
        if dial_data:
            print(f"  - Global parameters in dial_data:")
            for key in ['global_transcription_rate', 'global_translation_rate', 'global_degradation_rate', 'temperature_factor', 'resource_availability']:
                if key in dial_data:
                    print(f"      {key}: {dial_data[key]}")
            if apply_dial:
                print(f"  - ✓ Global parameters WILL BE APPLIED (toggle ON)")
            else:
                print(f"  - ✓ Using default values 1.0 (toggle OFF - no effect)")
        else:
            print(f"  - NO dial parameters (using base component values)")
        print(f"  - Cellboard components: {sum(len(comps) for comps in cellboard.values())}")
        print(f"{'='*80}\n")

        placed_components, final_lines = cellboard_to_hardware_lines(cellboard)

        adjusted_constants = apply_dial_adjustments(COMPONENT_CONSTANTS, dial_data)


        if not final_lines:
            return jsonify({
                'status': 'error',
                'message': 'No components placed on the board. Please place some components first.'
            }), 400
        
        
        # Debug: Show the converted hardware txt format
        print("=== CONVERTED HARDWARE TXT FORMAT ===")
        for line in final_lines:
            print(f"  {line}")
        print("=====================================")
        

        # Apply per-component parameters from the modal (highest priority).
        # We use TWO different numbers per component:
        #   - `comp_num` (pair_id for regulators) → drives `comp_name`, which is the
        #     key circuit_model.py uses when it looks up adjusted_constants.
        #   - `modal_num` (the number the user actually saw in the modal) → drives
        #     the param_mapping lookup keys (e.g. "cds3_degradation_rate"), which is
        #     what the frontend baked into comp['parameters'].
        # Override values are written under `comp_name` so the simulator picks them up.
        for comp in placed_components:
            comp_name = comp['name']
            base_type = comp['base_type']
            comp_num  = comp['comp_number']     # pair_id for regulators, sequential otherwise
            modal_num = comp.get('modal_number')
            if modal_num is None:
                modal_num = comp.get('number')
            if modal_num is None:
                modal_num = comp_num
            modal_num = int(modal_num)   # the number the modal used in its param keys
            params    = comp.get('parameters', {})

            if not params:
                continue

            if comp_name not in adjusted_constants:
                adjusted_constants[comp_name] = {}

            # IMPORTANT: param_mapping lookup keys are built with modal_num so they
            # match the keys the frontend modal baked into params.
            param_mapping = {
                'promoter':   {f'promoter{modal_num}_strength': 'strength'},
                'rbs':        {f'rbs{modal_num}_efficiency': 'efficiency'},
                'cds': {
                    f'cds{modal_num}_translation_rate': 'translation_rate',
                    f'cds{modal_num}_degradation_rate': 'degradation_rate',
                    f'protein{modal_num}_initial_conc': 'init_conc',
                },
                'terminator': {f'terminator{modal_num}_efficiency': 'efficiency'},
                'repressor_start': {
                    f'repressor{modal_num}_Kr': 'Kr',
                    f'repressor{modal_num}_n': 'n',
                    f'repressor{modal_num}_concentration': 'concentration',
                },
                'repressor_end': {
                    f'repressor{modal_num}_Kr': 'Kr',
                    f'repressor{modal_num}_n': 'n',
                    f'repressor{modal_num}_concentration': 'concentration',
                },
                'activator_start': {
                    f'activator{modal_num}_Ka': 'Ka',
                    f'activator{modal_num}_n': 'n',
                    f'activator{modal_num}_concentration': 'concentration',
                },
                'activator_end': {
                    f'activator{modal_num}_Ka': 'Ka',
                    f'activator{modal_num}_n': 'n',
                    f'activator{modal_num}_concentration': 'concentration',
                },
                'inducer_start': {
                    f'inducer{modal_num}_Ka': 'Ka',
                    f'inducer{modal_num}_n': 'n',
                    f'inducer{modal_num}_concentration': 'concentration',
                },
                'inducer_end': {
                    f'inducer{modal_num}_Ka': 'Ka',
                    f'inducer{modal_num}_n': 'n',
                    f'inducer{modal_num}_concentration': 'concentration',
                },
                'inhibitor_start': {
                    f'inhibitor{modal_num}_Kr': 'Kr',
                    f'inhibitor{modal_num}_n': 'n',
                    f'inhibitor{modal_num}_concentration': 'concentration',
                },
                'inhibitor_end': {
                    f'inhibitor{modal_num}_Kr': 'Kr',
                    f'inhibitor{modal_num}_n': 'n',
                    f'inhibitor{modal_num}_concentration': 'concentration',
                },
            }

            # For regulators, also mirror writes onto the reg_key entry
            # (e.g. "repressor_5") since circuit_model.py looks under start.reg_key
            # in addition to start.label. comp_num is pair_id here, matching what
            # circuit_model derives from start.reg_key.
            reg_key = None
            regulator_types = (
                'repressor_start', 'repressor_end',
                'activator_start', 'activator_end',
                'inducer_start',   'inducer_end',
                'inhibitor_start', 'inhibitor_end',
            )
            if base_type in regulator_types:
                reg_base = base_type.replace('_start', '').replace('_end', '')
                reg_key = f"{reg_base}_{comp_num}"
                if reg_key not in adjusted_constants:
                    adjusted_constants[reg_key] = {}

            mapping = param_mapping.get(base_type, {})
            for frontend_key, backend_key in mapping.items():
                if frontend_key in params:
                    try:
                        val = float(params[frontend_key])
                        adjusted_constants[comp_name][backend_key] = val
                        print(f"[PARAM OVERRIDE] {comp_name}.{backend_key} = {val} (modal key '{frontend_key}', modal_num={modal_num}, comp_num={comp_num})")
                        if reg_key:
                            adjusted_constants[reg_key][backend_key] = val
                            print(f"[PARAM OVERRIDE] Mirrored to reg_key '{reg_key}'")
                    except (ValueError, TypeError):
                        print(f"[PARAM OVERRIDE] Skipping invalid value for {comp_name}.{backend_key}: {params[frontend_key]}")

        # Create new builder with adjusted constants
        builder = OntologyBuilderUnified(adjusted_constants)
        
        # Parse the component lines
        builder.parse_text_file(final_lines)
        builder.build()
        
        # Read colormap choice (validated against allowed list)
        _ALLOWED_COLORMAPS = {'cool', 'spring', 'autumn', 'turbo', 'plasma'}
        chosen_colormap = data.get('colormap', 'cool')
        
        print(f"[COLORMAP DEBUG] app.py is passing colormap='{chosen_colormap}' to simulate_circuit")
        if chosen_colormap not in _ALLOWED_COLORMAPS:
            chosen_colormap = 'cool'

        # Run simulation
        result = simulate_circuit(builder, colormap=chosen_colormap)
        
        if result.get('status') == 'error':
            return jsonify(result), 400

        # Store export data from this simulation for /export_script
        global last_simulation_export_data
        if result.get('export_data'):
            last_simulation_export_data = result['export_data']
            last_simulation_export_data['colormap'] = chosen_colormap

        # Generate equation representations
        equations = generate_equation_display(builder, result)
        
        # Use the styled plot already generated by simulate_circuit.
        plot_data = result.get('plot', '')
        
        # Prepare component parameters for display
        component_parameters = []
        for comp in placed_components:
            comp_key = comp['name']
            params = {}
            
            # Get parameters from adjusted_constants if they exist
            if comp_key in adjusted_constants:
                const_data = adjusted_constants[comp_key]
                if comp['type'] in ['Promoter']:
                    params = {
                        'strength': const_data.get('strength', 'N/A')
                    }
                elif comp['type'] == 'RBS':
                    params = {
                        'efficiency': const_data.get('efficiency', 'N/A')
                    }
                elif comp['type'] == 'CDS':
                    params = {
                        'translation_rate': const_data.get('translation_rate', 'N/A'),
                        'degradation_rate': const_data.get('degradation_rate', 'N/A'),
                        'init_concentration': const_data.get('init_conc', 'N/A')
                    }
                elif comp['type'] == 'Terminator':
                    params = {
                        'efficiency': const_data.get('efficiency', 'N/A')
                    }
                elif comp['type'] in ['Repressor', 'Repressor Start', 'Repressor End']:
                    params = {
                        'Kr': const_data.get('Kr', 'N/A'),
                        'n': const_data.get('n', 'N/A'),
                        'type': const_data.get('type', 'repressor'),
                        'is_floating': const_data.get('is_floating', False)
                    }
                elif comp['type'] in ['Activator', 'Activator Start', 'Activator End']:
                    params = {
                        'Ka': const_data.get('Ka', 'N/A'),
                        'n': const_data.get('n', 'N/A'),
                        'type': const_data.get('type', 'activator'),
                        'is_floating': const_data.get('is_floating', False)
                    }
                elif comp['type'] in ['Inducer Start', 'Inducer End']:
                    params = {
                        'Ka': const_data.get('Ka', 'N/A'),
                        'n': const_data.get('n', 'N/A'),
                        'concentration': const_data.get('concentration', 'N/A'),
                        'type': const_data.get('type', 'inducer'),
                        'is_floating': const_data.get('is_floating', True)
                    }
                elif comp['type'] in ['Inhibitor Start', 'Inhibitor End']:
                    params = {
                        'Kr': const_data.get('Kr', 'N/A'),
                        'n': const_data.get('n', 'N/A'),
                        'concentration': const_data.get('concentration', 'N/A'),
                        'type': const_data.get('type', 'inhibitor'),
                        'is_floating': const_data.get('is_floating', True)
                    }
            
            comp_entry = {
            'name': comp['name'],
            'type': comp['type'],
            'strength': comp['strength'],
            'position': comp['position'],
            'parameters': params
            }
            if comp.get('customName'):
                comp_entry['custom_name'] = comp['customName']
            if comp.get('geneName'):
                comp_entry['gene_name'] = comp['geneName']
            component_parameters.append(comp_entry)
            
    
        
        # Prepare detailed response
        response_data = {
            'status': 'success',
            'plot': plot_data,
            'circuits': result.get('circuits', []),
            'regulations': result.get('regulations', []),
            'unpaired_regulators': result.get('unpaired_regulators', []),
            'equations': equations,
            'protein_mapping': result.get('protein_mapping', {}),
            'time_series': result.get('time_series', {}),
            'components_analyzed': len(placed_components),
            'component_parameters': component_parameters,
            'errors': result.get('errors', []),
            'warnings': result.get('warnings', []),
            'global_parameters_applied': apply_dial,
            'global_parameters': {k: v for k, v in dial_data.items() if k in ['global_transcription_rate', 'global_translation_rate', 'global_degradation_rate', 'temperature_factor', 'resource_availability']} if apply_dial else {}
        }
        
        # Add circuit validation messages
        if result.get('regulator_issues'):
            response_data['warnings'].extend([
                f"Regulator issue: {issue.get('issue', str(issue))}" for issue in result['regulator_issues']
            ])
        
        if result.get('unpaired_regulators'):
            response_data['warnings'].extend([
                f"Unpaired regulator: {reg.get('label', str(reg))}" for reg in result['unpaired_regulators']
            ])
        
        return jsonify(response_data)
        
    except Exception as e:
        logging.error(f"Simulation error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Simulation failed: {str(e)}'
        }), 500

@app.route('/api/components')
def get_components():
    """Get available components and their properties"""
    components = {
        'Promoter': {'color': '#ff859c'},
        'Terminator': {'color': 'rgb(225, 218, 3)'},
        'RBS': {'color': '#f39c12'},
        'CDS': {'color': '#3C5EB4'},
        'Repressor Start': {'color': '#e12929'},
        'Repressor End': {'color': '#e12929'},
        'Activator Start': {'color': '#6ccd7e'},
        'Activator End': {'color': '#6ccd7e'},
        'Inducer Start': {'color': '#0e7b39'},
        'Inducer End': {'color': '#0e7b39'},
        'Inhibitor Start': {'color': '#920702'},
        'Inhibitor End': {'color': '#920702'}
    }
    return jsonify(components)

@app.route('/export_script')
def export_script():
    """Generate a standalone Python script that reproduces the last simulation plot"""
    global last_simulation_export_data
    if not last_simulation_export_data:
        return jsonify({'status': 'error', 'message': 'No simulation has been run yet. Run a simulation first.'}), 400

    ed = last_simulation_export_data
    protein_names = ed['protein_names']
    colors = ed['colors']
    has_regulatory_feedback = ed['has_regulatory_feedback']
    p0 = ed['p0']
    params_list = ed['params_list']
    regulations_list = ed['regulations_list']
    export_colormap = ed.get('colormap', 'cool')

    import json as _json
    params_repr = _json.dumps(params_list, indent=4)
    regs_repr = _json.dumps(regulations_list, indent=4)
    names_repr = _json.dumps(protein_names, indent=4)
    colors_repr = _json.dumps(colors, indent=4)
    p0_repr = _json.dumps(p0, indent=4)

    script_lines = [
        '"""',
        'Standalone genetic circuit simulation script.',
        'Generated by MAGiC Genetic Circuit Designer.',
        'Run this file directly to reproduce the simulation plot.',
        '',
        'Requirements: numpy, scipy, matplotlib',
        '  pip install numpy scipy matplotlib',
        '"""',
        '',
        'import numpy as np',
        'from scipy.integrate import odeint',
        'import matplotlib.pyplot as plt',
        '',
        '# ── Protein display names (in ODE order) ────────────────────────────────────',
        f'protein_names = {names_repr}',
        '',
        '# ── Per-protein ODE parameters ──────────────────────────────────────────────',
        '# Each entry matches the protein at the same index in protein_names.',
        '# k0         : basal (leaky) production rate',
        '# kprod      : max regulated production rate',
        '# degradation: first-order degradation rate constant',
        f'params_list = {params_repr}',
        '',
        '# ── Regulatory interactions ──────────────────────────────────────────────────',
        '# source_idx : index of the regulating protein (None = constitutive / external)',
        '# target_idx : index of the protein being regulated',
        '# type       : regulation type string',
        '# Kr / Ka    : Hill repression / activation constant',
        '# n          : Hill coefficient',
        '# concentration: fixed concentration used when source_idx is None and type is',
        '#               induced_activation or environmental_repression',
        f'regulations_list = {regs_repr}',
        '',
        '# ── Initial conditions [protein_0, protein_1, ...] (μM) ─────────────────────',
        f'p0 = {p0_repr}',
        '',
        f'# ── Plot colours — sampled from the "{export_colormap}" colormap ───────────',
        f'colors = {colors_repr}',
        '',
        '# ── Simulation flag ─────────────────────────────────────────────────────────',
        f'has_regulatory_feedback = {has_regulatory_feedback}',
        '',
        '# ── ODE right-hand side ─────────────────────────────────────────────────────',
        'def rhs(p, t):',
        '    dpdt = np.zeros(len(protein_names))',
        '    for i in range(len(protein_names)):',
        '        par = params_list[i]',
        '        f_vals = []',
        '        for reg in [r for r in regulations_list if r["target_idx"] == i]:',
        '            typ = reg["type"]',
        '            n   = reg.get("n", 2)',
        '            if typ == "constitutive":',
        '                f_vals.append(1.0)',
        '                continue',
        '            src_idx = reg.get("source_idx")',
        '            if src_idx is not None:',
        '                val = p[src_idx]',
        '            else:',
        '                val = reg.get("concentration", 1.0)',
        '            if typ in ("transcriptional_activation", "self_activation", "induced_activation"):',
        '                Ka = reg.get("Ka", 0.4)',
        '                f_vals.append(val**n / (Ka**n + val**n))',
        '            elif typ in ("transcriptional_repression", "self_repression", "environmental_repression"):',
        '                Kr = reg.get("Kr", 0.35)',
        '                f_vals.append(Kr**n / (Kr**n + val**n))',
        '        f_prod = np.prod(f_vals) if f_vals else 1.0',
        '        dpdt[i] = par["k0"] + par["kprod"] * f_prod - par["degradation"] * p[i]',
        '    return dpdt',
        '',
        '# ── Solve ODE ────────────────────────────────────────────────────────────────',
        't   = np.linspace(0, 24, 200)',
        'sol = odeint(rhs, p0, t)',
        '',
        '# ── Dark-theme colours (matching MAGiC app) ─────────────────────────────────',
        'PANEL_BG    = "#202c2d"',
        'AXES_BG     = "#192225"',
        'TEXT_COLOR  = "#d8ede0"',
        'GRID_COLOR  = "#2e4245"',
        'SPINE_COLOR = "#3a5558"',
        '',
        '# ── Reproduce identical plot (no artificial noise) ─────────────────',
        'fig, ax = plt.subplots(figsize=(10, 6))',
        'fig.patch.set_facecolor(PANEL_BG)',
        'ax.set_facecolor(AXES_BG)',
        'for spine in ax.spines.values():',
        '    spine.set_edgecolor(SPINE_COLOR)',
        'ax.tick_params(colors=TEXT_COLOR, labelsize=9)',
        'ax.xaxis.label.set_color(TEXT_COLOR)',
        'ax.yaxis.label.set_color(TEXT_COLOR)',
        'ax.title.set_color(TEXT_COLOR)',
        '',
        'for i, name in enumerate(protein_names):',
        '    data = sol[:, i]',
        '    final_data = data',
        '    ax.plot(t, final_data, linewidth=2.2, label=name, color=colors[i], alpha=0.92)',
        '',
        'ax.set_xlabel("Time (hours)", fontsize=10)',
        'ax.set_ylabel("Concentration (μM)", fontsize=10)',
        'ax.set_title("Genetic Circuit Simulation", fontsize=12, fontweight="bold", pad=12)',
        'ax.grid(True, color=GRID_COLOR, linewidth=0.7, linestyle="--", alpha=0.9)',
        'ax.legend(shadow=False, facecolor=PANEL_BG, edgecolor=SPINE_COLOR,',
        '          labelcolor=TEXT_COLOR, fontsize=9, framealpha=0.85)',
        'plt.tight_layout()',
        'plt.savefig("circuit_simulation.png", dpi=150, bbox_inches="tight",',
        '            facecolor=PANEL_BG)',
        'print("Saved circuit_simulation.png")',
        'plt.show()',
    ]

    script_text = '\n'.join(script_lines)
    script_bytes = script_text.encode('utf-8')
    script_buffer = BytesIO(script_bytes)
    script_buffer.seek(0)
    return send_file(
        script_buffer,
        mimetype='text/plain',
        as_attachment=True,
        download_name='circuit_simulation.py'
    )

@app.route('/api/constants')
def get_constants():
    """Get current component constants for dial mode"""
    return jsonify(COMPONENT_CONSTANTS)

@app.route('/api/parameter_defaults')
def get_parameter_defaults():
    """Get parameter defaults and ranges from constants.py"""
    from constants import PARAMETER_RANGES
    
    # Extract default values from COMPONENT_CONSTANTS
    defaults = {
        'promoter_strength': COMPONENT_CONSTANTS.get('promoter_1', {}).get('strength', 5.0),
        'rbs_efficiency': COMPONENT_CONSTANTS.get('rbs_1', {}).get('efficiency', 1.0),
        'cds_translation_rate': COMPONENT_CONSTANTS.get('cds_1', {}).get('translation_rate', 7.0),
        'cds_degradation_rate': COMPONENT_CONSTANTS.get('cds_1', {}).get('degradation_rate', 1.0),
        'cds_init_conc': COMPONENT_CONSTANTS.get('cds_1', {}).get('init_conc', 0.0),
        'terminator_efficiency': COMPONENT_CONSTANTS.get('terminator_1', {}).get('efficiency', 0.99),
        'repressor_Kr': COMPONENT_CONSTANTS.get('repressor_start_1', {}).get('Kr', 0.35),
        'repressor_n': COMPONENT_CONSTANTS.get('repressor_start_1', {}).get('n', 2),
        'activator_Ka': COMPONENT_CONSTANTS.get('activator_a', {}).get('Ka', 0.4),
        'activator_n': COMPONENT_CONSTANTS.get('activator_a', {}).get('n', 2),
    }
    
    return jsonify({
        'defaults': defaults,
        'ranges': PARAMETER_RANGES
    })

@app.route('/interpret_hardware', methods=['POST'])
def interpret_hardware():
    """Interpret hardware board data from EEPROM scan logs"""
    try:
        data = request.json or {}
        log_lines = data.get('log_lines', [])
        
        if not log_lines:
            return jsonify({
                'status': 'error',
                'message': 'No log lines provided'
            }), 400
        
        # Parse the hardware log lines to extract component data
        channel_data = parse_hardware_log(log_lines)
        
        # Convert to cellboard format
        cellboard = convert_hardware_to_cellboard(channel_data)
        
        # Calculate actual component count (exclude _scan_stats)
        actual_component_count = sum(
            len(components) for key, components in channel_data.items() 
            if key != '_scan_stats' and isinstance(components, list)
        )
        
        return jsonify({
            'status': 'success',
            'channel_data': channel_data,
            'cellboard': cellboard,
            'component_count': actual_component_count
        })
        
    except Exception as e:
        logging.error(f"Hardware interpretation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Hardware interpretation failed: {str(e)}'
        }), 500

@app.route('/export')
def export_project():
    """Export all project files as a ZIP archive"""
    try:
        # Create a temporary directory for the ZIP file
        with tempfile.TemporaryDirectory() as temp_dir:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            zip_filename = f"genetic_circuit_designer_{timestamp}.zip"
            zip_path = os.path.join(temp_dir, zip_filename)
            
            # Create ZIP file
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add main Python files
                main_files = [
                    'app.py',
                    'main.py', 
                    'circuit_model.py',
                    'constants.py',
                    'pyproject.toml',
                    'replit.md'
                ]
                
                for file in main_files:
                    if os.path.exists(file):
                        zipf.write(file, file)
                
                # Add templates directory
                templates_dir = 'templates'
                if os.path.exists(templates_dir):
                    for root, dirs, files in os.walk(templates_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arc_path = os.path.relpath(file_path, '.')
                            zipf.write(file_path, arc_path)
                
                # Add static directory
                static_dir = 'static'
                if os.path.exists(static_dir):
                    for root, dirs, files in os.walk(static_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arc_path = os.path.relpath(file_path, '.')
                            zipf.write(file_path, arc_path)
                
                # Add a README for the exported project
                readme_content = """# Genetic Circuit Designer - Exported Project

This is an exported copy of your Genetic Circuit Designer project.

## Files Included:
- app.py - Main Flask application
- main.py - Entry point for the application
- circuit_model.py - Circuit modeling and simulation engine
- constants.py - Component constants and parameters
- templates/ - HTML templates for the web interface
- static/ - CSS, JavaScript, and other static assets
- pyproject.toml - Project dependencies
- replit.md - Project documentation

## To Run:

### Option 1: Using Virtual Environment (Recommended)
1. Create and activate virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```
2. Install dependencies: `pip install -r requirements.txt`
3. Run the application: `python main.py`
4. Open your browser to http://localhost:5001

### Option 2: Using UV (Fast Package Manager)
1. Install UV: `pip install uv`
2. Install dependencies: `uv pip install -r requirements.txt`
3. Run the application: `python main.py`
4. Open your browser to http://localhost:5001

### Option 3: Direct Installation
1. Install dependencies: `pip install -r requirements.txt`
2. Run the application: `python main.py`
3. Open your browser to http://localhost:5001

**Port Configuration:**
- Uses port 5001 by default to avoid conflicts with macOS AirPlay Receiver on port 5000
- Set PORT environment variable to use different port: `PORT=8000 python main.py`
- To deactivate virtual environment when done: `deactivate`

## Features:
- Drag-and-drop circuit design interface
- Advanced genetic circuit simulation
- Parameter tuning with dial mode
- EEPROM hardware integration
- LaTeX equation display
- Export/import functionality

Generated on: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """
"""
                
                zipf.writestr('README.md', readme_content)
                
                # Create a requirements.txt file from pyproject.toml dependencies
                requirements_content = """flask
flask-cors
numpy
scipy
matplotlib
gunicorn
"""
                zipf.writestr('requirements.txt', requirements_content)
            
            # Send the ZIP file
            return send_file(
                zip_path,
                as_attachment=True,
                download_name=zip_filename,
                mimetype='application/zip'
            )
            
    except Exception as e:
        logging.error(f"Export error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Export failed: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Use port 5001 to avoid conflicts with macOS AirPlay Receiver on port 5000
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)

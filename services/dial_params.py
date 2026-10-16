# services/dial_params.py
"""Apply user dial overrides to base constants.

Takes base constants + dial_data, returns a new adjusted constants
dict with overrides applied.

Priority order (later steps use values set by earlier ones):
  1. Base constants (the defaults passed in)
  2. Individual component overrides  (promoter1_strength, cds2_degradation_rate, ...)
  3. Global type overrides           (binding_affinity, cooperativity, ...)
  4. Global multipliers              (global_transcription_rate, temperature_factor, ...)
"""
import copy


def apply_dial_adjustments(base_constants, dial_data):
    """Apply dial overrides and global multipliers to component constants.

    Args:
        base_constants: the COMPONENT_CONSTANTS dict. Not modified.
        dial_data: dict of dial parameter overrides from the frontend.

    Returns:
        A new dict with all overrides applied.
    """
    adjusted_constants = copy.deepcopy(base_constants)

    if not dial_data:
        return adjusted_constants

    print(f"[DEBUG] Processing dial parameters: {dial_data}")

    # Direct component parameter overrides (highest priority)
    component_overrides = {}

    # Global parameter groups (lower priority)
    global_overrides = {
        'promoter': {},
        'rbs': {},
        'cds': {},
        'repressor': {},
        'activator': {}
    }

    # Parse all dial parameters
    for param_name, value in dial_data.items():
        try:
            # Individual component parameters
            if '_' in param_name and any(param_name.startswith(comp_type) for comp_type in ['promoter', 'rbs', 'cds', 'terminator', 'protein', 'repressor', 'activator', 'inducer', 'inhibitor']):

                if param_name.startswith('promoter') and '_strength' in param_name:
                    comp_num = param_name.replace('promoter', '').replace('_strength', '')
                    comp_key = f"promoter_{comp_num}"
                    if comp_key not in component_overrides:
                        component_overrides[comp_key] = {}
                    component_overrides[comp_key]['strength'] = float(value)
                    print(f"  - Individual override: {comp_key}.strength = {value}")

                elif param_name.startswith('rbs') and '_efficiency' in param_name:
                    comp_num = param_name.replace('rbs', '').replace('_efficiency', '')
                    comp_key = f"rbs_{comp_num}"
                    if comp_key not in component_overrides:
                        component_overrides[comp_key] = {}
                    component_overrides[comp_key]['efficiency'] = float(value)
                    print(f"  - Individual override: {comp_key}.efficiency = {value}")

                elif param_name.startswith('cds') and '_translation_rate' in param_name:
                    comp_num = param_name.replace('cds', '').replace('_translation_rate', '')
                    comp_key = f"cds_{comp_num}"
                    if comp_key not in component_overrides:
                        component_overrides[comp_key] = {}
                    component_overrides[comp_key]['translation_rate'] = float(value)
                    print(f"  - Individual override: {comp_key}.translation_rate = {value}")

                elif param_name.startswith('cds') and '_degradation_rate' in param_name:
                    comp_num = param_name.replace('cds', '').replace('_degradation_rate', '')
                    comp_key = f"cds_{comp_num}"
                    if comp_key not in component_overrides:
                        component_overrides[comp_key] = {}
                    component_overrides[comp_key]['degradation_rate'] = float(value)
                    print(f"  - Individual override: {comp_key}.degradation_rate = {value}")

                elif param_name.startswith('protein') and '_initial_conc' in param_name:
                    comp_num = param_name.replace('protein', '').replace('_initial_conc', '')
                    comp_key = f"cds_{comp_num}"  # Protein initial conc goes to CDS
                    if comp_key not in component_overrides:
                        component_overrides[comp_key] = {}
                    component_overrides[comp_key]['init_conc'] = float(value)
                    print(f"  - Individual override: {comp_key}.init_conc = {value}")

                elif param_name.startswith('terminator') and '_efficiency' in param_name:
                    comp_num = param_name.replace('terminator', '').replace('_efficiency', '')
                    comp_key = f"terminator_{comp_num}"
                    if comp_key not in component_overrides:
                        component_overrides[comp_key] = {}
                    component_overrides[comp_key]['efficiency'] = float(value)
                    print(f"  - Individual override: {comp_key}.efficiency = {value}")

                # Regulator overrides — apply to both start and end keys
                elif param_name.startswith('repressor') and ('_Kr' in param_name or '_constant' in param_name):
                    comp_num = param_name.replace('repressor', '').replace('_Kr', '').replace('_constant', '')
                    for suffix in [f'repressor_start_{comp_num}', f'repressor_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['Kr'] = float(value)
                    print(f"  - Regulator override: repressor_{comp_num} Kr = {value}")

                elif param_name.startswith('repressor') and (param_name.endswith('_n') or '_cooperativity' in param_name):
                    comp_num = param_name.replace('repressor', '').replace('_n', '').replace('_cooperativity', '')
                    for suffix in [f'repressor_start_{comp_num}', f'repressor_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['n'] = int(float(value))
                    print(f"  - Regulator override: repressor_{comp_num} n = {value}")

                elif param_name.startswith('repressor') and '_concentration' in param_name:
                    comp_num = param_name.replace('repressor', '').replace('_concentration', '')
                    for suffix in [f'repressor_start_{comp_num}', f'repressor_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['concentration'] = float(value)
                    print(f"  - Regulator override: repressor_{comp_num} concentration = {value}")

                elif param_name.startswith('activator') and ('_Ka' in param_name or '_constant' in param_name):
                    comp_num = param_name.replace('activator', '').replace('_Ka', '').replace('_constant', '')
                    for suffix in [f'activator_start_{comp_num}', f'activator_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['Ka'] = float(value)
                    print(f"  - Regulator override: activator_{comp_num} Ka = {value}")

                elif param_name.startswith('activator') and (param_name.endswith('_n') or '_cooperativity' in param_name):
                    comp_num = param_name.replace('activator', '').replace('_n', '').replace('_cooperativity', '')
                    for suffix in [f'activator_start_{comp_num}', f'activator_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['n'] = int(float(value))
                    print(f"  - Regulator override: activator_{comp_num} n = {value}")

                elif param_name.startswith('activator') and '_concentration' in param_name:
                    comp_num = param_name.replace('activator', '').replace('_concentration', '')
                    for suffix in [f'activator_start_{comp_num}', f'activator_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['concentration'] = float(value)
                    print(f"  - Regulator override: activator_{comp_num} concentration = {value}")

                elif param_name.startswith('inducer') and ('_Ka' in param_name or '_constant' in param_name):
                    comp_num = param_name.replace('inducer', '').replace('_Ka', '').replace('_constant', '')
                    for suffix in [f'inducer_start_{comp_num}', f'inducer_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['Ka'] = float(value)
                    print(f"  - Regulator override: inducer_{comp_num} Ka = {value}")

                elif param_name.startswith('inducer') and (param_name.endswith('_n') or '_cooperativity' in param_name):
                    comp_num = param_name.replace('inducer', '').replace('_n', '').replace('_cooperativity', '')
                    for suffix in [f'inducer_start_{comp_num}', f'inducer_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['n'] = int(float(value))
                    print(f"  - Regulator override: inducer_{comp_num} n = {value}")

                elif param_name.startswith('inducer') and '_concentration' in param_name:
                    comp_num = param_name.replace('inducer', '').replace('_concentration', '')
                    for suffix in [f'inducer_start_{comp_num}', f'inducer_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['concentration'] = float(value)
                    print(f"  - Regulator override: inducer_{comp_num} concentration = {value}")

                elif param_name.startswith('inhibitor') and ('_Kr' in param_name or '_constant' in param_name):
                    comp_num = param_name.replace('inhibitor', '').replace('_Kr', '').replace('_constant', '')
                    for suffix in [f'inhibitor_start_{comp_num}', f'inhibitor_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['Kr'] = float(value)
                    print(f"  - Regulator override: inhibitor_{comp_num} Kr = {value}")

                elif param_name.startswith('inhibitor') and (param_name.endswith('_n') or '_cooperativity' in param_name):
                    comp_num = param_name.replace('inhibitor', '').replace('_n', '').replace('_cooperativity', '')
                    for suffix in [f'inhibitor_start_{comp_num}', f'inhibitor_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['n'] = int(float(value))
                    print(f"  - Regulator override: inhibitor_{comp_num} n = {value}")

                elif param_name.startswith('inhibitor') and '_concentration' in param_name:
                    comp_num = param_name.replace('inhibitor', '').replace('_concentration', '')
                    for suffix in [f'inhibitor_start_{comp_num}', f'inhibitor_end_{comp_num}']:
                        if suffix not in component_overrides:
                            component_overrides[suffix] = {}
                        component_overrides[suffix]['concentration'] = float(value)
                    print(f"  - Regulator override: inhibitor_{comp_num} concentration = {value}")

            # Global regulatory parameters
            elif param_name == 'binding_affinity':
                global_overrides['repressor']['Kr'] = 1.0 / max(0.01, float(value))
                print(f"  - Global regulatory: repressor Kr = {global_overrides['repressor']['Kr']}")
            elif param_name == 'cooperativity':
                global_overrides['repressor']['n'] = float(value)
                print(f"  - Global regulatory: repressor n = {value}")
            elif param_name == 'repressor_strength':
                global_overrides['repressor']['strength'] = float(value)
                print(f"  - Global regulatory: repressor strength = {value}")
            elif param_name == 'activator_strength':
                global_overrides['activator']['strength'] = float(value)
                print(f"  - Global regulatory: activator strength = {value}")

        except (ValueError, TypeError) as e:
            print(f"  - Error processing parameter {param_name}: {e}")
            continue

    # Apply individual component overrides first (highest priority)
    for comp_name, overrides in component_overrides.items():
        if comp_name not in adjusted_constants:
            # Create a new entry for regulator components that may not be in base constants
            comp_type_guess = comp_name.split('_')[0]
            base_template = next(
                (adjusted_constants[k] for k in adjusted_constants
                 if adjusted_constants[k].get('type') == comp_type_guess),
                {}
            )
            adjusted_constants[comp_name] = copy.deepcopy(base_template)
            print(f"Created new constants entry for {comp_name} from template")

        for param_name, override_value in overrides.items():
            original_val = adjusted_constants[comp_name].get(param_name, '<new>')
            adjusted_constants[comp_name][param_name] = override_value
            print(f"Applied individual override: {comp_name}.{param_name} = {original_val} → {override_value}")

    # Apply global regulatory overrides to all relevant components
    for comp_name in adjusted_constants:
        comp_type = adjusted_constants[comp_name].get('type', '')
        if comp_type in global_overrides and global_overrides[comp_type]:
            for param_name, override_value in global_overrides[comp_type].items():
                if param_name in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name][param_name]
                    adjusted_constants[comp_name][param_name] = override_value
                    print(f"Applied global override: {comp_name}.{param_name} = {original_val} → {override_value}")

    # Apply global multipliers AFTER overrides (so they affect the final values)
    print(f"\n[GLOBAL MULTIPLIERS] Checking for global parameters in dial_data...")
    print(f"[GLOBAL MULTIPLIERS] dial_data keys: {list(dial_data.keys())}")

    has_global_params = any(k in dial_data for k in ['global_transcription_rate', 'global_translation_rate', 'global_degradation_rate', 'temperature_factor', 'resource_availability'])

    if not has_global_params:
        print(f"[GLOBAL MULTIPLIERS] ✗ NO global parameters found - components will use base values only")
    else:
        print(f"[GLOBAL MULTIPLIERS] ✓ Global parameters found - applying multipliers...")

    for comp_name in adjusted_constants:
        comp_type = adjusted_constants[comp_name].get('type', '')

        # Global transcription multiplier → promoters
        if 'global_transcription_rate' in dial_data and comp_type == 'promoter':
            try:
                multiplier = float(dial_data['global_transcription_rate'])
                if 'strength' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['strength']
                    adjusted_constants[comp_name]['strength'] = original_val * multiplier
                    print(f"Applied global transcription multiplier: {comp_name}.strength = {original_val} * {multiplier} = {original_val * multiplier}")
            except (ValueError, TypeError):
                pass

        # Global translation multiplier → CDS and RBS
        if 'global_translation_rate' in dial_data:
            try:
                multiplier = float(dial_data['global_translation_rate'])
                if comp_type == 'cds' and 'translation_rate' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['translation_rate']
                    adjusted_constants[comp_name]['translation_rate'] = original_val * multiplier
                    print(f"Applied global translation multiplier to CDS: {comp_name}.translation_rate = {original_val} * {multiplier} = {original_val * multiplier}")
                if comp_type == 'rbs' and 'efficiency' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['efficiency']
                    adjusted_constants[comp_name]['efficiency'] = original_val * multiplier
                    print(f"Applied global translation multiplier to RBS: {comp_name}.efficiency = {original_val} * {multiplier} = {original_val * multiplier}")
            except (ValueError, TypeError):
                pass

        # Global degradation multiplier → CDS
        if 'global_degradation_rate' in dial_data and comp_type == 'cds':
            try:
                multiplier = float(dial_data['global_degradation_rate'])
                if 'degradation_rate' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['degradation_rate']
                    adjusted_constants[comp_name]['degradation_rate'] = original_val * multiplier
                    print(f"Applied global degradation multiplier: {comp_name}.degradation_rate = {original_val} * {multiplier} = {original_val * multiplier}")
            except (ValueError, TypeError):
                pass

        # Temperature factor → promoters + CDS
        if 'temperature_factor' in dial_data:
            try:
                temp_factor = float(dial_data['temperature_factor'])
                if comp_type == 'promoter' and 'strength' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['strength']
                    adjusted_constants[comp_name]['strength'] = original_val * temp_factor
                    print(f"Applied temperature factor to promoter: {comp_name}.strength = {original_val} * {temp_factor} = {original_val * temp_factor}")
                if comp_type == 'cds' and 'translation_rate' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['translation_rate']
                    adjusted_constants[comp_name]['translation_rate'] = original_val * temp_factor
                    print(f"Applied temperature factor to CDS: {comp_name}.translation_rate = {original_val} * {temp_factor} = {original_val * temp_factor}")
            except (ValueError, TypeError):
                pass

        # Resource availability → promoters + RBS
        if 'resource_availability' in dial_data:
            try:
                resource_factor = float(dial_data['resource_availability'])
                if comp_type == 'promoter' and 'strength' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['strength']
                    adjusted_constants[comp_name]['strength'] = original_val * resource_factor
                    print(f"Applied resource factor to promoter: {comp_name}.strength = {original_val} * {resource_factor} = {original_val * resource_factor}")
                if comp_type == 'rbs' and 'efficiency' in adjusted_constants[comp_name]:
                    original_val = adjusted_constants[comp_name]['efficiency']
                    adjusted_constants[comp_name]['efficiency'] = original_val * resource_factor
                    print(f"Applied resource factor to RBS: {comp_name}.efficiency = {original_val} * {resource_factor} = {original_val * resource_factor}")
            except (ValueError, TypeError):
                pass

    print(f"Applied dial overrides - Individual: {len(component_overrides)}, Global: {sum(len(v) for v in global_overrides.values())}")
    print("DEBUG: Received dial parameters:", list(dial_data.keys()))

    return adjusted_constants
# services/cellboard.py
"""Convert cellboard format to hardware-format lines.

Takes the frontend cellboard dict and produces the MUX/channel strings that 
circuit_model.py expects.
"""


def cellboard_to_hardware_lines(cellboard):
    """Convert cellboard dict to hardware-format lines for the parser.

    Args:
        cellboard: {'Promoter': [{'x': '0', 'y': '0', ...}], ...}

    Returns:
        (placed_components, final_lines)
        - placed_components: list of dicts, sorted by position
        - final_lines: list of "MUX A, Channel N: ['name'] ..." strings
    """
    placed_components = []

    # Track component counts for auto-numbering (promoter_1, promoter_2, etc.)
    component_counts = {}

    # Collect all placed components with their positions
    for component_type, components in cellboard.items():
        for comp in components:
            x = int(comp.get('x', 0))
            y = int(comp.get('y', 0))
            strength = comp.get('strength', 'norm')

            # Convert position to MUX/Channel format
            channel = y * 10 + x
            mux_letter = 'A'  # Start with MUX A for simplicity

            # Map component types to hardware naming convention
            type_map = {
                'Promoter': 'promoter',
                'RBS': 'rbs',
                'CDS': 'cds',
                'Terminator': 'terminator',
                'Repressor Start': 'repressor_start',
                'Repressor End': 'repressor_end',
                'Activator Start': 'activator_start',
                'Activator End': 'activator_end',
                'Inducer Start': 'inducer_start',
                'Inducer End': 'inducer_end',
                'Inhibitor Start': 'inhibitor_start',
                'Inhibitor End': 'inhibitor_end'
            }

            base_type = type_map.get(component_type, component_type.lower().replace(' ', '_'))

            if base_type not in component_counts:
                component_counts[base_type] = 0
            component_counts[base_type] += 1

            # For regulators: use arrow-based pair_id if the frontend provided one.
            # This makes the simulation pair whichever Start↔End the user connected
            # with an arrow, rather than whichever was dragged out first.
            _regulator_base_types = (
                'repressor_start', 'repressor_end',
                'activator_start', 'activator_end',
                'inducer_start', 'inducer_end',
                'inhibitor_start', 'inhibitor_end'
            )
            _pair_id = comp.get('pair_id') if base_type in _regulator_base_types else None
            effective_num = int(_pair_id) if _pair_id is not None else component_counts[base_type]

            comp_name = f"{base_type}_{effective_num}"

            # Capture gene/circuit name if provided
            gene_name = None
            if 'geneName' in comp and comp['geneName'] and comp['geneName'].strip():
                gene_name = comp['geneName'].strip()

            placed_components.append({
                'channel': channel,
                'mux': mux_letter,
                'name': comp_name,
                'type': component_type,
                'strength': strength,
                'position': channel,  # For sorting
                'comp_number': effective_num,  # Uses pair_id for regulators with arrows
                'modal_number': int(comp['number']) if comp.get('number') is not None else effective_num,
                'base_type': base_type,
                'customName': comp.get('customName', '').strip() if comp.get('customName') else None,
                'geneName': gene_name,
                'parameters': comp.get('parameters', {})
            })

    # Sort by position to create ordered circuit
    placed_components.sort(key=lambda x: x['position'])

    # Create hardware txt file format lines
    final_lines = []
    last_pos = -1

    for comp in placed_components:
        pos = comp['position']
        # Add circuit break if there's a significant gap
        if last_pos >= 0 and pos - last_pos > 2:
            final_lines.append("")  # Circuit break

        # Create MUX/Channel line in exact hardware format with strength info
        internal_type = comp.get('base_type', 'misc')
        mux_line = f"MUX {comp['mux']}, Channel {comp['channel']}:  ['{comp['name']}'] strength={comp['strength']} type={internal_type}"
        if comp.get('customName'):
            mux_line += f" customName={comp['customName']}"
        if comp.get('geneName'):
            mux_line += f" geneName={comp['geneName']}"
        final_lines.append(mux_line)
        last_pos = pos

    return placed_components, final_lines
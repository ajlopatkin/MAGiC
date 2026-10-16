# BACKEND: routes (imports Flask = responds to browser requests)/hardware.py
# Browser sends simulation request, flask recieves, runs routes, calls services 
# (for this file hardware related services), and sends back results

"""HTTP endpoints for hardware interaction.
Extracts request data, calls services, returns JSON.
"""
from flask import Blueprint, request, jsonify

# these are the services that this file calls - it parses the hardware log and 
# converts the hardware to the cellboard which is then sent back to the 
# browser to be populated
from services.hardware_parser import (
    parse_hardware_log,
    convert_hardware_to_cellboard,
)

bp = Blueprint('hardware', __name__)


@bp.route('/interpret_hardware', methods=['POST'])
def interpret_hardware():
    """Parse EEPROM log lines into cellboard format."""
    data = request.get_json() or {}
    log_lines = data.get('log_lines', [])
    
    if not log_lines:
        return jsonify({
            'status': 'error',
            'message': 'No log lines provided'
        }), 400
    
    # Call services (the actual work)
    channel_data = parse_hardware_log(log_lines)
    cellboard = convert_hardware_to_cellboard(channel_data)
    
    # Count actual components
    actual_count = sum(
        len(components) for key, components in channel_data.items()
        if key != '_scan_stats' and isinstance(components, list)
    )
    
    return jsonify({
        'status': 'success',
        'channel_data': channel_data,
        'cellboard': cellboard,
        'component_count': actual_count
    })
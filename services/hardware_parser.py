# BACKEND: services/hardware_parser.py
"""Parse EEPROM scan logs and convert MUX channels to cellboard format.
Takes raw log lines from the Arduino firmware, extracts component
names, and maps them to board coordinates the frontend can render.
"""
import re

# Map to board position
# MUX A: 0-15, MUX B: 16-31, MUX C: 32-47, MUX D: 48-63, 
# MUX E: 64-79, MUX F: 80-95, MUX G: 96-111
MUX_OFFSET = {
            'A': 0,
            'B': 16,
            'C': 32,
            'D': 48,
            'E': 64,
            'F': 80,
            'G': 96
        }   

def parse_hardware_log(log_lines):
    """Improved parsing that accumulates hex data per channel"""
    
    channel_hex = {}  # Accumulate hex data per channel
    current_channel = None
    fail_count = 0
    scan_count = 0
    
    # First pass: accumulate all hex data per channel
    for line in log_lines:
        line = line.strip()
        
        # Look for MUX selection commands
        cmd_match = re.search(r'>\s*sm\s+([a-g])\s+(\d+)', line, re.IGNORECASE)
        if cmd_match:
            mux_letter = cmd_match.group(1).upper()
            channel_num = int(cmd_match.group(2))
            current_channel = f"MUX_{mux_letter}_CH_{channel_num}"
            # Initialize hex accumulator for this channel
            if current_channel not in channel_hex:
                channel_hex[current_channel] = []
            continue
        
        # Count scan attempts and failures
        if current_channel and line == "fail":
            fail_count += 1
            scan_count += 1
            continue
            
        # Extract hex data from lines with address prefixes like "00:" and "40:"
        if current_channel:
            # Check if this line has hex data (address prefix + hex bytes)
            hex_line_match = re.match(r'^([0-9A-Fa-f]{2}):\s*(.+)', line)
            if hex_line_match:
                hex_part = hex_line_match.group(2)
                # Split on multiple spaces or dots to separate hex from ASCII representation
                hex_only = re.split(r'\s{3,}|\.{3,}', hex_part)[0].strip()
                
                # Find all two-digit hex tokens in the hex part only
                hex_tokens = re.findall(r'\b[0-9A-Fa-f]{2}\b', hex_only)
                if hex_tokens:
                    scan_count += 1
                    # Convert hex tokens to integers and accumulate
                    channel_hex[current_channel].extend([int(token, 16) for token in hex_tokens])
    
    # Second pass: process accumulated hex data per channel
    channel_data = {}
    
    for channel, hex_bytes in channel_hex.items():
        if not hex_bytes:
            continue
            
        # Convert accumulated hex bytes to ASCII
        ascii_chars = []
        component_found = False
        
        for byte_val in hex_bytes:
            if 32 <= byte_val <= 126:  # Printable ASCII
                ascii_chars.append(chr(byte_val))
                component_found = True
            elif byte_val == 0:  # Null terminator
                # If we found component data before this null, keep it
                if component_found:
                    ascii_chars.append(' ')  # Replace null with space
                else:
                    ascii_chars.append('')  # Skip leading nulls
            else:
                ascii_chars.append(' ')  # Non-printable to space
        
        ascii_str = ''.join(ascii_chars)
        print(f"Complete ASCII data for {channel}: '{ascii_str.strip()}'")
        
        # Clean and search for component patterns
        if ascii_str.strip():
            # Remove non-alphanumeric except underscore to create continuous string
            compact_str = re.sub(r'[^A-Za-z0-9_]', '', ascii_str).lower()
            
            if compact_str:
                components_found = []
                
                # Search for component patterns (case-insensitive)
                # IMPORTANT: Order matters - check longer patterns first to avoid partial matches
                patterns = [
                    (r'(repressor_[a-z]_start)', 'repressor_start'),
                    (r'(repressor_[a-z]_end)', 'repressor_end'),
                    (r'(activator_[a-z]_start)', 'activator_start'),
                    (r'(activator_[a-z]_end)', 'activator_end'),
                    (r'(inducer_[a-z]_start)', 'inducer_start'),
                    (r'(inducer_[a-z]_end)', 'inducer_end'),
                    (r'(inhibitor_[a-z]_start)', 'inhibitor_start'),
                    (r'(inhibitor_[a-z]_end)', 'inhibitor_end'),
                    (r'(promotor_[a-z])', 'promoter'),  # Normalize promotor to promoter
                    (r'(promoter_[a-z])', 'promoter'),
                    (r'(terminator_[a-z])', 'terminator'),
                    (r'(rbs_[a-z])', 'rbs'),
                    (r'(cds_[a-z])', 'cds')
                ]
                
                for pattern, comp_type in patterns:
                    matches = re.findall(pattern, compact_str)
                    for match in matches:
                        # Normalize promotor -> promoter for consistency
                        if match.startswith('promotor_'):
                            match = match.replace('promotor_', 'promoter_')
                        components_found.append(match)
                        print(f"Found {comp_type} on {channel}: {match}")
                
                # Remove duplicates while preserving order
                seen = set()
                unique_components = []
                for comp in components_found:
                    if comp not in seen:
                        seen.add(comp)
                        unique_components.append(comp)
                
                if unique_components:
                    channel_data[channel] = unique_components
    
    # Add scan statistics
    success_count = len(channel_data)
    channel_data['_scan_stats'] = {
        'total_scans': scan_count,
        'failed_reads': fail_count,
        'successful_channels': success_count
    }
    
    print(f"Board scan results: {success_count} channels with data, {fail_count} failed reads, {scan_count} total scans")
    
    return channel_data

def convert_hardware_to_cellboard(channel_data):
    """Convert hardware channel data to cellboard format"""
    
    cellboard = {}
    
    # Component type mapping
    type_mapping = {
        'promoter': 'Promoter',
        'promotor': 'Promoter', 
        'prom': 'Promoter',
        'omo': 'Promoter',  # Your specific promoter name
        'terminator': 'Terminator',
        'term': 'Terminator',
        'termi': 'Terminator',  # Your specific terminator name
        'rbs': 'RBS',
        'cds': 'CDS',
        'coding': 'CDS',
        'repressor_start': 'Repressor Start',
        'repressor_end': 'Repressor End', 
        'activator_start': 'Activator Start',
        'activator_end': 'Activator End',
        'inducer_start': 'Inducer Start',
        'inducer_end': 'Inducer End',
        'inhibitor_start': 'Inhibitor Start',
        'inhibitor_end': 'Inhibitor End',
        'inducer': 'Inducer',
        'rep_start': 'Repressor Start',
        'rep_end': 'Repressor End',
        'act_start': 'Activator Start',
        'act_end': 'Activator End',
        'ind_start': 'Inducer Start',
        'ind_end': 'Inducer End',
        'r': 'Repressor Start',  # Your specific repressor format
        'or': 'Operator'  # Your specific operator format
    }
    
    for channel_key, components in channel_data.items():
        # Parse channel position
        match = re.search(r'MUX_([A-G])_CH_(\d+)', channel_key)
        if not match:
            continue
            
        mux_letter = match.group(1)
        channel_num = int(match.group(2))                

        # Calculate linear position using offset
        linear_pos = MUX_OFFSET[mux_letter] + channel_num
        x = linear_pos % 10
        y = linear_pos // 10
        
        for comp_name in components:
            # Handle different component name patterns
            comp_lower = comp_name.lower()
            
            # Check for regulator Start/End patterns first (repressor_b_start, activator_c_end, etc.)
            if '_start' in comp_lower or '_end' in comp_lower:
                parts = comp_lower.split('_')
                if len(parts) >= 3:
                    # Pattern: repressor_b_start -> type=repressor, gene=b, position=start
                    base_type = parts[0]  # repressor, activator, inducer, inhibitor
                    gene_suffix = parts[1]  # a, b, c, etc.
                    position = parts[2]  # start or end
                    comp_type = f"{base_type}_{position}"  # repressor_start, activator_end, etc.
                else:
                    print(f"Warning: Invalid regulator format '{comp_name}'")
                    continue
            elif '_' in comp_name:
                # Pattern like "rbs_c", "cds_d", "terminator_b", "r_a"
                parts = comp_name.split('_')
                comp_type = parts[0].lower()
                gene_suffix = parts[1] if len(parts) > 1 else "1"
            else:
                # Pattern like "omo", "termi", "or"
                comp_type = comp_name.lower()
                gene_suffix = "1"
            
            # Map to friendly type
            friendly_type = type_mapping.get(comp_type)
            if not friendly_type:
                print(f"Warning: Unknown component type '{comp_type}' from name '{comp_name}'")
                continue
            
            # Convert suffix to gene number (a=1, b=2, c=3, etc.)
            if gene_suffix.isalpha() and len(gene_suffix) == 1:
                gene_num = str(ord(gene_suffix.lower()) - ord('a') + 1)
            elif gene_suffix.isdigit():
                gene_num = gene_suffix
            else:
                gene_num = "1"
            
            # Add to cellboard
            if friendly_type not in cellboard:
                cellboard[friendly_type] = []
                
            cellboard[friendly_type].append({
                'gene': f'Gene {gene_num}',
                'strength': 'norm',
                'x': str(x),
                'y': str(y)
            })
    
    return cellboard
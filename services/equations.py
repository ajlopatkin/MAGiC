# services/equations.py
"""Generate LaTeX equation representations for circuit proteins.

Takes builder + simulation result, returns a dict mapping protein names to 
LaTeX equation strings with descriptions.
"""

def generate_equation_display(builder, result):
    """Generate human-readable equation representations for each protein"""
    equations = {}
    
    if 'protein_mapping' not in result or not result['protein_mapping']:
        return equations
    
    # Get the protein mapping and regulations
    protein_mapping = result['protein_mapping']
    regulations = builder.regulations
    
    # Create reverse mapping: CDS name -> Protein display name
    cds_to_protein = {cds_name: protein_name for protein_name, cds_name in protein_mapping.items()}

    def _latex_short_name(display_name):
        parts = display_name.split(',', 1)
        return parts[0].strip()
    
    for protein_name, cds_name in protein_mapping.items():
        equation_parts = []
        
        # Find regulations affecting this protein's promoter
        # First find the promoter that controls this CDS
        controlling_promoter = None
        for circuit in builder.circuits:
            for i, comp in enumerate(circuit['components']):
                if comp['name'] == cds_name and comp['type'] == 'cds':
                    # Look backwards for the promoter
                    for j in range(i-1, -1, -1):
                        if circuit['components'][j]['type'] == 'promoter':
                            controlling_promoter = circuit['components'][j]['name']
                            break
                    break
            if controlling_promoter:
                break
        
        if not controlling_promoter:
            continue
            
        # Find regulations targeting this promoter  
        affecting_regs = [reg for reg in regulations if reg['target'] == controlling_promoter]
        
        # Check for constitutive regulation
        constitutive_regs = [reg for reg in regulations if reg.get('type') == 'constitutive' and reg.get('target') == controlling_promoter]
        
        latex_name = _latex_short_name(protein_name)
        if not affecting_regs or all(reg.get('type') == 'constitutive' for reg in affecting_regs):
            # Constitutive expression - use simplified protein name
            equations[protein_name] = {
                'latex': f"\\frac{{d[{latex_name}]}}{{dt}} = k_{{prod}} - \\gamma \\cdot [{latex_name}]",
                'description': "Constitutive protein production with degradation",
                'components': ["Production rate (k_prod)", "Degradation rate (γ)"]
            }
        else:
            # Build regulation-based equation
            reg_descriptions = []
            latex_terms = []
            
            for reg in affecting_regs:
                reg_type = reg['type']
                source = reg['source']
                params = reg.get('parameters', {})
                
                if 'repression' in reg_type:
                    # Get hill coefficient (n) from parameters
                    n = int(params.get('n', 2))  # Default to 2 if not specified
                    if 'self' in reg_type:
                        reg_descriptions.append(f"Self-repression by {latex_name} (n={n})")
                        latex_terms.append(f"\\frac{{1}}{{1 + \\left(\\frac{{[{latex_name}]}}{{K_r}}\\right)^{n}}}")
                    else:
                        # Convert source CDS name to protein display name
                        source_protein = cds_to_protein.get(source, source)
                        latex_source_name = _latex_short_name(source_protein)
                        reg_descriptions.append(f"Transcriptional repression by {latex_source_name} (n={n})")
                        latex_terms.append(f"\\frac{{1}}{{1 + \\left(\\frac{{[{latex_source_name}]}}{{K_r}}\\right)^{n}}}")
                        
                elif 'activation' in reg_type:
                    # Get hill coefficient (n) from parameters
                    n = int(params.get('n', 2))  # Default to 2 if not specified
                    if 'self' in reg_type:
                        reg_descriptions.append(f"Self-activation by {latex_name} (n={n})")
                        latex_terms.append(f"\\frac{{[{latex_name}]^{n}}}{{K_a^{n} + [{latex_name}]^{n}}}")
                    else:
                        # Convert source CDS name to protein display name
                        source_protein = cds_to_protein.get(source, source)
                        latex_source_name = _latex_short_name(source_protein)
                        reg_descriptions.append(f"Transcriptional activation by {latex_source_name} (n={n})")
                        latex_terms.append(f"\\frac{{[{latex_source_name}]^{n}}}{{K_a^{n} + [{latex_source_name}]^{n}}}")
            
            # Combine terms
            if latex_terms:
                if len(latex_terms) == 1:
                    regulation_term = latex_terms[0]
                else:
                    regulation_term = " \\cdot ".join(latex_terms)
                
                equations[protein_name] = {
                    'latex': f"\\frac{{d[{latex_name}]}}{{dt}} = k_{{prod}} \\cdot {regulation_term} - \\gamma \\cdot [{latex_name}]",
                    'description': "; ".join(reg_descriptions),
                    'components': reg_descriptions + ["Degradation rate (γ)"]
                }
            
    return equations
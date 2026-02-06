import re
import json
import base64
import numpy as np
from io import BytesIO
from typing import List, Dict, Any, Optional
from collections import defaultdict
import logging
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

class Component:
    """Light-weight representation for any parsed component line."""
    
    def __init__(self, raw_label: str, channel: int, mux_chr: str, constants: Dict[str, Any], strength: str = 'norm'):
        self.label = raw_label.strip()
        self.type = self._infer_type(self.label)
        self.channel = channel
        self.mux_chr = mux_chr
        self.global_idx = (ord(mux_chr) - ord('A')) * 16 + channel
        self.id = f"{self.type}_{mux_chr}{channel}"
        self.strength = strength  # Store strength parameter
        
        #adding grid position
        self.grid_x = channel % 10
        self.grid_y =  channel // 10

        # edge positions (designating "outside of cell")
        self.is_outside_cell = (self.grid_x == 0 or self.grid_x == 9 or self.grid_y == 0 or self.grid_y == 9)

        # Flat constants for this component/regulator
        self.constants = constants.get(self.label, {})
        
        # Regulator helpers
        self.is_regulator = self.type in ("activator", "repressor", "inducer", "inhibitor")
        if self.is_regulator:
            self.is_floating = self.label.startswith("floating_")
            # Extract position from label - handles multiple formats:
            # SOFTWARE: "repressor_start_2" (type_position_gene)
            # SOFTWARE: "repressor_start2" (type_position+gene)
            # HARDWARE: "repressor_b_start" (type_gene_position)
            parts = self.label.lower().split("_")
            if len(parts) >= 2:
                # Determine format by checking which part contains start/end
                position_part = None
                gene_part = ""
                
                # Check each part for start/end
                for i, part in enumerate(parts[1:], 1):
                    # Exact match for "start" or "end" (HARDWARE format: repressor_b_start)
                    if part == "start" or part == "end":
                        position_part = part
                        # Gene identifier is the part before position
                        if i > 1:
                            gene_part = parts[i-1]  # "b" in "repressor_b_start"
                        # Or parts after position
                        elif i < len(parts) - 1:
                            gene_part = parts[i+1]  # "2" in "repressor_start_2"
                        break
                    # Part starts with "start" or "end" (SOFTWARE format: repressor_start2)
                    elif part.startswith("start"):
                        position_part = "start"
                        gene_part = part[len("start"):]  # "2" in "start2"
                        break
                    elif part.startswith("end"):
                        position_part = "end"
                        gene_part = part[len("end"):]  # "2" in "end2"
                        break
                
                # Set position
                if position_part in ["start", "end"]:
                    self.position = position_part
                else:
                    self.position = None
                    
                # Create regulator key
                # For both formats, key is "regulator_type_gene"
                if self.position and gene_part:
                    self.reg_key = f"{parts[0]}_{gene_part}"
                elif self.position:
                    self.reg_key = f"{parts[0]}"
                else:
                    self.reg_key = None
            else:
                self.position = None
                self.reg_key = None
        else:
            self.is_floating = False
            self.position = None
            self.reg_key = None
        
        # Will be filled in by builder
        self.parameters: Dict[str, Any] = {}
        self.circuit_name: Optional[str] = None

    @staticmethod
    def _infer_type(label: str) -> str:
        lc = label.lower()
        if lc.startswith("promoter"):
            return "promoter"
        if lc.startswith("rbs"):
            return "rbs"
        if lc.startswith("cds"):
            return "cds"
        if lc.startswith("terminator"):
            return "terminator"
        
        # Check for regulator patterns: 
        # - activator_start_2, repressor_end_3 (type_position_gene)
        # - repressor_b_start, activator_a_end (type_gene_position)
        parts = lc.split("_")
        if len(parts) >= 2:
            reg_type = parts[0]
            
            # Check if this is a known regulator type
            if reg_type in ("activator", "repressor", "inducer", "inhibitor"):
                # Check if any part contains "start" or "end"
                for part in parts[1:]:
                    if part in ("start", "end") or part.startswith("start") or part.startswith("end"):
                        return reg_type
        return "misc"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.label,
            "type": self.type,
            "parameters": self.parameters
        }

class OntologyBuilderUnified:
    """Enhanced ontology builder from Version 15.3 with comprehensive circuit analysis"""
    
    def __init__(self, constants: Dict[str, Any]):
        # Flat constants: component_name → param dict
        self.constants = constants
        self.items: List[Optional[Component]] = []
        self.circuits: List[Dict[str, Any]] = []
        self.comp_to_circuit: Dict[str, str] = {}
        self.valid_comp_ids: set[str] = set()

        # Regulator registry
        self.regulators: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "starts": [], "ends": [], "type": None, "is_floating": False
        })
        self.regulations: List[Dict[str, Any]] = []
        self.regulator_issues: List[Dict[str, str]] = []
        self.unpaired_regulators: List[Dict[str, str]] = []

        # Extras & misplaced
        self.extra_components_found = {
            "within_valid_circuits": [],
            "outside_of_valid_circuits": [],
            "misplaced_components": []
        }

    def parse_text_file(self, lines: List[str]):
        """Parse component lines in hardware txt file format"""
        self.items = []
        
        def extract_component(raw: str):
            # Extract component name from ['component_name']
            m = re.search(r"\['([^']+)'\]", raw)
            return m.group(1) if m else None
        
        def extract_strength(raw: str):
            # Extract strength from strength=value
            m = re.search(r"strength=(\w+)", raw)
            return m.group(1) if m else 'norm'
        
        def extract_mux_channel(raw: str):
            # Extract MUX and Channel from "MUX A, Channel 0: ['component']"
            m = re.search(r"MUX\s+([A-Z]),\s+Channel\s+(\d+):", raw)
            if m:
                return m.group(1), int(m.group(2))
            return None, None

        in_circ = False
        has_cds = False

        for raw in lines:
            raw = raw.strip()
            if not raw:
                # Empty line → circuit break
                self.items.append(None)
                in_circ = False
                has_cds = False
                continue
                
            lbl = extract_component(raw)
            if lbl is None:
                # Blank or unrecognized → circuit break
                self.items.append(None)
                in_circ = False
                has_cds = False
                continue

            # Extract strength info
            strength = extract_strength(raw)

            # Extract MUX/Channel info for proper hardware indexing
            mux_letter, channel = extract_mux_channel(raw)
            if mux_letter and channel is not None:
                comp = Component(lbl, channel, mux_letter, self.constants, strength)
            else:
                # Fallback for simple format without MUX/Channel
                mux_counter = len([x for x in self.items if x is not None])
                comp = Component(lbl, mux_counter % 16, chr(65 + mux_counter // 16), self.constants, strength)

            # Break circuit on new promoter after seeing a CDS
            if in_circ and has_cds and comp.type == "promoter":
                self.items.append(None)
                in_circ = False
                has_cds = False

            self.items.append(comp)
            in_circ = True
            if comp.type == "cds":
                has_cds = True

            # Register regulator starts/ends
            if comp.is_regulator and comp.position:
                rec = self.regulators[comp.reg_key]
                rec["type"] = comp.type
                rec["is_floating"] = comp.is_floating
                rec[f"{comp.position}s"].append(comp)

    def build(self):
        """Build circuits and analyze regulatory networks"""
        block: List[Component] = []
        for itm in self.items + [None]:
            if itm is None:
                if block:
                    self._finalize_block(block)
                    block = []
                continue
            block.append(itm)

        self._detect_unpaired_regulators()
        self._build_regulations()
        self._add_constitutive_regulations()
        self._detect_extras_outside()

    def _finalize_block(self, comps: List[Component]):
        """Finalize a circuit block with enhanced parameter assignment"""
        # Fill comp.parameters from flat constants
        for comp in comps:
            params = self.constants.get(comp.label, {})
            print(f"[DEBUG] Assigning parameters to {comp.type} '{comp.label}': found {len(params)} parameters: {params}")
            
            if comp.type == "promoter":
                comp.parameters["strength"] = params.get("strength", 1.0)
                comp.parameters["binding_affinity"] = params.get("binding_affinity", 0.1)
                print(f"  - Promoter {comp.label}: strength = {comp.parameters['strength']}")
            elif comp.type == "rbs":
                comp.parameters["efficiency"] = params.get("efficiency", 1.0)
                comp.parameters["translation_rate"] = params.get("translation_rate", 5.0)
                print(f"  - RBS {comp.label}: efficiency = {comp.parameters['efficiency']}")
            elif comp.type == "terminator":
                comp.parameters["efficiency"] = params.get("efficiency", 0.99)
                print(f"  - Terminator {comp.label}: efficiency = {comp.parameters['efficiency']}")
            elif comp.type == "cds":
                comp.parameters["translation_rate"] = params.get("translation_rate", 5.0)
                comp.parameters["degradation_rate"] = params.get("degradation_rate", 0.1)
                comp.parameters["init_conc"] = params.get("init_conc", 0.01)
                comp.parameters["max_expression"] = params.get("max_expression", 100.0)
                print(f"  - CDS {comp.label}: translation_rate = {comp.parameters['translation_rate']}, degradation_rate = {comp.parameters['degradation_rate']}")

        # Skip if no CDS
        if not any(c.type == "cds" for c in comps):
            return

        # Assign circuit name
        name = f"circuit_{len(self.circuits) + 1}"
        for c in comps:
            c.circuit_name = name
            self.comp_to_circuit[c.id] = name
            self.valid_comp_ids.add(c.id)

        # Detect duplicates & misplacements
        extras = []
        misplaced = []
        type_counts = defaultdict(int)

        for comp in comps:
            t = comp.type
            type_counts[t] += 1

            # Enhanced misplacement detection
            if t == "promoter" and type_counts["cds"] > 0:
                misplaced.append({**comp.to_dict(), "reason": "Promoter after CDS"})
            elif t == "rbs" and type_counts["cds"] > 0 and type_counts["rbs"] == 1:
                misplaced.append({**comp.to_dict(), "reason": "First RBS after CDS"})
            elif t == "terminator" and type_counts["cds"] == 0:
                misplaced.append({**comp.to_dict(), "reason": "Terminator before CDS"})

        # After processing all components, detect extras
        cds_count = type_counts["cds"]
        rbs_count = type_counts["rbs"]
        
        # Add extra components based on final counts
        if type_counts["promoter"] > 1:
            # Mark all promoters beyond the first as extra
            promoter_comps = [c for c in comps if c.type == "promoter"]
            for i in range(1, len(promoter_comps)):
                extras.append({**promoter_comps[i].to_dict(), "reason": "Extra promoter"})
                
        if type_counts["terminator"] > 1:
            # Mark all terminators beyond the first as extra
            terminator_comps = [c for c in comps if c.type == "terminator"]
            for i in range(1, len(terminator_comps)):
                extras.append({**terminator_comps[i].to_dict(), "reason": "Extra terminator"})
                
        # Enhanced RBS sequence validation
        rbs_comps = [c for c in comps if c.type == "rbs"]
        cds_comps = [c for c in comps if c.type == "cds"]
        
        if rbs_count > 0 and cds_count > 0:
            # Validate RBS sequence patterns
            extra_rbs = self._validate_rbs_sequence_patterns(comps, rbs_comps, cds_comps)
            extras.extend(extra_rbs)
        elif rbs_count > cds_count:
            # Fallback: if more RBS than CDS, mark excess as extra
            excess_count = rbs_count - cds_count
            for i in range(rbs_count - excess_count, rbs_count):
                extras.append({**rbs_comps[i].to_dict(), "reason": f"Extra RBS (more RBS than CDS)"})

        # Store results
        self.extra_components_found["within_valid_circuits"].extend(extras)
        self.extra_components_found["misplaced_components"].extend(misplaced)

        # Detect incomplete circuits and generate fallback parameters
        fallback_by_cds = {}
        cds_components = [c for c in comps if c.type == "cds"]
        
        for cds_comp in cds_components:
            fallbacks = {}
            
            # Check for missing promoter
            if type_counts["promoter"] == 0:
                fallbacks["missing_promoter"] = True
                fallbacks["prom_strength"] = 0.01  # Low promoter strength fallback
                
            # Check for missing RBS
            if type_counts["rbs"] == 0:
                fallbacks["missing_rbs"] = True
                fallbacks["rbs_efficiency"] = 0.01  # Low fallback efficiency
                
            # Check for missing terminator
            if type_counts["terminator"] == 0:
                fallbacks["missing_terminator"] = True
                fallbacks["degradation_rate"] = 0.01  # Higher degradation without terminator
                
            if fallbacks:
                fallback_by_cds[cds_comp.label] = fallbacks

        # Create circuit dict
        circuit_dict = {
            "name": name,
            "components": [c.to_dict() for c in comps],
            "extras": extras,
            "misplaced": misplaced,
            "component_counts": dict(type_counts),
            "fallback_by_cds": fallback_by_cds
        }
        self.circuits.append(circuit_dict)

    def _validate_rbs_sequence_patterns(self, comps: List[Component], rbs_comps: List[Component], cds_comps: List[Component]) -> List[Dict[str, Any]]:
        """
        Validate RBS sequence patterns and detect improper sequencing.
        Valid patterns:
        1. Alternating: rbs-cds-rbs-cds-rbs-cds
        2. Grouped: rbs-cds-cds-cds (single RBS followed by multiple CDS)
        
        Invalid pattern:
        - Multiple RBS before multiple CDS: rbs-rbs-cds-cds
        """
        extras = []
        
        # Get sequence of RBS and CDS components in order
        rbs_cds_sequence = [comp for comp in comps if comp.type in ["rbs", "cds"]]
        
        if len(rbs_cds_sequence) < 2:
            return extras
            
        # Create type sequence string for pattern analysis
        types_sequence = [comp.type for comp in rbs_cds_sequence]
        types_string = "".join(t[0] for t in types_sequence)  # 'r' for rbs, 'c' for cds
        
        # Find runs of consecutive RBS followed by runs of consecutive CDS
        i = 0
        while i < len(types_sequence):
            if types_sequence[i] == "rbs":
                # Count consecutive RBS
                rbs_start = i
                while i < len(types_sequence) and types_sequence[i] == "rbs":
                    i += 1
                rbs_count = i - rbs_start
                
                # Check if followed by consecutive CDS
                if i < len(types_sequence) and types_sequence[i] == "cds":
                    cds_start = i
                    while i < len(types_sequence) and types_sequence[i] == "cds":
                        i += 1
                    cds_count = i - cds_start
                    
                    # Invalid pattern: multiple RBS before multiple CDS
                    if rbs_count > 1 and cds_count > 1:
                        # Mark all RBS except the first one as extra
                        for j in range(rbs_start + 1, rbs_start + rbs_count):
                            extra_rbs_comp = rbs_cds_sequence[j]
                            extras.append({
                                **extra_rbs_comp.to_dict(), 
                                "reason": "Invalid RBS sequence (multiple RBS before multiple CDS)"
                            })
                else:
                    # Single step if not followed by CDS
                    if i == rbs_start:  # Avoid infinite loop
                        i += 1
            else:
                i += 1
        
        return extras

    def _detect_unpaired_regulators(self):
        """Detect regulators without proper start/end pairs"""
        for reg_key, reg_data in self.regulators.items():
            starts = reg_data["starts"]
            ends = reg_data["ends"]
            reg_type = reg_data.get("type", "unknown")
            
            if len(starts) != len(ends):
                if len(starts) > len(ends):
                    issue = f"Missing {len(starts) - len(ends)} end element(s)"
                    hint = f"Add {reg_type.replace('_start', '_end')} element(s) to complete the regulation"
                else:
                    issue = f"Missing {len(ends) - len(starts)} start element(s)"  
                    hint = f"Add {reg_type.replace('_end', '_start')} element(s) to complete the regulation"
                    
                self.unpaired_regulators.append({
                    "label": reg_key,
                    "type": reg_type,
                    "starts": len(starts),
                    "ends": len(ends),
                    "issue": issue,
                    "hint": hint
                })

    def _nearest_prev_non_reg(self, comp: Component):
        """Find nearest previous non-regulator component"""
        for i in range(len(self.items) - 1, -1, -1):
            item = self.items[i]
            if (isinstance(item, Component) and 
                item.global_idx < comp.global_idx and 
                not item.is_regulator):
                return item
        return None

    def _downstream_cds(self, circuit_name: str, idx_threshold: int) -> List[str]:
        """Find CDS components downstream of given index in circuit"""
        names = []
        for circ in self.circuits:
            if circ["name"] != circuit_name:
                continue
            for comp_dict in circ["components"]:
                if comp_dict["type"] == "cds":
                    # Find the actual Component object
                    obj = next(
                        (item for item in self.items
                         if isinstance(item, Component)
                         and item.label == comp_dict["name"]),
                        None
                    )
                    if obj and obj.global_idx > idx_threshold:
                        names.append(obj.label)
            break
        return names

    def _build_regulations(self):
        """Build regulatory network using your original logic"""
        type_map = {
            "activator": "transcriptional_activation",
            "repressor": "transcriptional_repression", 
            "inducer": "induced_activation",
            "inhibitor": "environmental_repression"
        }
        self_map = {
            "activator": "self_activation",
            "repressor": "self_repression",
            "inducer": "self_activation", 
            "inhibitor": "self_repression"
        }

        for key, rec in self.regulators.items():
            starts, ends = rec["starts"], rec["ends"]

            any_outside = any(comp.is_outside_cell for comp in starts + ends) if (starts and ends) else False
            if rec["type"] in ("inducer", "inhibitor") and any_outside:
                rec["is_floating"] = True
                print(f"🌍 EXTERNAL {rec['type'].upper()} DETECTED: {key}")
                print(f"   Positions: starts={[(c.grid_x, c.grid_y) for c in starts]}, ends={[(c.grid_x, c.grid_y) for c in ends]}")
    

            if not starts or not ends:
                continue

            for end in ends:
                prom_prev = self._nearest_prev_non_reg(end)
                if not prom_prev or prom_prev.type != "promoter":
                    self.regulator_issues.append({
                        "label": end.label,
                        "issue": "Regulator end not immediately after promoter.",
                        "hint": "Place regulator end after the promoter you want to regulate!"
                    })
                    continue

                affected = self._downstream_cds(end.circuit_name, prom_prev.global_idx)

                for start in starts:
                    if rec["is_floating"] and start.circuit_name is not None:
                        self.regulator_issues.append({
                            "label": start.label,
                            "issue": "Floating start inside circuit.",
                            "hint": "Move floating regulator's start to be outside of all circuits!"
                        })

                    # Determine source CDS (or key) for non-floating
                    if not rec["is_floating"]:
                        src_prev = self._nearest_prev_non_reg(start)
                        if not src_prev or src_prev.type != "cds":
                            self.regulator_issues.append({
                                "label": start.label,
                                "issue": "Regulator start does not follow a CDS.",
                                "hint": "Place regulator start after the CDS you want to be the source!"
                            })
                            continue
                        source_name = src_prev.label
                    else:
                        # Floating: use regulator key as source (external/constant concentration)
                        source_name = key
                        print(f"   Source: {source_name} (external - constant concentration from constants)")

                    # Choose regulation kind based on circuit context
                    if rec["is_floating"]:
                    # Floating regulator (external/constant concentration)
                        kind = type_map.get(rec["type"], "transcriptional_regulation")
                        print(f"   Regulation kind: {kind} (floating/external)")
                    elif start.circuit_name != end.circuit_name:
                    # Cross-circuit regulation
                        kind = type_map.get(rec["type"], "transcriptional_regulation")
                        print(f"   Regulation kind: {kind} (cross-circuit)")
                    else:
                    # Same-circuit regulation (self-regulation)
                        kind = self_map.get(rec["type"])
                        print(f"   Regulation kind: {kind} (self-regulation)")


                    # Use consistent default parameters unless strength is specified
                    # Check if this is a "strong" or "weak" regulation based on component strength
                    component_strength = getattr(start, 'strength', 'norm')  # Default to normal
                    
                    # Define consistent default regulation parameters
                    if rec["type"] == "repressor":
                        if component_strength == "strong":
                            default_Kr = 0.15  # Strong repression (lower Kr = stronger)
                            default_n = 4
                        elif component_strength == "weak":
                            default_Kr = 0.5   # Weak repression (higher Kr = weaker)
                            default_n = 2
                        else:
                            # Use optimal Kr values for repressilator oscillation (classic range)
                            regulation_index = len(self.regulations)
                            kr_values = [0.35, 0.35, 0.35]  # Optimal repression strength for oscillation
                            default_Kr = kr_values[regulation_index % len(kr_values)]
                            default_n = 2
                    else:  # activator, inducer, inhibitor
                        if component_strength == "strong":
                            default_Ka = 0.2
                            default_n = 4
                        elif component_strength == "weak":
                            default_Ka = 0.6
                            default_n = 2
                        else:
                            default_Ka = 0.4   # Consistent normal activation
                            default_n = 2
                    
                    # Pull any custom constants from the constants file (optional override)
                    base = self.constants.get(start.reg_key, {})
                    real_params = {
                        "type": rec["type"],
                        "is_floating": rec["is_floating"],
                        "concentration": base.get("concentration", 1.0)
                    }
                    
                    # Use consistent defaults unless overridden by constants file
                    if rec["type"] == "repressor":
                        real_params["Kr"] = base.get("Kr", default_Kr)
                        real_params["n"] = base.get("n", default_n)
                    else:
                        real_params["Ka"] = base.get("Ka", default_Ka) 
                        real_params["n"] = base.get("n", default_n)

                    self.regulations.append({
                        "type": kind,
                        "source": source_name,
                        "target": prom_prev.label,
                        "parameters": real_params,
                        "affected_cdss": affected,
                        "is_outside_cell": any_outside if rec["type"] in ("inducer", "inhibitor") else False

                    })

                     # ADD THIS AT THE VERY END
                    print("\n" + "="*70)
                    print("🔍 ALL REGULATIONS CREATED")
                    print("="*70)
                    for i, reg in enumerate(self.regulations):
                        print(f"\nRegulation {i+1}:")
                        print(f"  Type: {reg['type']}")
                        print(f"  Source: {reg.get('source', 'N/A')}")
                        print(f"  Target: {reg.get('target', 'N/A')}")
                        print(f"  Affected CDSs: {reg.get('affected_cdss', [])}")
                        print(f"  Is Outside Cell: {reg.get('is_outside_cell', False)}")
        
                        params = reg.get('parameters', {})
                        if params.get('is_floating'):
                            print(f"  🌍 EXTERNAL/FLOATING REGULATOR")
                            print(f"     Concentration: {params.get('concentration', 'N/A')}")
                            if 'Ka' in params:
                                print(f"     Ka: {params.get('Ka')}, n: {params.get('n')}")
                            if 'Kr' in params:
                                print(f"     Kr: {params.get('Kr')}, n: {params.get('n')}")
                        else:
                            print(f"  🔗 PROTEIN-BASED REGULATOR")
                            if 'Ka' in params:
                                print(f"     Ka: {params.get('Ka')}, n: {params.get('n')}")
                            if 'Kr' in params:
                                print(f"     Kr: {params.get('Kr')}, n: {params.get('n')}")
                    print("="*70 + "\n")

    def _add_constitutive_regulations(self):
        """Add constitutive regulations for unregulated CDSs"""
        for circ in self.circuits:
            cds_names = [c["name"] for c in circ["components"] if c["type"] == "cds"]
            
            for name in cds_names:
                has_reg = any(
                    reg for reg in self.regulations
                    if name in reg.get("affected_cdss", [])
                )
                
                if not has_reg:
                    # Find nearest upstream promoter for this CDS
                    cds_idx = next(i for i, c in enumerate(circ["components"]) if c["name"] == name)
                    prom_name = None
                    
                    for i in range(cds_idx - 1, -1, -1):
                        if circ["components"][i]["type"] == "promoter":
                            prom_name = circ["components"][i]["name"]
                            break
                    
                    if prom_name:
                        self.regulations.append({
                            "type": "constitutive",
                            "source": None,
                            "target": prom_name,
                            "parameters": {
                                "type": "constitutive",
                                "basal_rate": 0.1
                            },
                            "affected_cdss": [name]
                        })


    def _detect_extras_outside(self):
        """Detect components outside valid circuits"""
        all_comp_ids = {item.id for item in self.items if item is not None}
        outside_ids = all_comp_ids - self.valid_comp_ids
        
        for item in self.items:
            if item is not None and item.id in outside_ids:
                self.extra_components_found["outside_of_valid_circuits"].append({
                    **item.to_dict(),
                    "reason": "Outside valid circuit"
                })

def simulate_circuit(builder: OntologyBuilderUnified) -> Dict[str, Any]:
    """Enhanced circuit simulation using your original equation building logic from Version 15.2"""
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
    from scipy.integrate import odeint
    from collections import defaultdict
    
    try:
        if not builder.circuits:
            return {
                'status': 'error',
                'message': 'No valid circuits found. Please ensure you have at least one complete circuit with a CDS component.',
                'circuits': [],
                'regulations': [],
                'errors': ['No valid circuits detected'],
                'warnings': []
            }

        # Use your exact logic from the notebook
        cell = {
            "circuits": builder.circuits,
            "regulations": builder.regulations
        }
        
        # Parameters matching your notebook
        basal_constitutive = 0.01  # k0 for constitutive (no regulators)
        initial_conc_default = 0.01  # backup initial [protein] for all CDS species
        
        # Gather CDS entries + display names using your logic
        cds_list = []
        display_names = []
        id2comp = {}
        id2circ = {}
        
        for circ in cell["circuits"]:
            # Skip circuits marked as non-modelable (if such marking exists)
            # Default to True if not specified
            if circ.get("modelable", True) is False:
                continue
                
            comps = circ["components"]
            
            # Determine base promoter strength using your logic
            first_cds_idx = next((i for i, c in enumerate(comps) if c["type"] == "cds"), None)
            if first_cds_idx is not None:
                prom_idxs = [i for i, c in enumerate(comps) if c["type"] == "promoter" and i < first_cds_idx]
                base_prom = comps[max(prom_idxs)]["parameters"].get("strength", 0.0) if prom_idxs else 0.01
            else:
                base_prom = 0.01
            circ["_base_prom"] = base_prom
            
            # Build cds_to_rbs mapping like in your notebook
            cds_to_rbs = {}
            for i, comp in enumerate(comps):
                if comp["type"] == "rbs":
                    # Find next CDS after this RBS
                    for j in range(i + 1, len(comps)):
                        if comps[j]["type"] == "cds":
                            cds_to_rbs[comps[j]["name"]] = comp["name"]
                            break
            circ["cds_to_rbs"] = cds_to_rbs
            
            # Count CDS components per gene to handle multiple CDS in same gene
            gene_cds_count = {}
            for comp in comps:
                if comp["type"] == "cds":
                    # Extract gene info from component ID (e.g., "cds_A3" -> gene from original placement)
                    comp_id = comp["id"]
                    # Find the gene number from the original component placement
                    gene_num = 1  # default
                    if hasattr(comp, 'gene_number'):
                        gene_num = comp.gene_number
                    elif 'gene' in comp.get('metadata', {}):
                        gene_num = comp['metadata']['gene']
                    
                    gene_cds_count[gene_num] = gene_cds_count.get(gene_num, 0) + 1
            
            # Track CDS sequence numbers within each gene
            gene_cds_counters = {}
            
            for comp in comps:
                if comp["type"] != "cds": 
                    continue
                cds_id = comp["id"]
                # Extract letter from name (cds_1 -> A, cds_2 -> B, etc.)
                name = comp["name"]
                if "cds" in name:
                    # Handle both formats: cds_2 and cds2
                    if "_" in name:
                        gene_part = name.split("_")[-1]  # Get last part after underscore
                    else:
                        gene_part = name.replace("cds", "")  # Remove cds prefix
                    
                    try:
                        # Convert gene letter/number to display letter
                        if gene_part.isdigit():
                            letter = chr(65 + int(gene_part) - 1)  # 1->A, 2->B, etc.
                            gene_num = int(gene_part)
                        elif gene_part.isalpha():
                            letter = gene_part.upper()  # a->A, b->B, etc.
                            gene_num = ord(gene_part.upper()) - ord('A') + 1
                        else:
                            letter = "A"
                            gene_num = 1
                    except (ValueError, IndexError):
                        letter = "A"
                        gene_num = 1
                else:
                    letter = "A"
                    gene_num = 1
                
                # Track sequence number for this gene
                if gene_num not in gene_cds_counters:
                    gene_cds_counters[gene_num] = 0
                gene_cds_counters[gene_num] += 1
                sequence_num = gene_cds_counters[gene_num]
                
                # Create unique display name for each CDS, even if redundant
                if gene_cds_count.get(gene_num, 1) > 1:
                    # Multiple CDS in same gene - differentiate by sequence
                    display_name = f"Protein {letter}.{sequence_num}, Gene Circuit {gene_num}"
                else:
                    # Single CDS in gene
                    display_name = f"Protein {letter}, Gene Circuit {gene_num}"
                
                cds_list.append(cds_id)
                display_names.append(display_name)
                id2comp[cds_id] = comp
                id2circ[cds_id] = circ

        if not cds_list:
            # Return empty plot if no CDS found
            plt.figure(figsize=(10, 6))
            plt.text(0.5, 0.5, 'No CDS components found', ha='center', va='center', transform=plt.gca().transAxes)
            plt.xlabel('Time (hours)')
            plt.ylabel('Protein Concentration (μM)')
            plt.title('Genetic Circuit Simulation - No Data')
            
            # Convert to base64
            import io, base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
            buffer.seek(0)
            plot_data = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return {
                'plot': plot_data,
                'time_series': {'time': [], 'Protein A': []},
                'circuits': builder.circuits,
                'regulations': builder.regulations,
                'errors': [],
                'warnings': []
            }
        
        # Build name→ID mapping for all components (your logic)
        name2id = {
            comp["name"]: comp["id"]
            for circ in cell["circuits"]
            for comp in circ["components"]
        }
        
        # Group regulations by CDS ID - apply to ALL CDS with matching name
        regs_by_cds = defaultdict(list)
        print(f"DEBUG: Processing {len(cell.get('regulations', []))} regulations")
        for reg in cell.get("regulations", []):
            print(f"DEBUG: Regulation {reg['source']} → {reg.get('affected_cdss', [])} (type: {reg['type']})")
            for tgt_name in reg.get("affected_cdss", []):
                # Apply regulation to ALL CDS components with this name
                for cds_id in cds_list:
                    comp = id2comp[cds_id]
                    if comp["name"] == tgt_name:
                        regs_by_cds[cds_id].append(reg)
                        print(f"DEBUG: Added regulation to {comp['name']} (cds_id: {cds_id})")
                
        # Build CDS name to ALL indices mapping for regulation lookup
        cds_name_to_indices = defaultdict(list)
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            cds_name_to_indices[comp["name"]].append(i)
        
        print(f"DEBUG: CDS mapping: {dict(cds_name_to_indices)}")
        print(f"DEBUG: CDS list: {[id2comp[cid]['name'] for cid in cds_list]}")
        print(f"DEBUG: Regulations by CDS: {[(cid, len(regs)) for cid, regs in regs_by_cds.items()]}")
        
        # Build per-CDS parameters using your exact logic
        cds_params = {}
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            circ = id2circ[cds_id]
            base_prom = circ["_base_prom"]
            
            # RBS efficiency (name-based lookup) using your logic
            rbs_name = circ["cds_to_rbs"].get(comp["name"])
            if rbs_name:
                rbs_comp = next((c for c in circ["components"] if c["name"] == rbs_name), None)
                base_rbs = rbs_comp["parameters"]["efficiency"] if rbs_comp else 0.01
            else:
                base_rbs = 0.01
            
            # Fallback & effective rates using your logic
            fb = circ.get("fallback_by_cds", {}).get(comp["name"], {})
            prom_s = fb.get("prom_strength", base_prom)
            rbs_e = fb.get("rbs_efficiency", base_rbs)
            degr = fb.get("degradation_rate", comp["parameters"]["degradation_rate"])
            
            # Numeric parameters matching working notebook - tuned for oscillations
            kprod = prom_s * rbs_e * 1.0  # Balanced production rate for oscillations
            k0 = basal_constitutive if not regs_by_cds.get(cds_id) else 0.01
            
            cds_params[cds_id] = {
                "k0": k0,
                "prom_strength": prom_s,
                "rbs_eff": rbs_e,
                "kprod": kprod,
                "degradation": degr,
                "initial_conc": comp["parameters"].get("init_conc", initial_conc_default)
            }
        
        # Define RHS using your exact logic with debugging
        debug_steps = []
        
        def rhs(p, t):
            dpdt = np.zeros(len(cds_list))
            for i, cds_id in enumerate(cds_list):
                pars = cds_params[cds_id]
                f_vals = []
                
                for reg in regs_by_cds.get(cds_id, []):
                    typ = reg["type"]
                    
                    if typ == "constitutive":
                        f_vals.append(1.0)  # always "on"
                        continue            # skip source lookup
                    
                    pr = reg["parameters"]
                    # Use higher Hill coefficient for sharper response (better for oscillations)
                    n = pr.get("n", 4 if typ in ("self_repression", "self_activation") else 2)
                    
                    # Resolve the value of the regulator
                    src_name = reg["source"]
                    
                    # For CDS regulation, find which protein index this is
                    # Use the first occurrence of this CDS name for regulation source
                    if src_name in cds_name_to_indices:
                        protein_index = cds_name_to_indices[src_name][0]
                        val = p[protein_index]  # Use protein concentration IN REAL TIME
                        
                        # Debug protein associations for repressilator
                        if t < 0.1:  # Only log at start of simulation
                            target_cds = id2comp[cds_id]["name"]
                            print(f"REPRESSOR DEBUG: {src_name} (index {protein_index}, conc={val:.3f}) → {target_cds}")
                            print(f"  Full mapping: {dict(cds_name_to_indices)}")
                            print(f"  CDS list order: {[id2comp[cid]['name'] for cid in cds_list]}")
                    elif typ in ("induced_activation", "environmental_repression"):
                        val = pr.get("concentration", 1.0)  # Use constant for floating
                    else:
                        raise ValueError(f"Cannot resolve source {src_name} for regulation type {typ}")
                    
                    # Apply correct regulation function with oscillation-friendly defaults
                    if typ in ("transcriptional_activation", "self_activation", "induced_activation"):
                        Ka = pr.get("Ka", 0.2)  # Lower Ka for stronger activation
                        hill_val = val**n / (Ka**n + val**n)
                        f_vals.append(hill_val)
                    elif typ in ("transcriptional_repression", "self_repression", "environmental_repression"):
                        # Use Kr from regulation parameters (no hardcoded defaults)
                        Kr = pr.get("Kr", 0.35)  # Use our tuned repressilator value as fallback
                        hill_val = Kr**n / (Kr**n + val**n)
                        f_vals.append(hill_val)
                        
                        # Debug key integration steps for oscillation verification
                        if len(debug_steps) < 10 and typ == "self_repression":
                            debug_steps.append({
                                't': t,
                                'protein_conc': val,
                                'Kr': Kr,
                                'n': n,
                                'hill_function': hill_val,
                                'production_factor': hill_val
                            })
                
                # Combine regulation effects and compute final rate
                f_prod = np.prod(f_vals) if f_vals else 1.0
                dpdt[i] = pars["k0"] + pars["kprod"] * f_prod - pars["degradation"] * p[i]
            
            return dpdt
        
        # Initial conditions and time vector - use user parameters or defaults
        p0 = np.array([cds_params[cds_id]["initial_conc"] for cds_id in cds_list])
        
        # For repressilator (3+ proteins with regulatory feedback), break symmetry if all concentrations are zero
        has_regulatory_feedback = any(
            reg["type"] not in ("constitutive",) 
            for reg in cell["regulations"]
        )
        
        if len(p0) >= 3 and np.allclose(p0, 0.0) and has_regulatory_feedback:
            # Apply asymmetry breaking ONLY for repressilator-type systems with regulatory feedback
            asymmetry_factors = [1.0, 0.1, 0.05]  # First protein starts higher
            for i in range(len(p0)):
                if i < len(asymmetry_factors):
                    p0[i] = asymmetry_factors[i]
                else:
                    p0[i] = 0.01  # Small non-zero value for additional proteins
        elif len(p0) >= 1 and np.allclose(p0, 0.0):
            # For constitutive circuits, use equal small starting concentrations for all proteins  
            for i in range(len(p0)):
                p0[i] = 0.01  # Equal starting concentration for constitutive circuits
        t = np.linspace(0, 24, 200)  # 0-24 hours as requested
        
        # Solve ODE
        sol = odeint(rhs, p0, t)
        
        # Create matplotlib plot with robust subplot handling
        fig, ax = plt.subplots(figsize=(10, 6))
        markers = ['o', 's', '^', 'D', 'v', '>', '<', '*']
        
        # Create circuit colors
        circuit_colors = {}
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f']
        for i, circ in enumerate(cell["circuits"]):
            circuit_colors[circ["name"]] = colors[i % len(colors)]
        
        print(f"DEBUG: About to plot {len(cds_list)} proteins: {cds_list}")
        
        # Plot each protein with circuit-specific colors
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            circ = id2circ[cds_id]
            color = circuit_colors[circ["name"]]
            display_name = display_names[i]
            
            # Add noise to separate overlapping curves - each protein gets unique noise pattern
            data_range = np.max(sol[:, i]) - np.min(sol[:, i])
            
            # For constitutive circuits: significant noise + small constant offset for guaranteed separation
            if not has_regulatory_feedback:
                # Much larger noise amplitude for better visual separation
                concentration_level = np.mean(sol[:, i])
                noise_amplitude = max(0.25 * concentration_level, 0.005)  # 25% noise or 0.005 μM minimum
                
                # Use unique random seed for each protein to create different noise patterns
                np.random.seed(42 + i * 17)  # Different seed spacing for more variation
                noise_pattern = np.random.normal(0, noise_amplitude, len(sol[:, i]))
                np.random.seed()  # Reset to random seed
                
                # Add small constant offset to guarantee visual separation
                small_offset = i * 0.008  # 0, 0.008, 0.016 μM offsets
                final_data = sol[:, i] + noise_pattern + small_offset
                
                print(f"DEBUG: Protein {i+1} - noise amplitude: {noise_amplitude:.4f}, offset: {small_offset:.3f}")
            else:
                # For repressilator systems, minimal noise
                noise_amplitude = 0.02 * data_range if data_range > 0 else 0
                if noise_amplitude > 0:
                    np.random.seed(42 + i * 13)
                    final_data = sol[:, i] + np.random.normal(0, noise_amplitude, len(sol[:, i]))
                    np.random.seed()
                else:
                    final_data = sol[:, i]
            
            # Plot with different colors only, no markers
            ax.plot(t, final_data, linewidth=2, label=display_name,
                    color=color, alpha=0.9)
            
            print(f"DEBUG: Plotted protein {i+1}/3: {display_name} with color {color}")
        
        # Debug: Check how many lines were actually plotted
        lines_count = len(ax.lines)
        print(f"DEBUG: Total lines plotted on axes: {lines_count} (should be {len(cds_list)})")
        
        ax.set_xlabel("Time (hours)")
        ax.set_ylabel("Concentration (μM)")
        ax.set_title("Genetic Circuit Simulation")
        ax.legend(shadow=True)
        ax.grid(True)
        
        # Convert plot to base64 for web display
        import io, base64
        img_buffer = io.BytesIO()
        fig.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        img_buffer.seek(0)
        plot_base64 = base64.b64encode(img_buffer.read()).decode()
        plt.close(fig)
        
        # Prepare time series data
        time_series = {'time': t.tolist()}
        for i, display_name in enumerate(display_names):
            time_series[display_name] = sol[:, i].tolist()
        
        # Calculate final states
        final_concentrations = {display_name: sol[:, i][-1] for i, display_name in enumerate(display_names)}
        
        # Return successful simulation results
        debug_info = {
            'cds_count': len(cds_list),
            'regulation_count': len(cell.get("regulations", [])),
            'simulation_successful': True
        }
        
        # Create protein mapping from CDS names to display names
        protein_mapping = {}
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            cds_name = comp['name']
            protein_mapping[display_names[i]] = cds_name
        
        result = {
            'status': 'success',
            'plot': plot_base64,
            'time_series': time_series,
            'final_concentrations': final_concentrations,
            'protein_mapping': protein_mapping,
            'circuits': builder.circuits,
            'regulations': builder.regulations,
            'regulator_issues': builder.regulator_issues,
            'unpaired_regulators': builder.unpaired_regulators,
            'extra_components': builder.extra_components_found,
            'debug_info': debug_info,
            'errors': [],
            'warnings': []
        }
        
        # Add warnings for issues
        if builder.regulator_issues:
            result['warnings'].extend([f"Regulator issue: {issue}" for issue in builder.regulator_issues])
        
        if builder.unpaired_regulators:
            result['warnings'].extend([f"Unpaired regulator: {reg}" for reg in builder.unpaired_regulators])
        
        return result
    
    except Exception as e:
        logging.error(f"Circuit simulation error: {str(e)}")
        return {
            'status': 'error',
            'message': f'Circuit analysis failed: {str(e)}',
            'circuits': [],
            'regulations': [],
            'errors': [str(e)],
            'warnings': []
        }

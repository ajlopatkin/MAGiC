"""Authoritative editable component parameter definitions for the MAGiC UI."""


def _parameter(key, label, minimum, maximum, step, default, title, integer=False):
    return {
        "key": key,
        "label": label,
        "min": minimum,
        "max": maximum,
        "step": step,
        "defaultValue": default,
        "title": title,
        "integer": integer,
    }


_KR = _parameter(
    "repressor{num}_Kr", "Repression Constant (Kr):", 0.01, 2.0, 0.01, 0.35,
    "Lower Kr = stronger repression",
)
_REPRESSOR_N = _parameter(
    "repressor{num}_n", "Cooperativity (n):", 1, 6, 1, 2,
    "Hill coefficient: higher values = sharper response", integer=True,
)
_ACTIVATOR_KA = _parameter(
    "activator{num}_Ka", "Activation Constant (Ka):", 0.01, 2.0, 0.01, 0.4,
    "Lower Ka = stronger activation",
)
_ACTIVATOR_N = _parameter(
    "activator{num}_n", "Cooperativity (n):", 1, 6, 1, 2,
    "Hill coefficient: higher values = sharper response", integer=True,
)
_INDUCER_KA = _parameter(
    "inducer{num}_Ka", "Inducer Strength:", 0.01, 2.0, 0.01, 0.5,
    "Binding constant (Ka): lower Ka = induced at lower concentrations",
)
_INDUCER_N = _parameter(
    "inducer{num}_n", "Cooperativity (n):", 1, 6, 1, 2,
    "Hill coefficient - higher values = sharper response", integer=True,
)
_INDUCER_CONCENTRATION = _parameter(
    "inducer{num}_concentration", "Initial Concentration:", 0, 5, 0.1, 1.0,
    "Concentration of external inducer",
)
_INHIBITOR_KR = _parameter(
    "inhibitor{num}_Kr", "Inhibitor Strength:", 0.01, 2.0, 0.01, 0.5,
    "Binding constant (Kr): lower Kr = inhibited at lower concentrations",
)
_INHIBITOR_N = _parameter(
    "inhibitor{num}_n", "Cooperativity (n):", 1, 6, 1, 2,
    "Hill coefficient - higher values = sharper response", integer=True,
)
_INHIBITOR_CONCENTRATION = _parameter(
    "inhibitor{num}_concentration", "External Concentration:", 0, 5, 0.1, 1.0,
    "Concentration of external inhibitor",
)

COMPONENT_PARAMETER_SCHEMA = {
    "Promoter": [
        _parameter(
            "promoter{num}_strength", "Promoter Strength:", 0.1, 5.0, 0.1, 5.0,
            "Transcription rate from this promoter (arbitrary units)",
        ),
    ],
    "RBS": [
        _parameter(
            "rbs{num}_efficiency", "RBS Efficiency:", 0.1, 2.0, 0.1, 1.0,
            "Translational efficiency — scales protein production rate",
        ),
    ],
    "CDS": [
        _parameter(
            "cds{num}_degradation_rate", "CDS Degradation Rate:", 0.01, 1.0,
            0.01, 1.0, "Rate at which this protein is broken down (per hour)",
        ),
        _parameter(
            "protein{num}_initial_conc", "Initial Protein Conc:", 0.0, 2.0,
            0.05, 0.0,
            "Starting concentration (µM) - affects oscillation dynamics",
        ),
    ],
    "Terminator": [
        _parameter(
            "terminator{num}_efficiency", "Terminator Efficiency:", 0.1, 1.0,
            0.01, 0.99,
            "Fraction of transcription terminated — 0.99 = nearly complete stop",
        ),
    ],
    "Repressor Start": [_KR, _REPRESSOR_N],
    "Repressor End": [
        dict(_KR),
        _parameter(
            "repressor{num}_n", "Cooperativity (n):", 1, 6, 1, 2,
            "Hill coefficient - higher values = sharper response", integer=True,
        ),
    ],
    "Activator Start": [_ACTIVATOR_KA, _ACTIVATOR_N],
    "Activator End": [dict(_ACTIVATOR_KA), dict(_ACTIVATOR_N)],
    "Inducer Start": [_INDUCER_KA, _INDUCER_N, _INDUCER_CONCENTRATION],
    "Inducer End": [
        dict(_INDUCER_KA),
        dict(_INDUCER_N),
        _parameter(
            "inducer{num}_concentration", "External Concentration:", 0, 5, 0.1,
            1.0, "Concentration of external inducer",
        ),
    ],
    "Inhibitor Start": [
        _INHIBITOR_KR, _INHIBITOR_N, _INHIBITOR_CONCENTRATION,
    ],
    "Inhibitor End": [
        dict(_INHIBITOR_KR),
        dict(_INHIBITOR_N),
        dict(_INHIBITOR_CONCENTRATION),
    ],
}
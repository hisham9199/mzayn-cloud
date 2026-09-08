from typing import Optional, List, Tuple


ATTRIBUTES = ["nose", "lips", "head", "neck", "hump", "eyelashes", "ear"]
ATTR_NAMES = {
    "nose": "الأنف",
    "lips": "الشفاه",
    "head": "الرأس",
    "neck": "الرقبة",
    "hump": "السنام",
    "eyelashes": "الرموش",
    "ear": "الأذن",
}


def validate_camel_data(
    points: Optional[int],
    spacing: Optional[int],
    nose: Optional[int],
    lips: Optional[int],
    head: Optional[int],
    neck: Optional[int],
    hump: Optional[int],
    eyelashes: Optional[int],
    ear: Optional[int],
) -> Tuple[bool, bool, Optional[int], Optional[int], List[str]]:
    """
    Returns: (points_valid, spacing_valid, expected_points, expected_spacing, error_fields)
    """
    attrs = [nose, lips, head, neck, hump, eyelashes, ear]
    error_fields = []

    # Check if all attributes are provided and strictly positive (> 0)
    invalid_attrs = [name for name, val in zip(ATTRIBUTES, attrs) if val is None or val <= 0]
    if invalid_attrs:
        error_fields.extend(invalid_attrs)
        if points is None:
            error_fields.append("points")
        if spacing is None:
            error_fields.append("spacing")
        return False, False, None, None, error_fields

    expected_points = sum(attrs)
    expected_spacing = max(attrs) - min(attrs)

    points_valid = (points == expected_points) if points is not None else False
    spacing_valid = (spacing == expected_spacing) if spacing is not None else False

    if not points_valid:
        error_fields.append("points")
    if not spacing_valid:
        error_fields.append("spacing")

    return points_valid, spacing_valid, expected_points, expected_spacing, error_fields


def compute_harmony(attrs: List[int]) -> float:
    """Compute harmony score based on coefficient of variation (lower = better)."""
    if not attrs or len(attrs) == 0:
        return 0.0
    mean = sum(attrs) / len(attrs)
    if mean == 0:
        return 100.0
    variance = sum((x - mean) ** 2 for x in attrs) / len(attrs)
    cv = (variance ** 0.5) / mean * 100
    # Convert to 0-100 harmony score (100 = perfect harmony)
    harmony = max(0, 100 - cv * 10)
    return round(harmony, 2)


def get_confidence_status(confidence: float, data_valid: bool) -> str:
    """Return green/yellow/red based on confidence and validity."""
    if data_valid and confidence >= 0.85:
        return "green"
    elif confidence >= 0.65:
        return "yellow"
    else:
        return "red"

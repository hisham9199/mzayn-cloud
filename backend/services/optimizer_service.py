from typing import List, Optional, Dict, Any
from ortools.sat.python import cp_model
import time


ATTRIBUTES = ["nose", "lips", "head", "neck", "hump", "eyelashes", "ear"]
ATTR_NAMES_AR = {
    "nose": "الأنف",
    "lips": "الشفاه",
    "head": "الرأس",
    "neck": "الرقبة",
    "hump": "السنام",
    "eyelashes": "الرموش",
    "ear": "الأذن",
}


def optimize_championship(
    camels: List[Dict[str, Any]],
    min_camels: int,
    max_camels: int,
    required_spacing: Optional[int] = None,
    max_points_per_camel: Optional[int] = None,
    mandatory_ids: Optional[List[int]] = None,
    excluded_ids: Optional[List[int]] = None,
    allow_males: bool = True,
    current_camel_ids: Optional[List[int]] = None,
    time_limit_seconds: int = 60,
    optimization_goal: str = "balanced",
) -> Dict[str, Any]:
    """
    Run CP-SAT optimization to find the best championship lineup.
    Tests all sizes from min_camels to max_camels and returns the best.
    """
    mandatory_ids = set(mandatory_ids or [])
    excluded_ids = set(excluded_ids or [])

    # Filter eligible camels
    eligible = []
    for c in camels:
        if not c.get("is_valid"):
            continue
        if c["status"] not in ("available",):
            continue
        if c["id"] in excluded_ids:
            continue
        if not allow_males and c.get("gender") == "ذكر":
            continue
        if max_points_per_camel and (c.get("points") or 0) > max_points_per_camel:
            continue
        # Must have all 7 attributes
        attrs = [c.get(a, 0) or 0 for a in ATTRIBUTES]
        if all(v > 0 for v in attrs):
            eligible.append(c)

    if len(eligible) < min_camels:
        return {
            "solve_status": "INFEASIBLE",
            "message": f"عدد النياق المؤهلة ({len(eligible)}) أقل من الحد الأدنى ({min_camels})",
            "num_camels": 0,
            "total_points": 0,
            "selected_camel_ids": [],
        }

    best_result = None
    best_score = -float("inf")

    start_total = time.time()

    # Test each size from min to max
    for target_n in range(min_camels, max_camels + 1):
        if len(eligible) < target_n:
            break

        result = _solve_for_n(
            eligible, target_n, required_spacing,
            mandatory_ids, excluded_ids, time_limit_seconds, optimization_goal
        )

        elapsed = time.time() - start_total
        if elapsed > time_limit_seconds * 0.9:
            break  # Running out of time

        if result["solve_status"] in ("OPTIMAL", "FEASIBLE"):
            pts = result["total_points"]
            spc = result["final_spacing"]
            if optimization_goal == "min_spacing":
                score = -100000 * spc + pts
            elif optimization_goal == "max_points":
                score = 1000 * pts - spc
            else:  # balanced
                score = 100 * pts - 50 * spc

            if score > best_score:
                best_score = score
                best_result = result

    if best_result is None:
        return {
            "solve_status": "INFEASIBLE",
            "message": "لم يُعثر على تشكيلة مناسبة. جرب تخفيف شروط التباعد أو زيادة عدد النياق.",
            "num_camels": 0,
            "total_points": 0,
            "selected_camel_ids": [],
        }

    solve_time = int((time.time() - start_total) * 1000)
    best_result["solve_time_ms"] = solve_time
    best_result["optimization_goal"] = optimization_goal
    best_result["required_spacing"] = required_spacing

    # Compute comparison with current lineup
    if current_camel_ids:
        current_points = sum(
            c["points"] for c in camels if c["id"] in current_camel_ids and c.get("points")
        )
        best_result["current_total_points"] = current_points
        best_result["improvement"] = best_result["total_points"] - current_points
        best_result["camels_to_remove"] = [
            cid for cid in current_camel_ids if cid not in best_result["selected_camel_ids"]
        ]
        best_result["camels_to_add"] = [
            cid for cid in best_result["selected_camel_ids"] if cid not in current_camel_ids
        ]

    return best_result


def _solve_for_n(
    eligible: List[Dict],
    target_n: int,
    required_spacing: Optional[int],
    mandatory_ids: set,
    excluded_ids: set,
    time_limit: int,
    optimization_goal: str = "balanced",
) -> Dict[str, Any]:
    """Solve CP-SAT for exactly target_n camels."""
    model = cp_model.CpModel()
    n = len(eligible)

    # Decision variables
    x = [model.NewBoolVar(f"x_{i}") for i in range(n)]

    # Constraint: exactly target_n camels
    model.Add(sum(x) == target_n)

    # Mandatory camels
    for i, c in enumerate(eligible):
        if c["id"] in mandatory_ids:
            model.Add(x[i] == 1)

    # Total points variable
    points = [c.get("points", 0) or 0 for c in eligible]
    total_pts = model.NewIntVar(0, sum(points), "total_pts")
    model.Add(total_pts == sum(x[i] * points[i] for i in range(n)))

    # Attribute sums and Spacing variables
    attr_sums = []
    for attr in ATTRIBUTES:
        vals = [c.get(attr, 0) or 0 for c in eligible]
        attr_sum = model.NewIntVar(0, sum(vals), f"sum_{attr}")
        model.Add(attr_sum == sum(x[i] * vals[i] for i in range(n)))
        attr_sums.append(attr_sum)

    max_val = model.NewIntVar(0, 100000, "max_val")
    min_val = model.NewIntVar(0, 100000, "min_val")
    for s in attr_sums:
        model.Add(max_val >= s)
        model.Add(min_val <= s)

    spacing_var = model.NewIntVar(0, 10000, "spacing_var")
    model.Add(spacing_var == max_val - min_val)

    # Spacing constraint if requested
    if required_spacing is not None and required_spacing >= 0:
        model.Add(spacing_var <= required_spacing)

    # Objective function based on optimization goal
    if optimization_goal == "max_points":
        model.Maximize(1000 * total_pts - spacing_var)
    elif optimization_goal == "min_spacing":
        model.Minimize(100000 * spacing_var - total_pts)
    else:  # balanced
        model.Maximize(100 * total_pts - 50 * spacing_var)

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = min(time_limit / (1), 30)  # per size

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"solve_status": "INFEASIBLE", "total_points": 0, "selected_camel_ids": []}

    selected_ids = [eligible[i]["id"] for i in range(n) if solver.Value(x[i]) == 1]
    selected_camels = [c for c in eligible if c["id"] in selected_ids]

    # Compute attribute sums
    attr_sums_result = {}
    all_attrs = []
    for attr in ATTRIBUTES:
        s = sum(c.get(attr, 0) or 0 for c in selected_camels)
        attr_sums_result[attr] = s
        all_attrs.append(s)

    final_spacing = max(all_attrs) - min(all_attrs) if all_attrs else 0
    calculated_total_points = sum(c.get("points", 0) or 0 for c in selected_camels)

    return {
        "solve_status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
        "num_camels": target_n,
        "total_points": calculated_total_points,
        "final_spacing": final_spacing,
        "attr_sums": attr_sums_result,
        "selected_camel_ids": selected_ids,
    }


def test_camel_benefit(
    new_camel: Dict[str, Any],
    all_camels: List[Dict[str, Any]],
    min_camels: int,
    max_camels: int,
    required_spacing: Optional[int],
    max_points_per_camel: Optional[int],
    allow_males: bool,
    time_limit: int = 30,
) -> Dict[str, Any]:
    """Test whether adding a new camel improves the best lineup."""
    # Current best without the new camel
    current_best = optimize_championship(
        all_camels, min_camels, max_camels,
        required_spacing, max_points_per_camel,
        allow_males=allow_males,
        time_limit_seconds=time_limit
    )
    current_points = current_best.get("total_points", 0)

    # Best with the new camel included
    camels_with_new = all_camels + [new_camel]
    new_best = optimize_championship(
        camels_with_new, min_camels, max_camels,
        required_spacing, max_points_per_camel,
        mandatory_ids=[new_camel["id"]],
        allow_males=allow_males,
        time_limit_seconds=time_limit
    )
    new_points = new_best.get("total_points", 0)
    improvement = new_points - current_points

    return {
        "current_best_points": current_points,
        "new_best_points": new_points,
        "improvement": improvement,
        "benefits_stable": improvement > 0,
        "camels_removed": new_best.get("camels_to_remove", []),
        "message": (
            f"الناقة تُحسّن التشكيلة بمقدار +{improvement} نقطة"
            if improvement > 0
            else "الناقة لا تُحسّن أفضل تشكيلة حالياً"
        )
    }


def analyze_stable_needs(
    selected_camels: List[Dict[str, Any]],
    all_camels: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Analyze what the stable needs for future camels."""
    if not selected_camels:
        return {}

    # Find weakest camels (lowest total points)
    sorted_camels = sorted(selected_camels, key=lambda c: c.get("points", 0))
    weakest = sorted_camels[:5]

    # Find weakest attributes (lowest average)
    attr_avgs = {}
    for attr in ATTRIBUTES:
        vals = [c.get(attr, 0) or 0 for c in selected_camels if c.get(attr)]
        attr_avgs[attr] = round(sum(vals) / len(vals), 1) if vals else 0

    weakest_attrs = sorted(attr_avgs.items(), key=lambda x: x[1])[:3]

    # Recommended specs for next camel
    top_5_pct = sorted(selected_camels, key=lambda c: c.get("points", 0), reverse=True)[:max(1, len(selected_camels)//5)]
    recommended = {}
    for attr in ATTRIBUTES:
        vals = [c.get(attr, 0) or 0 for c in top_5_pct if c.get(attr)]
        if vals:
            recommended[attr] = {
                "min": min(vals),
                "max": max(vals),
                "avg": round(sum(vals) / len(vals), 1)
            }

    all_points = [c.get("points", 0) or 0 for c in top_5_pct if c.get("points")]
    all_spacing = [c.get("spacing", 0) or 0 for c in top_5_pct if c.get("spacing") is not None]

    return {
        "weakest_camels": [{"id": c["id"], "number": c.get("number"), "points": c.get("points")} for c in weakest],
        "weakest_attributes": [{"attr": a, "attr_ar": ATTR_NAMES_AR.get(a, a), "avg": v} for a, v in weakest_attrs],
        "recommended_specs": {
            "points": {"min": min(all_points) if all_points else 0, "max": max(all_points) if all_points else 0},
            "spacing": {"min": min(all_spacing) if all_spacing else 0, "max": max(all_spacing) if all_spacing else 0},
            **recommended
        }
    }

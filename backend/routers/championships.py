from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.championship import Championship, ChampionshipResult
from models.camel import Camel
from models.stable import Stable
from schemas import ChampionshipCreate, ChampionshipOut, OptimizeRequest, OptimizeResult
from services.optimizer_service import optimize_championship

router = APIRouter(prefix="/championships", tags=["championships"])


def _camel_to_dict_for_optimizer(c):
    return {
        "id": c.id, "number": c.number, "name": c.name,
        "gender": c.gender, "status": c.status, "is_valid": c.is_valid,
        "points": c.points, "spacing": c.spacing,
        "nose": c.nose, "lips": c.lips, "head": c.head,
        "neck": c.neck, "hump": c.hump, "eyelashes": c.eyelashes, "ear": c.ear,
        "stable_id": c.stable_id,
    }


@router.get("/", response_model=List[dict])
def list_championships(db: Session = Depends(get_db)):
    champs = db.query(Championship).order_by(Championship.created_at.desc()).all()
    result = []
    for c in champs:
        d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
        stable = db.query(Stable).filter(Stable.id == c.stable_id).first()
        d["stable_name"] = stable.name if stable else None
        result.append(d)
    return result


@router.post("/", response_model=dict)
def create_championship(data: ChampionshipCreate, db: Session = Depends(get_db)):
    champ = Championship(**data.model_dump())
    db.add(champ)
    db.commit()
    db.refresh(champ)
    return {col.name: getattr(champ, col.name) for col in champ.__table__.columns}


@router.put("/{champ_id}", response_model=dict)
def update_championship(champ_id: int, data: ChampionshipCreate, db: Session = Depends(get_db)):
    champ = db.query(Championship).filter(Championship.id == champ_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="البطولة غير موجودة")
    for k, v in data.model_dump().items():
        setattr(champ, k, v)
    db.commit()
    db.refresh(champ)
    return {col.name: getattr(champ, col.name) for col in champ.__table__.columns}


@router.delete("/{champ_id}")
def delete_championship(champ_id: int, db: Session = Depends(get_db)):
    champ = db.query(Championship).filter(Championship.id == champ_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="البطولة غير موجودة")
    # حذف النتائج المرتبطة أولاً
    db.query(ChampionshipResult).filter(ChampionshipResult.championship_id == champ_id).delete()
    db.delete(champ)
    db.commit()
    return {"message": "تم حذف البطولة"}


@router.post("/{champ_id}/optimize")
def run_optimization(champ_id: int, req: OptimizeRequest, db: Session = Depends(get_db)):
    champ = db.query(Championship).filter(Championship.id == champ_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="البطولة غير موجودة")

    # Get eligible camels
    q = db.query(Camel).filter(Camel.status == "available", Camel.is_valid == True)
    if champ.stable_id and not champ.allow_other_stables:
        q = q.filter(Camel.stable_id == champ.stable_id)
    elif champ.stable_id:
        # allow other stables too - no filter
        pass

    camels = q.all()
    camels_list = [_camel_to_dict_for_optimizer(c) for c in camels]

    effective_spacing = req.required_spacing if req.required_spacing is not None else champ.required_spacing

    result = optimize_championship(
        camels_list,
        min_camels=champ.min_camels,
        max_camels=champ.max_camels,
        required_spacing=effective_spacing,
        max_points_per_camel=champ.max_points_per_camel,
        mandatory_ids=champ.mandatory_camel_ids or [],
        excluded_ids=champ.excluded_camel_ids or [],
        allow_males=champ.allow_males,
        current_camel_ids=req.current_camel_ids,
        time_limit_seconds=req.time_limit_seconds,
        optimization_goal=req.optimization_goal or "balanced",
    )

    # If INFEASIBLE due to strict spacing constraint, retry without it and add advisory
    if result.get("solve_status") == "INFEASIBLE" and effective_spacing is not None:
        fallback = optimize_championship(
            camels_list,
            min_camels=champ.min_camels,
            max_camels=champ.max_camels,
            required_spacing=None,
            max_points_per_camel=champ.max_points_per_camel,
            mandatory_ids=champ.mandatory_camel_ids or [],
            excluded_ids=champ.excluded_camel_ids or [],
            allow_males=champ.allow_males,
            current_camel_ids=req.current_camel_ids,
            time_limit_seconds=req.time_limit_seconds,
            optimization_goal=req.optimization_goal or "balanced",
        )
        if fallback.get("solve_status") in ("OPTIMAL", "FEASIBLE"):
            fallback["spacing_constraint_relaxed"] = True
            fallback["original_required_spacing"] = effective_spacing
            fallback["message"] = (
                f"⚠️ لم يمكن تحقيق التباعد المطلوب ({effective_spacing}) — تم عرض أفضل تشكيلة متاحة بتباعد {fallback.get('final_spacing')}. "
                f"يمكنك تعديل شرط التباعد في إعدادات البطولة."
            )
            result = fallback

    # Save result to DB
    if result.get("solve_status") in ("OPTIMAL", "FEASIBLE"):
        db_result = ChampionshipResult(
            championship_id=champ_id,
            selected_camel_ids=result.get("selected_camel_ids", []),
            total_points=result.get("total_points"),
            num_camels=result.get("num_camels"),
            final_spacing=result.get("final_spacing"),
            attr_sums=result.get("attr_sums"),
            solve_status=result.get("solve_status"),
            solve_time_ms=result.get("solve_time_ms"),
        )
        db.add(db_result)
        db.commit()

    # Enrich result with camel details
    selected_ids = set(result.get("selected_camel_ids", []))
    if selected_ids:
        selected_camels = db.query(Camel).filter(Camel.id.in_(selected_ids)).all()
        result["selected_camels"] = [
            {col.name: getattr(c, col.name) for col in c.__table__.columns}
            for c in selected_camels
        ]

    return result


@router.get("/{champ_id}/results")
def get_championship_results(champ_id: int, db: Session = Depends(get_db)):
    results = db.query(ChampionshipResult).filter(
        ChampionshipResult.championship_id == champ_id
    ).order_by(ChampionshipResult.created_at.desc()).limit(10).all()

    all_camel_ids = set()
    for r in results:
        if r.selected_camel_ids:
            all_camel_ids.update(r.selected_camel_ids)

    camels_by_id = {}
    if all_camel_ids:
        camels = db.query(Camel).filter(Camel.id.in_(all_camel_ids)).all()
        camels_by_id = {c.id: {col.name: getattr(c, col.name) for col in c.__table__.columns} for c in camels}

    return [{
        "id": r.id,
        "num_camels": r.num_camels,
        "total_points": r.total_points,
        "final_spacing": r.final_spacing,
        "attr_sums": r.attr_sums,
        "solve_status": r.solve_status,
        "solve_time_ms": r.solve_time_ms,
        "selected_camel_ids": r.selected_camel_ids,
        "selected_camels": [camels_by_id[cid] for cid in (r.selected_camel_ids or []) if cid in camels_by_id],
        "created_at": r.created_at,
    } for r in results]

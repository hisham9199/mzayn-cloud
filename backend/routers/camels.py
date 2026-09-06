from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os, json
from datetime import datetime
from database import get_db
from models.camel import Camel
from models.stable import Stable
from models.audit_log import AuditLog
from schemas import CamelCreate, CamelUpdate, CamelOut, ValidationResult, TestCamelResult
from utils.validators import validate_camel_data, compute_harmony, ATTRIBUTES
from services.optimizer_service import test_camel_benefit, analyze_stable_needs
from services.storage_service import upload_image, delete_image

router = APIRouter(prefix="/camels", tags=["camels"])


def _validate_and_enrich(camel: Camel) -> Camel:
    attrs = [camel.nose, camel.lips, camel.head, camel.neck, camel.hump, camel.eyelashes, camel.ear]
    if all(v is not None for v in attrs):
        pv, sv, ep, es, ef = validate_camel_data(
            camel.points, camel.spacing,
            camel.nose, camel.lips, camel.head,
            camel.neck, camel.hump, camel.eyelashes, camel.ear
        )
        camel.points_valid = pv
        camel.spacing_valid = sv
        camel.is_valid = pv and sv
        camel.needs_review = not (pv and sv)
        camel.harmony = compute_harmony([v for v in attrs if v is not None])
    else:
        camel.points_valid = False
        camel.spacing_valid = False
        camel.is_valid = False
        camel.needs_review = True
    return camel


def _camel_to_dict(camel: Camel, db: Session) -> dict:
    d = {c.name: getattr(camel, c.name) for c in camel.__table__.columns}
    stable = db.query(Stable).filter(Stable.id == camel.stable_id).first() if camel.stable_id else None
    d["stable_name"] = stable.name if stable else None

    # Add validation info
    attrs = [camel.nose, camel.lips, camel.head, camel.neck, camel.hump, camel.eyelashes, camel.ear]
    if all(v is not None for v in attrs):
        _, _, ep, es, _ = validate_camel_data(
            camel.points, camel.spacing,
            camel.nose, camel.lips, camel.head,
            camel.neck, camel.hump, camel.eyelashes, camel.ear
        )
        d["expected_points"] = ep
        d["expected_spacing"] = es
    return d


@router.get("/", response_model=List[dict])
def list_camels(
    db: Session = Depends(get_db),
    stable_id: Optional[int] = None,
    status: Optional[str] = None,
    gender: Optional[str] = None,
    min_points: Optional[int] = None,
    max_points: Optional[int] = None,
    max_spacing: Optional[int] = None,
    search: Optional[str] = None,
    needs_review: Optional[bool] = None,
    is_valid: Optional[bool] = None,
    skip: int = 0,
    limit: int = 200,
):
    q = db.query(Camel)
    if stable_id:
        q = q.filter(Camel.stable_id == stable_id)
    if status:
        q = q.filter(Camel.status == status)
    if gender:
        q = q.filter(Camel.gender == gender)
    if min_points:
        q = q.filter(Camel.points >= min_points)
    if max_points:
        q = q.filter(Camel.points <= max_points)
    if max_spacing is not None:
        q = q.filter(Camel.spacing <= max_spacing)
    if search:
        q = q.filter(
            (Camel.number.ilike(f"%{search}%")) |
            (Camel.name.ilike(f"%{search}%")) |
            (Camel.owner.ilike(f"%{search}%"))
        )
    if needs_review is not None:
        q = q.filter(Camel.needs_review == needs_review)
    if is_valid is not None:
        q = q.filter(Camel.is_valid == is_valid)

    camels = q.order_by(Camel.id.desc()).offset(skip).limit(limit).all()
    return [_camel_to_dict(c, db) for c in camels]


@router.get("/{camel_id}", response_model=dict)
def get_camel(camel_id: int, db: Session = Depends(get_db)):
    camel = db.query(Camel).filter(Camel.id == camel_id).first()
    if not camel:
        raise HTTPException(status_code=404, detail="الناقة غير موجودة")
    return _camel_to_dict(camel, db)


@router.post("/", response_model=dict)
def create_camel(data: CamelCreate, db: Session = Depends(get_db)):
    camel_dict = data.model_dump()
    if not camel_dict.get("number") or not str(camel_dict["number"]).strip():
        count = db.query(Camel).count() + 1
        camel_dict["number"] = camel_dict.get("name") or f"ناقة {count}"
    camel = Camel(**camel_dict)
    _validate_and_enrich(camel)
    db.add(camel)
    db.commit()
    db.refresh(camel)

    # Audit log
    log = AuditLog(camel_id=camel.id, entity_type="camel", entity_id=camel.id,
                   action="create", field_name="all", old_value=None, new_value=f"number={camel.number}")
    db.add(log)
    db.commit()
    return _camel_to_dict(camel, db)


@router.put("/{camel_id}", response_model=dict)
def update_camel(camel_id: int, data: CamelUpdate, db: Session = Depends(get_db)):
    camel = db.query(Camel).filter(Camel.id == camel_id).first()
    if not camel:
        raise HTTPException(status_code=404, detail="الناقة غير موجودة")

    changes = data.model_dump(exclude_none=True)
    logs = []
    for k, v in changes.items():
        old_val = getattr(camel, k, None)
        if old_val != v:
            logs.append(AuditLog(
                camel_id=camel_id, entity_type="camel", entity_id=camel_id,
                action="update", field_name=k,
                old_value=str(old_val), new_value=str(v)
            ))
        setattr(camel, k, v)

    camel.updated_at = datetime.utcnow()
    _validate_and_enrich(camel)
    db.add_all(logs)
    db.commit()
    db.refresh(camel)
    return _camel_to_dict(camel, db)


@router.delete("/{camel_id}")
def delete_camel(camel_id: int, db: Session = Depends(get_db)):
    camel = db.query(Camel).filter(Camel.id == camel_id).first()
    if not camel:
        raise HTTPException(status_code=404, detail="الناقة غير موجودة")
    log = AuditLog(camel_id=camel_id, entity_type="camel", entity_id=camel_id,
                   action="delete", field_name="status", old_value=camel.status, new_value="deleted")
    db.add(log)
    db.delete(camel)
    db.commit()
    return {"message": "تم حذف الناقة"}


@router.post("/{camel_id}/image")
async def upload_camel_image(camel_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    camel = db.query(Camel).filter(Camel.id == camel_id).first()
    if not camel:
        raise HTTPException(status_code=404, detail="الناقة غير موجودة")

    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"

    # حذف الصورة القديمة إن وجدت
    if camel.image_path:
        delete_image(camel.image_path)

    # رفع الصورة الجديدة (R2 أو محلي تلقائياً)
    image_url = upload_image(image_bytes, file.filename or f"camel_{camel_id}.jpg", content_type)

    camel.image_path = image_url
    db.commit()
    return {"image_path": image_url}


@router.get("/{camel_id}/audit")
def get_camel_audit(camel_id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.camel_id == camel_id).order_by(AuditLog.changed_at.desc()).all()
    return [{"id": l.id, "field": l.field_name, "old": l.old_value, "new": l.new_value,
             "action": l.action, "when": l.changed_at, "by": l.changed_by} for l in logs]


@router.post("/{camel_id}/test")
def test_camel(camel_id: int, championship_id: int, db: Session = Depends(get_db)):
    """Test if a camel benefits the stable's best lineup."""
    from models.championship import Championship
    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="البطولة غير موجودة")

    new_camel = db.query(Camel).filter(Camel.id == camel_id).first()
    if not new_camel:
        raise HTTPException(status_code=404, detail="الناقة غير موجودة")

    all_camels = db.query(Camel).filter(
        Camel.stable_id == champ.stable_id,
        Camel.status == "available",
        Camel.is_valid == True
    ).all()

    camels_list = [_camel_to_dict(c, db) for c in all_camels if c.id != camel_id]
    new_camel_dict = _camel_to_dict(new_camel, db)
    new_camel_dict["is_valid"] = True
    new_camel_dict["status"] = "available"

    result = test_camel_benefit(
        new_camel_dict, camels_list,
        champ.min_camels, champ.max_camels,
        champ.required_spacing, champ.max_points_per_camel,
        champ.allow_males
    )
    return result


@router.get("/analysis/stable/{stable_id}")
def analyze_stable(stable_id: int, championship_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Analyze what attributes/specs the stable needs for future camels."""
    q = db.query(Camel).filter(Camel.stable_id == stable_id, Camel.is_valid == True, Camel.status == "available")
    all_camels = [_camel_to_dict(c, db) for c in q.all()]

    if championship_id:
        from models.championship import ChampionshipResult
        latest_result = db.query(ChampionshipResult).filter(
            ChampionshipResult.championship_id == championship_id
        ).order_by(ChampionshipResult.created_at.desc()).first()
        if latest_result and latest_result.selected_camel_ids:
            selected_ids = set(latest_result.selected_camel_ids)
            selected = [c for c in all_camels if c["id"] in selected_ids]
        else:
            selected = all_camels
    else:
        selected = all_camels

    result = analyze_stable_needs(selected, all_camels)
    return result


from pydantic import BaseModel


class BulkAssignRequest(BaseModel):
    camel_ids: List[int]
    stable_id: Optional[int] = None
    new_stable_name: Optional[str] = None
    status: Optional[str] = None


class BulkDeleteRequest(BaseModel):
    camel_ids: List[int]


@router.post("/bulk-assign")
def bulk_assign_camels(data: BulkAssignRequest, db: Session = Depends(get_db)):
    if not data.camel_ids:
        raise HTTPException(status_code=400, detail="لم يتم اختيار نياق")

    target_stable_id = data.stable_id
    if data.new_stable_name and data.new_stable_name.strip():
        name = data.new_stable_name.strip()
        stable = db.query(Stable).filter(Stable.name == name).first()
        if not stable:
            stable = Stable(name=name)
            db.add(stable)
            db.commit()
            db.refresh(stable)
        target_stable_id = stable.id

    camels = db.query(Camel).filter(Camel.id.in_(data.camel_ids)).all()
    for c in camels:
        if target_stable_id is not None:
            c.stable_id = target_stable_id
        if data.status:
            c.status = data.status
        c.updated_at = datetime.utcnow()

    db.commit()
    return {"message": f"تم تعيين {len(camels)} ناقة للمنقية بنجاح", "count": len(camels), "stable_id": target_stable_id}


@router.post("/bulk-delete")
def bulk_delete_camels(data: BulkDeleteRequest, db: Session = Depends(get_db)):
    if not data.camel_ids:
        raise HTTPException(status_code=400, detail="لم يتم اختيار نياق")
    count = db.query(Camel).filter(Camel.id.in_(data.camel_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"تم حذف {count} ناقة بنجاح", "count": count}

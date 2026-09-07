from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.stable import Stable
from models.camel import Camel
from models.user import User
from routers.auth import get_optional_user
from schemas import StableCreate, StableUpdate, StableOut

router = APIRouter(prefix="/stables", tags=["stables"])


@router.get("/", response_model=List[StableOut])
def list_stables(db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    q = db.query(Stable)
    if user and user.role != "admin":
        q = q.filter(Stable.discord_user_id == user.discord_id)

    stables = q.all()
    result = []
    for s in stables:
        count = db.query(Camel).filter(Camel.stable_id == s.id, Camel.status == "available").count()
        out = StableOut.model_validate(s)
        out.camel_count = count
        result.append(out)
    return result


@router.post("/", response_model=StableOut)
def create_stable(
    data: StableCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    existing = db.query(Stable).filter(Stable.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="اسم المنقية موجود مسبقاً")

    # إذا كان المستخدم basic_user، نتحقق أنه لا يملك منقية بالفعل أو نربطها به
    stable_dict = data.model_dump()
    if user:
        if user.role != "admin":
            existing_user_stable = db.query(Stable).filter(Stable.discord_user_id == user.discord_id).first()
            if existing_user_stable:
                raise HTTPException(status_code=400, detail="لديك منقية مسجلة بالفعل، يمكنك تعديلها فقط")
        stable_dict["discord_user_id"] = user.discord_id
        stable_dict["discord_username"] = user.username

    stable = Stable(**stable_dict)
    db.add(stable)
    db.commit()
    db.refresh(stable)
    return stable


@router.put("/{stable_id}", response_model=StableOut)
def update_stable(
    stable_id: int,
    data: StableUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    stable = db.query(Stable).filter(Stable.id == stable_id).first()
    if not stable:
        raise HTTPException(status_code=404, detail="المنقية غير موجودة")

    # التحقق من الصلاحيات: الأدمن أو صاحب المنقية فقط
    if user and user.role != "admin" and stable.discord_user_id != user.discord_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لتعديل هذه المنقية")

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(stable, k, v)
    db.commit()
    db.refresh(stable)
    return stable


@router.delete("/{stable_id}")
def delete_stable(
    stable_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    stable = db.query(Stable).filter(Stable.id == stable_id).first()
    if not stable:
        raise HTTPException(status_code=404, detail="المنقية غير موجودة")

    # التحقق من الصلاحيات: الأدمن أو صاحب المنقية فقط
    if user and user.role != "admin" and stable.discord_user_id != user.discord_id:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لحذف هذه المنقية")

    camel_count = db.query(Camel).filter(Camel.stable_id == stable_id).count()
    if camel_count > 0:
        raise HTTPException(status_code=400, detail=f"لا يمكن حذف المنقية - بها {camel_count} ناقة")
    db.delete(stable)
    db.commit()
    return {"message": "تم حذف المنقية"}

from fastapi import APIRouter, UploadFile, File, Query, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from models.camel import Camel
from services.excel_service import export_camels_to_excel, import_camels_from_excel
from utils.validators import validate_camel_data, compute_harmony

router = APIRouter(prefix="/excel", tags=["excel"])


@router.get("/export")
def export_excel(
    stable_id: Optional[int] = None,
    format: str = Query("rows", enum=["rows", "columns"]),
    db: Session = Depends(get_db)
):
    """Export camels to Excel."""
    q = db.query(Camel)
    if stable_id:
        q = q.filter(Camel.stable_id == stable_id)

    camels = q.all()
    camels_list = [{c.name: getattr(camel, c.name) for c in camel.__table__.columns} for camel in camels]

    excel_bytes = export_camels_to_excel(camels_list, format=format)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=camels_export.xlsx"}
    )


@router.post("/import")
async def import_excel(
    file: UploadFile = File(...),
    stable_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Import camels from Excel file."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ")

    parse_result = import_camels_from_excel(content, stable_id=stable_id)

    if "error" in parse_result:
        raise HTTPException(status_code=400, detail=parse_result["error"])

    imported_count = 0
    errors = list(parse_result.get("errors", []))

    for camel_data in parse_result.get("camels", []):
        try:
            # Remove non-model keys
            camel_data.pop("stable_name", None)

            camel = Camel(**{k: v for k, v in camel_data.items() if hasattr(Camel, k)})

            # Validate
            attrs = [camel.nose, camel.lips, camel.head, camel.neck, camel.hump, camel.eyelashes, camel.ear]
            if all(v is not None for v in attrs):
                pv, sv, ep, es, _ = validate_camel_data(
                    camel.points, camel.spacing,
                    camel.nose, camel.lips, camel.head,
                    camel.neck, camel.hump, camel.eyelashes, camel.ear
                )
                camel.points_valid = pv
                camel.spacing_valid = sv
                camel.is_valid = pv and sv
                camel.harmony = compute_harmony([v for v in attrs if v is not None])
                camel.needs_review = not (pv and sv)
            else:
                camel.needs_review = True

            db.add(camel)
            db.flush()
            imported_count += 1
        except Exception as e:
            errors.append(f"ناقة {camel_data.get('number', '?')}: {str(e)}")

    db.commit()
    return {
        "total_rows": parse_result.get("total_rows", 0),
        "imported": imported_count,
        "errors": errors,
    }

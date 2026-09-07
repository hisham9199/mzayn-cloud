from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import zipfile, io, os, uuid
import aiofiles

from services.ocr_service import extract_camel_data_from_image

router = APIRouter(prefix="/ocr", tags=["ocr"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
TEMP_DIR = os.path.join(UPLOAD_DIR, "tmp")
os.makedirs(TEMP_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
#  صورة واحدة (سريع / متزامن)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/image")
async def ocr_single_image(file: UploadFile = File(...)):
    """استخراج بيانات ناقة من صورة بطاقة واحدة."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ")
    result = await extract_camel_data_from_image(content)
    return result


# ─────────────────────────────────────────────────────────────────────────────
#  رفع دفعة صور - غير متزامن عبر Celery Queue (الطريقة الموصى بها)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/bulk-async")
async def ocr_bulk_async(files: List[UploadFile] = File(...)):
    """
    رفع دفعة صور للمعالجة في الخلفية.
    يرجع task_ids فوراً — استخدم /ocr/task/{id} للاستعلام عن النتيجة.
    """
    from workers.ocr_worker import process_ocr_image

    tasks = []
    for f in files:
        content = await f.read()
        if not content:
            continue

        # حفظ مؤقت على القرص (بدلاً من إرسال bytes عبر Redis)
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(f.filename or "img.jpg")[1].lower() or ".jpg"
        temp_path = os.path.join(TEMP_DIR, f"{file_id}{ext}")

        async with aiofiles.open(temp_path, "wb") as fp:
            await fp.write(content)

        # إرسال للطابور
        task = process_ocr_image.apply_async(
            args=[temp_path, f.filename or file_id],
            queue="ocr",
        )
        tasks.append({"task_id": task.id, "filename": f.filename or file_id})

    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "total": len(tasks),
        "tasks": tasks,
        "poll_url": f"/ocr/session/{session_id}",
    }


@router.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """تحقق من حالة مهمة OCR واحدة."""
    from workers.ocr_worker import celery_app
    result = celery_app.AsyncResult(task_id)

    if result.successful():
        return {"status": "done", "result": result.get()}
    elif result.failed():
        return {"status": "error", "error": str(result.result)}
    elif result.state == "STARTED":
        return {"status": "processing"}
    else:
        return {"status": "pending"}


@router.post("/tasks/batch-status")
async def get_tasks_batch_status(body: dict):
    """
    استعلام عن حالة عدة مهام دفعة واحدة.
    Body: {"task_ids": ["id1", "id2", ...]}
    """
    from workers.ocr_worker import celery_app
    task_ids = body.get("task_ids", [])
    statuses = []
    for tid in task_ids:
        r = celery_app.AsyncResult(tid)
        if r.successful():
            statuses.append({"task_id": tid, "status": "done", "result": r.get()})
        elif r.failed():
            statuses.append({"task_id": tid, "status": "error", "error": str(r.result)})
        elif r.state == "STARTED":
            statuses.append({"task_id": tid, "status": "processing"})
        else:
            statuses.append({"task_id": tid, "status": "pending"})

    done = sum(1 for s in statuses if s["status"] == "done")
    return {
        "total": len(statuses),
        "done": done,
        "remaining": len(statuses) - done,
        "completed_pct": round(done / len(statuses) * 100) if statuses else 0,
        "tasks": statuses,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  رفع دفعة - متزامن (للتوافق مع الواجهة القديمة، يعمل لعدد صغير)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/bulk")
async def ocr_bulk_images(files: List[UploadFile] = File(...)):
    """معالجة عدة صور بالتتابع (حتى 10 صور)."""
    results = []
    success = needs_review = errors = 0

    for f in files:
        try:
            content = await f.read()
            result = await extract_camel_data_from_image(content)
            result["filename"] = f.filename
            status = result.get("overall_status", "red")
            if status == "green":
                success += 1
            elif status == "yellow":
                needs_review += 1
            else:
                errors += 1
                result["needs_review"] = True
            results.append(result)
        except Exception as e:
            errors += 1
            results.append({"filename": f.filename, "error": str(e), "overall_status": "red"})

    return {
        "total_images": len(files),
        "successful": success,
        "needs_review": needs_review,
        "errors": errors,
        "results": results,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  ZIP و PDF
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/bulk-zip")
async def ocr_zip_file(file: UploadFile = File(...)):
    """معالجة ملف ZIP يحتوي على صور."""
    content = await file.read()
    results = []
    success = needs_review = errors = 0

    try:
        z = zipfile.ZipFile(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="الملف ليس ملف ZIP صحيح")

    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

    for name in z.namelist():
        ext = os.path.splitext(name)[1].lower()
        if ext not in image_exts:
            continue
        try:
            img_bytes = z.read(name)
            result = await extract_camel_data_from_image(img_bytes)
            result["filename"] = name
            status = result.get("overall_status", "red")
            if status == "green":
                success += 1
            elif status == "yellow":
                needs_review += 1
            else:
                errors += 1
            results.append(result)
        except Exception as e:
            errors += 1
            results.append({"filename": name, "error": str(e), "overall_status": "red"})

    return {
        "total_images": len(results),
        "successful": success,
        "needs_review": needs_review,
        "errors": errors,
        "results": results,
    }


@router.post("/pdf")
async def ocr_pdf_file(file: UploadFile = File(...)):
    """معالجة ملف PDF يحتوي على صور البطاقات."""
    from PyPDF2 import PdfReader
    content = await file.read()
    results = []
    success = needs_review = errors = 0

    try:
        reader = PdfReader(io.BytesIO(content))
        extracted_images = [
            (f"page_{p+1}_img_{i+1}.jpg", img.data)
            for p, page in enumerate(reader.pages)
            for i, img in enumerate(page.images)
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل قراءة ملف PDF: {e}")

    if not extracted_images:
        return {
            "total_images": 0, "successful": 0, "needs_review": 0, "errors": 1,
            "results": [{"filename": file.filename, "error": "لا توجد صور في PDF", "overall_status": "red"}],
        }

    for fname, img_bytes in extracted_images:
        try:
            result = await extract_camel_data_from_image(img_bytes)
            result["filename"] = fname
            status = result.get("overall_status", "red")
            if status == "green":
                success += 1
            elif status == "yellow":
                needs_review += 1
            else:
                errors += 1
            results.append(result)
        except Exception as e:
            errors += 1
            results.append({"filename": fname, "error": str(e), "overall_status": "red"})

    return {
        "total_images": len(results),
        "successful": success,
        "needs_review": needs_review,
        "errors": errors,
        "results": results,
    }

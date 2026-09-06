from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
import zipfile, io, os
from services.ocr_service import extract_camel_data_from_image

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/image")
async def ocr_single_image(file: UploadFile = File(...)):
    """Extract camel data from a single game screenshot."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ")

    result = await extract_camel_data_from_image(content)
    return result


@router.post("/bulk")
async def ocr_bulk_images(files: List[UploadFile] = File(...)):
    """Process multiple images at once."""
    results = []
    success = 0
    needs_review = 0
    errors = 0

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


@router.post("/bulk-zip")
async def ocr_zip_file(file: UploadFile = File(...)):
    """Process a ZIP file containing multiple images."""
    content = await file.read()
    results = []
    success = 0
    needs_review = 0
    errors = 0

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

@router.post("/pdf")
async def ocr_pdf_file(file: UploadFile = File(...)):
    """Process a PDF file containing camel images."""
    from PyPDF2 import PdfReader
    content = await file.read()
    results = []
    success = 0
    needs_review = 0
    errors = 0

    try:
        reader = PdfReader(io.BytesIO(content))
        extracted_images = []
        for page_idx, page in enumerate(reader.pages):
            for img_idx, img_obj in enumerate(page.images):
                extracted_images.append((f"page_{page_idx+1}_img_{img_idx+1}.jpg", img_obj.data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل قراءة ملف PDF: {str(e)}")

    if not extracted_images:
        return {
            "total_images": 0,
            "successful": 0,
            "needs_review": 0,
            "errors": 1,
            "results": [{"filename": file.filename, "error": "لم يتم العثور على صور داخل ملف PDF", "overall_status": "red"}],
        }

    for filename, img_bytes in extracted_images:
        try:
            result = await extract_camel_data_from_image(img_bytes)
            result["filename"] = filename

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
            results.append({"filename": filename, "error": str(e), "overall_status": "red"})

    return {
        "total_images": len(results),
        "successful": success,
        "needs_review": needs_review,
        "errors": errors,
        "results": results,
    }


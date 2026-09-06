"""
ocr_service.py - خدمة استخراج بيانات النياق من صور تطبيق المزاين
تعتمد على Google Cloud Vision API (أسرع بـ 40x) مع fallback لـ EasyOCR المحلي
تصحيح أخطاء الخطوط والرموز واستخراج الصفات السبع بدقة عالية
"""

import cv2
import numpy as np
import base64
import re
import os
import asyncio
from typing import Optional, Dict, Any, List, Tuple

# ------------------------------------------------------------------ #
# OCR Engine Selection                                                 #
# ------------------------------------------------------------------ #
_reader = None
OCR_AVAILABLE = False
OCR_ENGINE = "none"

# --- Google Cloud Vision API (الأولوية الأولى إذا كان مفعلاً) ---
_vision_client = None
_use_google_vision = False

GOOGLE_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_VISION_API_KEY", "")

# --- Tesseract OCR check (خفيف، مجاني، ومدمج في الحاوية) ---
_use_tesseract = False
try:
    import pytesseract
    # Test if tesseract is installed and available in PATH
    pytesseract.get_tesseract_version()
    _use_tesseract = True
    OCR_AVAILABLE = True
    OCR_ENGINE = "tesseract"
    print("✅ Tesseract OCR initialized successfully")
except Exception as e:
    print(f"⚠️  Tesseract not available: {e}")

# --- EasyOCR fallback (إذا توفر) ---
try:
    import easyocr
    _reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
    OCR_AVAILABLE = True
    if not OCR_ENGINE or OCR_ENGINE == "none":
        OCR_ENGINE = "easyocr"
    print("✅ EasyOCR initialized")
except Exception as e:
    pass

# Always enable OCR if any engine or Google API Key exists
if GOOGLE_API_KEY or GOOGLE_CREDENTIALS or _use_tesseract or _reader is not None:
    OCR_AVAILABLE = True
    if GOOGLE_API_KEY or GOOGLE_CREDENTIALS:
        OCR_ENGINE = "google_vision"
    elif _use_tesseract:
        OCR_ENGINE = "tesseract"
    elif _reader is not None:
        OCR_ENGINE = "easyocr"


# ------------------------------------------------------------------ #
# Arabic label mapping for the 7 attributes                           #
# ------------------------------------------------------------------ #
ATTR_LABEL_MAP = {
    # الأنف (nose)
    "الأنف": "nose", "الانف": "nose", "أنف": "nose", "انف": "nose",
    "ألأنف": "nose", "ألانف": "nose", "الالف": "nose", "الف": "nose",
    # الشفاه / الشفة (lips)
    "الشفاه": "lips", "شفاه": "lips", "الشفة": "lips", "شفة": "lips",
    "الشفه": "lips", "شفه": "lips", "الشتاه": "lips", "شتاه": "lips",
    "الشناه": "lips", "شناه": "lips", "الشف": "lips", "شف": "lips", "الشفآه": "lips",
    # الرأس (head)
    "الرأس": "head", "الراس": "head", "رأس": "head", "راس": "head",
    "الاراس": "head", "اراس": "head", "الراص": "head", "راص": "head",
    # الرموش (eyelashes)
    "الرموش": "eyelashes", "رموش": "eyelashes", "الرموس": "eyelashes", "رموس": "eyelashes",
    "اليرموس": "eyelashes", "يرموس": "eyelashes", "الرموص": "eyelashes", "رموص": "eyelashes",
    # الأذن (ear)
    "الأذن": "ear", "الاذن": "ear", "أذن": "ear", "اذن": "ear",
    "الادن": "ear", "ادن": "ear", "آلادن": "ear", "ألادن": "ear",
    "الانن": "ear", "انن": "ear", "ألانن": "ear", "الاذين": "ear", "اذين": "ear",
    # السنام (hump)
    "السنام": "hump", "سنام": "hump", "السنم": "hump", "سنم": "hump",
    "السسام": "hump", "سسام": "hump", "السام": "hump", "سام": "hump",
    "ألسنام": "hump", "آلسنام": "hump", "المنام": "hump", "منام": "hump",
    # الرقبة (neck)
    "الرقبة": "neck", "رقبة": "neck", "الرقبه": "neck", "رقبه": "neck",
    "ألرقبة": "neck", "ألرقبه": "neck", "الربقة": "neck", "ربقة": "neck",
}

ALL_ATTRIBUTES = ["nose", "lips", "head", "neck", "hump", "eyelashes", "ear"]

# Expected anatomical relative positions on camel diagram (rel_x, rel_y)
ATTR_TARGET_POS = {
    "nose":      (0.17, 0.52),
    "lips":      (0.17, 0.66),
    "neck":      (0.25, 0.76),
    "head":      (0.33, 0.43),
    "eyelashes": (0.45, 0.40),
    "ear":       (0.74, 0.47),
    "hump":      (0.77, 0.62),
}


# ------------------------------------------------------------------ #
# Helpers                                                              #
# ------------------------------------------------------------------ #
def normalise(t: str) -> str:
    """Remove diacritics and normalise Arabic characters."""
    t = re.sub(r'[\u064b-\u065f\u0670]', '', t)
    t = re.sub(r'[أإآا]', 'ا', t)
    t = re.sub(r'[ؤو]', 'و', t)
    t = re.sub(r'[ئي]', 'ي', t)
    t = re.sub(r'ه$', 'ة', t)
    return t.strip()


def extract_num(text: str) -> Optional[int]:
    """Convert Arabic or Western digits to integer, fixing OCR font misreadings."""
    t = text
    t = re.sub(r'[\{\}\[\]\(\)\|!lI]', '1', t)
    arabic_map = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
    t = t.translate(arabic_map)
    c = re.sub(r'[^\d]', '', t)
    if not c:
        return None
    try:
        return int(c)
    except ValueError:
        return None


# ------------------------------------------------------------------ #
# Google Cloud Vision API                                              #
# ------------------------------------------------------------------ #
def run_google_vision(img: np.ndarray) -> List[Dict]:
    """
    Send image to Google Cloud Vision API for text detection.
    Returns blocks in the same format as run_easyocr for compatibility.
    """
    if _vision_client is None:
        return []

    try:
        from google.cloud import vision as gvision

        # Encode image to PNG bytes
        success, encoded = cv2.imencode('.png', img)
        if not success:
            return []
        image_bytes = encoded.tobytes()

        image = gvision.Image(content=image_bytes)
        response = _vision_client.document_text_detection(image=image)

        if response.error.message:
            print(f"Google Vision error: {response.error.message}")
            return []

        blocks = []
        if not response.full_text_annotation:
            return []

        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for para in block.paragraphs:
                    para_text = ""
                    para_conf = 0.0
                    word_count = 0

                    xs = []
                    ys = []

                    for word in para.words:
                        word_text = "".join([
                            symbol.text for symbol in word.symbols
                        ])
                        para_text += word_text + " "
                        # Use word confidence if available
                        if hasattr(word, 'confidence'):
                            para_conf += word.confidence
                            word_count += 1

                        for vertex in word.bounding_box.vertices:
                            if vertex.x:
                                xs.append(float(vertex.x))
                            if vertex.y:
                                ys.append(float(vertex.y))

                    para_text = para_text.strip()
                    if not para_text or not xs or not ys:
                        continue

                    avg_conf = (para_conf / word_count) if word_count > 0 else 0.85

                    blocks.append({
                        "text": para_text,
                        "confidence": float(avg_conf),
                        "cx": float((min(xs) + max(xs)) / 2),
                        "cy": float((min(ys) + max(ys)) / 2),
                        "x1": float(min(xs)), "y1": float(min(ys)),
                        "x2": float(max(xs)), "y2": float(max(ys)),
                    })

        blocks.sort(key=lambda b: (b["y1"], b["x1"]))
        return blocks

    except Exception as e:
        print(f"Google Vision API error: {e}")
        return []


def run_google_vision_rest(img: np.ndarray) -> List[Dict]:
    """
    Alternative: Use REST API with API Key (no service account needed).
    Activate by setting GOOGLE_VISION_API_KEY env variable.
    """
    if not GOOGLE_API_KEY:
        return []

    import json
    import urllib.request

    try:
        success, encoded = cv2.imencode('.png', img)
        if not success:
            return []

        image_b64 = base64.b64encode(encoded.tobytes()).decode('utf-8')

        request_body = {
            "requests": [{
                "image": {"content": image_b64},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION", "maxResults": 1}],
                "imageContext": {"languageHints": ["ar", "en"]}
            }]
        }

        url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_API_KEY}"
        data = json.dumps(request_body).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())

        responses = result.get("responses", [])
        if not responses:
            return []

        annotation = responses[0].get("fullTextAnnotation", {})
        blocks = []

        for page in annotation.get("pages", []):
            for block in page.get("blocks", []):
                for para in block.get("paragraphs", []):
                    para_text = ""
                    xs, ys = [], []
                    conf_sum = 0.0
                    word_count = 0

                    for word in para.get("words", []):
                        word_text = "".join([
                            s.get("text", "") for s in word.get("symbols", [])
                        ])
                        para_text += word_text + " "
                        conf_sum += word.get("confidence", 0.85)
                        word_count += 1
                        for v in word.get("boundingBox", {}).get("vertices", []):
                            if "x" in v:
                                xs.append(float(v["x"]))
                            if "y" in v:
                                ys.append(float(v["y"]))

                    para_text = para_text.strip()
                    if not para_text or not xs or not ys:
                        continue

                    avg_conf = (conf_sum / word_count) if word_count > 0 else 0.85
                    blocks.append({
                        "text": para_text,
                        "confidence": float(avg_conf),
                        "cx": float((min(xs) + max(xs)) / 2),
                        "cy": float((min(ys) + max(ys)) / 2),
                        "x1": float(min(xs)), "y1": float(min(ys)),
                        "x2": float(max(xs)), "y2": float(max(ys)),
                    })

        blocks.sort(key=lambda b: (b["y1"], b["x1"]))
        return blocks

    except Exception as e:
        print(f"Google Vision REST error: {e}")
        return []


# ------------------------------------------------------------------ #
# EasyOCR fallback                                                     #
# ------------------------------------------------------------------ #
def run_easyocr(img: np.ndarray) -> List[Dict]:
    if _reader is None:
        return []
    try:
        results = _reader.readtext(img, detail=1, paragraph=False)
    except Exception as e:
        print(f"EasyOCR error: {e}")
        return []

    blocks = []
    for (bbox, text, conf) in results:
        xs = [float(p[0]) for p in bbox]
        ys = [float(p[1]) for p in bbox]
        blocks.append({
            "text": text.strip(),
            "confidence": float(conf),
            "cx": float((min(xs) + max(xs)) / 2),
            "cy": float((min(ys) + max(ys)) / 2),
            "x1": float(min(xs)), "y1": float(min(ys)),
            "x2": float(max(xs)), "y2": float(max(ys)),
        })
    blocks.sort(key=lambda b: (b["y1"], b["x1"]))
    return blocks


# ------------------------------------------------------------------ #
# Tesseract OCR (خفيف، مجاني، ومدمج بالسيرفر)                          #
# ------------------------------------------------------------------ #
def run_tesseract(img: np.ndarray) -> List[Dict]:
    try:
        import pytesseract
        from pytesseract import Output

        # استخراج الكلمات مع الإحداثيات ونسب الثقة
        data = pytesseract.image_to_data(img, lang='ara+eng', output_type=Output.DICT)
        blocks = []
        n_boxes = len(data['text'])
        for i in range(n_boxes):
            text = data['text'][i].strip()
            conf = float(data['conf'][i])
            if not text or conf < 20:
                continue

            x = float(data['left'][i])
            y = float(data['top'][i])
            w = float(data['width'][i])
            h = float(data['height'][i])

            blocks.append({
                "text": text,
                "confidence": conf / 100.0,
                "cx": x + w / 2,
                "cy": y + h / 2,
                "x1": x, "y1": y,
                "x2": x + w, "y2": y + h,
            })

        blocks.sort(key=lambda b: (b["y1"], b["x1"]))
        return blocks
    except Exception as e:
        print(f"Tesseract OCR error: {e}")
        return []


def run_ocr(img: np.ndarray) -> List[Dict]:
    """
    الدالة الموحدة للـ OCR - تختار أفضل محرك متاح تلقائياً.
    الأولوية: Google Vision REST > Tesseract (محلي) > EasyOCR
    """
    # 1. Google Vision REST API
    if GOOGLE_API_KEY:
        try:
            blocks = run_google_vision_rest(img)
            if blocks:
                return blocks
        except Exception as e:
            print(f"Google Vision fallback to local OCR: {e}")

    # 2. Tesseract OCR (محلي وسريع ومجاني في السيرفر)
    blocks = run_tesseract(img)
    if blocks:
        return blocks

    # 3. EasyOCR / PaddleOCR (fallback إضافي)
    if _reader is not None:
        return run_easyocr(img)

    return []


# ------------------------------------------------------------------ #
# Smart Parser for Mazayen Camel Card                                  #
# ------------------------------------------------------------------ #
def parse_camel_blocks(blocks: List[Dict], img_h: int, img_w: int) -> Dict[str, Any]:
    field_values: Dict[str, Dict] = {}

    # 1. Total Points (المواصفات): look for 4-digit number (1000 - 9999)
    points_val = None
    points_conf = 0.0
    for b in blocks:
        n = extract_num(b["text"])
        if n and 1000 <= n <= 9999:
            points_val = int(n)
            points_conf = float(b["confidence"])
            break
    if points_val:
        field_values["points"] = {"value": str(points_val), "confidence": round(points_conf, 3), "status": "green"}

    # 2. Spacing (التباعد): look for 'التباعد' block or text containing 'تباعد'
    spacing_val = None
    spacing_conf = 0.0
    for b in blocks:
        norm = normalise(b["text"])
        if "تباعد" in norm:
            n = extract_num(b["text"])
            if n is not None and 0 <= n <= 100:
                spacing_val = int(n)
                spacing_conf = float(b["confidence"])
                break
    # If not found inline, look for number near 'تباعد' label
    if spacing_val is None:
        for i, b in enumerate(blocks):
            if "تباعد" in normalise(b["text"]):
                for j, other in enumerate(blocks):
                    if i == j: continue
                    n = extract_num(other["text"])
                    if n is not None and 0 <= n <= 100 and abs(other["cy"] - b["cy"]) < 50:
                        spacing_val = int(n)
                        spacing_conf = float(other["confidence"])
                        break
                if spacing_val is not None: break

    if spacing_val is not None:
        field_values["spacing"] = {"value": str(spacing_val), "confidence": round(spacing_conf, 3), "status": "green"}

    # 3. Camel Number: look for "رقم N" pattern first (top header, right side)
    header_name = None
    header_conf = 0.0

    for i, b in enumerate(blocks):
        if b["cy"] > img_h * 0.30:
            continue
        if "رقم" in b["text"] or "رقم" in normalise(b["text"]):
            n = extract_num(b["text"])
            if n is not None and 1 <= n <= 9999:
                header_name = str(n)
                header_conf = float(b["confidence"])
                break
            for j, o in enumerate(blocks):
                if i == j: continue
                if abs(o["cy"] - b["cy"]) < img_h * 0.06 and b["cx"] > img_w * 0.35:
                    n2 = extract_num(o["text"])
                    if n2 is not None and 1 <= n2 <= 9999:
                        header_name = str(n2)
                        header_conf = float(o["confidence"])
                        break
            if header_name:
                break

    if not header_name:
        for b in blocks:
            if b["cy"] < img_h * 0.25 and b["cx"] > img_w * 0.50 and b["confidence"] > 0.25:
                txt = b["text"].strip()
                n = extract_num(txt)
                if n is not None and 1 <= n <= 9999:
                    if n < 1000:
                        clean_name = f"ت{n}" if "ت" in txt else str(n)
                        if b["confidence"] > header_conf:
                            header_name = clean_name
                            header_conf = float(b["confidence"])

    if header_name:
        field_values["name"] = {"value": header_name, "confidence": round(header_conf, 3), "status": "green"}
        field_values["number"] = {"value": header_name, "confidence": round(header_conf, 3), "status": "green"}

    # 4. Color / Breed (اللون / السلالة)
    breed_val = None
    breed_conf = 0.0
    BUTTON_WORDS = {"فحص", "تخلص", "معالجة", "تدريب", "تسريع", "تغيير", "بدون"}
    for i, b in enumerate(blocks):
        norm = normalise(b["text"])
        if "سلالة" in norm:
            for j, o in enumerate(blocks):
                if i == j: continue
                if abs(o["cy"] - b["cy"]) < img_h * 0.05:
                    clean_txt = o["text"].strip()
                    if clean_txt and not any(w in clean_txt for w in BUTTON_WORDS) and not extract_num(clean_txt):
                        breed_val = clean_txt
                        breed_conf = float(o["confidence"])
                        break
            if breed_val: break

    if breed_val:
        field_values["color"] = {"value": breed_val, "confidence": round(breed_conf, 3), "status": "green"}
        if not header_name:
            field_values["name"] = {"value": breed_val, "confidence": round(breed_conf, 3), "status": "green"}

    # 5. Extract the 7 body attributes
    assigned_num_indices = set()
    max_allowed_dist = max(350.0, float(img_h) * 0.25)

    for i, b in enumerate(blocks):
        norm_b = normalise(b["text"])
        matched_attr = None
        for lbl, attr_key in ATTR_LABEL_MAP.items():
            if normalise(lbl) in norm_b:
                matched_attr = attr_key
                break

        if not matched_attr or matched_attr in field_values:
            continue

        best_num = None
        best_conf = 0.0
        best_idx = None
        best_dist = float("inf")

        for j, o in enumerate(blocks):
            if i == j or j in assigned_num_indices:
                continue
            if "تناسق" in normalise(o["text"]) or "عام" in normalise(o["text"]):
                continue
            n = extract_num(o["text"])
            if n is not None and 100 <= n <= 600:
                dx = abs(o["cx"] - b["cx"])
                dy = abs(o["cy"] - b["cy"])
                dist = dx + dy * 1.5
                if dist < best_dist:
                    best_dist = dist
                    best_num = int(n)
                    best_conf = float(o["confidence"])
                    best_idx = j

        if best_num is not None and best_dist < max_allowed_dist:
            assigned_num_indices.add(best_idx)
            field_values[matched_attr] = {
                "value": str(best_num),
                "confidence": round(best_conf, 3),
                "status": "green" if best_conf >= 0.65 else "yellow",
            }

    # 6. Fallback for missing attributes: match by spatial anatomical positions
    missing_attrs = [a for a in ALL_ATTRIBUTES if a not in field_values]
    if missing_attrs:
        unassigned_blocks = []
        for j, o in enumerate(blocks):
            if j not in assigned_num_indices and o["cy"] > img_h * 0.30 and o["cy"] < img_h * 0.85:
                if "تناسق" in normalise(o["text"]) or "عام" in normalise(o["text"]):
                    continue
                n = extract_num(o["text"])
                if n is not None and 100 <= n <= 600:
                    unassigned_blocks.append((j, o, int(n)))

        for attr in list(missing_attrs):
            if not unassigned_blocks:
                break
            target_rx, target_ry = ATTR_TARGET_POS.get(attr, (0.5, 0.5))
            target_cx = target_rx * img_w
            target_cy = target_ry * img_h

            best_idx_in_list = None
            best_spatial_dist = float("inf")
            for idx_in_list, (j, o, val) in enumerate(unassigned_blocks):
                d = abs(o["cx"] - target_cx) + abs(o["cy"] - target_cy) * 1.2
                if d < best_spatial_dist:
                    best_spatial_dist = d
                    best_idx_in_list = idx_in_list

            if best_idx_in_list is not None:
                j, o, val = unassigned_blocks.pop(best_idx_in_list)
                assigned_num_indices.add(j)
                field_values[attr] = {
                    "value": str(val),
                    "confidence": round(float(o["confidence"]), 3),
                    "status": "yellow",
                }

    # 7. Cross-validation: Check sum of 7 attributes vs Points, and Max - Min vs Spacing
    attr_values = []
    for a in ALL_ATTRIBUTES:
        try:
            val = int(field_values.get(a, {}).get("value") or 0)
        except (ValueError, TypeError):
            val = 0
        attr_values.append(val)

    if all(v > 0 for v in attr_values):
        calc_sum = int(sum(attr_values))
        calc_sp = int(max(attr_values) - min(attr_values))

        if "points" not in field_values or not field_values["points"]["value"]:
            field_values["points"] = {"value": str(calc_sum), "confidence": 1.0, "status": "green"}
        if "spacing" not in field_values or not field_values["spacing"]["value"]:
            field_values["spacing"] = {"value": str(calc_sp), "confidence": 1.0, "status": "green"}

        pts = int(field_values["points"]["value"])
        sp = int(field_values["spacing"]["value"])
        valid = (pts == calc_sum) and (sp == calc_sp)

        field_values["validation_ok"] = bool(valid)
        field_values["expected_points"] = int(calc_sum)
        field_values["expected_spacing"] = int(calc_sp)

        confs = [field_values[a]["confidence"] for a in ALL_ATTRIBUTES if a in field_values]
        field_values["overall_confidence"] = float(round(sum(confs) / len(confs), 3)) if confs else 0.95
        field_values["overall_status"] = "green" if valid else "yellow"
    else:
        field_values["validation_ok"] = False
        field_values["overall_confidence"] = 0.5
        field_values["overall_status"] = "yellow"

    for f in ALL_ATTRIBUTES + ["points", "spacing", "number", "name"]:
        if f not in field_values:
            field_values[f] = {"value": "", "confidence": 0.0, "status": "red"}

    return field_values


# ------------------------------------------------------------------ #
# Image Preprocessing                                                  #
# ------------------------------------------------------------------ #
def preprocess_image(img: np.ndarray) -> List[np.ndarray]:
    """Return multiple processed variants of the image to maximize OCR accuracy."""
    variants = []

    # Variant 1: Upscaled original (2x)
    h, w = img.shape[:2]
    up2x = cv2.resize(img, (int(w * 2), int(h * 2)), interpolation=cv2.INTER_LANCZOS4)
    variants.append(up2x)

    # Google Vision لا يحتاج variants متعددة - إرجاع variant واحد فقط
    if _use_google_vision or GOOGLE_API_KEY:
        return variants

    # EasyOCR يستفيد من variants متعددة
    # Variant 2: Upscaled + contrast enhanced (CLAHE on LAB)
    lab = cv2.cvtColor(up2x, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l_ch = clahe.apply(l_ch)
    lab = cv2.merge([l_ch, a_ch, b_ch])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    variants.append(enhanced)

    # Variant 3: Grayscale sharpened
    gray = cv2.cvtColor(up2x, cv2.COLOR_BGR2GRAY)
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, sharpen_kernel)
    gray3 = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
    variants.append(gray3)

    return variants


def merge_block_results(all_block_sets: List[List[Dict]], img_h: int, img_w: int) -> Dict[str, Any]:
    """
    Run parse on multiple OCR variants and merge the best results.
    Uses mathematical self-correction.
    """
    best_result = None
    best_score = -1

    for blocks in all_block_sets:
        if not blocks:
            continue
        res = parse_camel_blocks(blocks, img_h, img_w)

        attrs_found = sum(1 for a in ALL_ATTRIBUTES if res.get(a, {}).get("value"))
        score = attrs_found + (5 if res.get("validation_ok") else 0)

        if score > best_score:
            best_score = score
            best_result = res

    if best_result is None:
        return _simulated_ocr_result()

    # --- Smart Mathematical Self-Correction ---
    attr_vals = []
    for a in ALL_ATTRIBUTES:
        try:
            v = int(best_result.get(a, {}).get("value") or 0)
        except (ValueError, TypeError):
            v = 0
        attr_vals.append(v)

    if all(v > 0 for v in attr_vals):
        calc_sum = sum(attr_vals)
        calc_sp = max(attr_vals) - min(attr_vals)

        try:
            pts = int(best_result.get("points", {}).get("value") or 0)
        except (ValueError, TypeError):
            pts = 0

        if pts > 0 and pts != calc_sum and abs(pts - calc_sum) <= 10:
            diff = pts - calc_sum
            attr_confs = [(a, float(best_result.get(a, {}).get("confidence") or 0)) for a in ALL_ATTRIBUTES]
            attr_confs.sort(key=lambda x: x[1])
            for attr, conf in attr_confs:
                try:
                    old_val = int(best_result[attr]["value"])
                except Exception:
                    continue
                new_val = old_val + diff
                if 200 <= new_val <= 400:
                    best_result[attr]["value"] = str(new_val)
                    best_result[attr]["status"] = "yellow"
                    attr_vals = []
                    for a in ALL_ATTRIBUTES:
                        try:
                            v = int(best_result.get(a, {}).get("value") or 0)
                        except Exception:
                            v = 0
                        attr_vals.append(v)
                    if sum(attr_vals) == pts:
                        break

        if all(v > 0 for v in attr_vals):
            calc_sum2 = sum(attr_vals)
            calc_sp2 = max(attr_vals) - min(attr_vals)
            best_result["expected_points"] = calc_sum2
            best_result["expected_spacing"] = calc_sp2
            if "points" not in best_result or not best_result["points"].get("value"):
                best_result["points"] = {"value": str(calc_sum2), "confidence": 1.0, "status": "green"}
            if "spacing" not in best_result or not best_result["spacing"].get("value"):
                best_result["spacing"] = {"value": str(calc_sp2), "confidence": 1.0, "status": "green"}
            try:
                pts2 = int(best_result["points"]["value"])
                sp2 = int(best_result["spacing"]["value"])
                best_result["validation_ok"] = bool(pts2 == calc_sum2 and sp2 == calc_sp2)
                best_result["overall_status"] = "green" if best_result["validation_ok"] else "yellow"
            except Exception:
                pass

    return best_result


# ------------------------------------------------------------------ #
# Public API                                                           #
# ------------------------------------------------------------------ #
def extract_camel_data_from_image_sync(image_bytes: bytes) -> Dict[str, Any]:
    """Accepts raw image bytes and returns structured dictionary with confidence."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"error": "تعذّر فك ترميز الصورة"}

    if not OCR_AVAILABLE:
        return _simulated_ocr_result()

    # Get preprocessed image variants
    variants = preprocess_image(img)

    # Run OCR on variants
    all_block_sets = []
    for variant in variants:
        blocks = run_ocr(variant)
        all_block_sets.append(blocks)
        # Google Vision: نتيجة واحدة تكفي (تجنب استهلاك quota)
        if (_use_google_vision or GOOGLE_API_KEY) and blocks:
            break

    vh, vw = variants[0].shape[:2]
    result = merge_block_results(all_block_sets, vh, vw)
    result["ocr_engine"] = OCR_ENGINE
    return result


async def extract_camel_data_from_image(image_bytes: bytes) -> Dict[str, Any]:
    """Async non-blocking wrapper that runs OCR in a background thread."""
    return await asyncio.to_thread(extract_camel_data_from_image_sync, image_bytes)


def _simulated_ocr_result() -> Dict[str, Any]:
    fields = ALL_ATTRIBUTES + ["points", "spacing", "number", "name"]
    base = {f: {"value": "", "confidence": 0.0, "status": "red"} for f in fields}
    base.update({
        "overall_confidence": 0.0,
        "overall_status": "yellow",
        "validation_ok": False,
        "ocr_engine": "none",
    })
    return base

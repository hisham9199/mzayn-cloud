import re, cv2, json
import easyocr

def clean_ocr_num(text: str):
    t = text
    t = re.sub(r'[\{\}\[\]\(\)\|!lI]', '1', t)
    arabic_map = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
    t = t.translate(arabic_map)
    c = re.sub(r'[^\d]', '', t)
    return int(c) if c else None

def test_on_image(path):
    reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
    img = cv2.imread(path)
    h, w = img.shape[:2]
    scale = 2.0
    img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
    results = reader.readtext(img_up, detail=1, paragraph=False)
    
    blocks = []
    for (bbox, text, conf) in results:
        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        blocks.append({
            "text": text.strip(),
            "confidence": float(conf),
            "cx": (min(xs) + max(xs)) / 2,
            "cy": (min(ys) + max(ys)) / 2,
            "x1": min(xs), "y1": min(ys),
            "x2": max(xs), "y2": max(ys),
        })

    # Let's find 3-digit attribute numbers (100 - 600)
    attr_nums = []
    for b in blocks:
        n = clean_ocr_num(b["text"])
        if n and 100 <= n <= 600 and b["y1"] > 950 and b["y1"] < 1550:
            attr_nums.append((int(b["y1"]), int(b["x1"]), n, b["text"]))

    # Total points
    points = None
    for b in blocks:
        n = clean_ocr_num(b["text"])
        if n and 1000 <= n <= 9999:
            points = n
            break

    # Spacing
    spacing = None
    for b in blocks:
        if "تباعد" in b["text"]:
            n = clean_ocr_num(b["text"])
            if n is not None:
                spacing = n
                break

    print(f"Path: {path}")
    print(f"Points: {points}")
    print(f"Spacing: {spacing}")
    print(f"Found {len(attr_nums)} attributes:")
    for a in attr_nums:
        print(f"  y={a[0]}, x={a[1]} -> value={a[2]} (raw='{a[3]}')")

test_on_image(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787320069017.jpg')

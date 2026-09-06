import cv2, re, json
import easyocr

reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)

def test_image(path):
    img = cv2.imread(path)
    if img is None:
        print(f"Error loading {path}")
        return
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

    # Search for header name (e.g. ت5, ت13) in top 25% of image
    header_name = None
    header_conf = 0.0
    for b in blocks:
        if b["y1"] < img_up.shape[0] * 0.25:
            txt = b["text"].strip()
            # Must match pattern like ت5, ت 5, ت13, T5, etc.
            if re.search(r'[تtT#]\s*\d+', txt) or (re.match(r'^\d+$', txt) and len(txt) <= 4):
                header_name = txt.replace(' ', '')
                header_conf = b["confidence"]
                break

    print(f"File: {path}")
    print(f"  -> Extracted Name/Number: '{header_name}' (conf: {header_conf})")

test_image(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787318179855.png')
test_image(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/media__1787313555767.jpg')

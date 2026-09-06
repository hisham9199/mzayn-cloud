import cv2, json, re
import easyocr

reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
img = cv2.imread(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/media__1787313555767.jpg')
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

def normalise(t):
    t = re.sub(r'[\u064b-\u065f\u0670]', '', t)
    t = re.sub(r'[أإآا]', 'ا', t)
    t = re.sub(r'[ؤو]', 'و', t)
    t = re.sub(r'[ئي]', 'ي', t)
    return t.strip()

def extract_num(text):
    c = re.sub(r'[^\d٠-٩]', '', text)
    m = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
    c = c.translate(m)
    return int(c) if c else None

print("=== PARSING ===")
# 1. Total points (2345)
# Find block with 4-digit number around y=850..950 or near 'المواصفات'
points = None
for b in blocks:
    n = extract_num(b["text"])
    if n and 1000 <= n <= 9999:
        points = n
        break

# 2. Spacing
spacing = None
for b in blocks:
    norm = normalise(b["text"])
    if "تباعد" in norm:
        n = extract_num(b["text"])
        if n is not None:
            spacing = n
            break

# 3. Camel Number (e.g. ت 13 or 13 at top)
camel_num = None
for b in blocks:
    if b["y1"] < img_up.shape[0] * 0.25:
        m = re.search(r'[تtT]?\s*(\d+)', b["text"])
        if m:
            camel_num = m.group(1)
            break

# 4. Name / Breed (e.g. شقح)
name = None
for b in blocks:
    norm = normalise(b["text"])
    if "سلالة" in norm or "السلالة" in norm:
        # find block on same row
        for o in blocks:
            if o is not b and abs(o["cy"] - b["cy"]) < 50:
                if re.search(r'[\u0600-\u06ff]', o["text"]) and not extract_num(o["text"]):
                    name = o["text"]
                    break

# 5. Attributes: 7 attributes (nose, lips, head, eyelashes, ear, hump, neck)
# In this game UI, each attribute number is directly below or near its label or is a 3-digit number (300-400)
# Let's find all 3-digit numbers in the diagram area (y > 900 and y < 1550)
attr_nums = []
for b in blocks:
    n = extract_num(b["text"])
    if n and 100 <= n <= 600 and b["y1"] > 900 and b["y1"] < 1550:
        attr_nums.append((b["y1"], b["x1"], n, b["text"]))

print(f"Number: {camel_num}")
print(f"Name: {name}")
print(f"Points: {points}")
print(f"Spacing: {spacing}")
print(f"Found {len(attr_nums)} attribute numbers: {attr_nums}")

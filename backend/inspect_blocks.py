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

print(f"Total blocks: {len(blocks)}")
for b in blocks:
    print(f"y={b['y1']:.0f}, x={b['x1']:.0f}, conf={b['confidence']:.2f}, text={b['text']}")

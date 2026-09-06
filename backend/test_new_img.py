import cv2, re
import easyocr

reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
img = cv2.imread(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787318179855.png')
if img is None:
    print("Error loading image")
else:
    h, w = img.shape[:2]
    scale = 2.0
    img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
    results = reader.readtext(img_up, detail=1, paragraph=False)
    print(f"Total blocks: {len(results)}")
    for bbox, text, conf in sorted(results, key=lambda x: x[0][0][1]):
        ys = [p[1] for p in bbox]
        xs = [p[0] for p in bbox]
        print(f"y={min(ys):.0f}, x={min(xs):.0f}, conf={conf:.2f} -> '{text}'")

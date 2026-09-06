import easyocr, cv2, json, sys

reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
img = cv2.imread(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/media__1787313555767.jpg')
h, w = img.shape[:2]
scale = 2.0
img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
results = reader.readtext(img_up, detail=1, paragraph=False)
out = []
for bbox, text, conf in sorted(results, key=lambda x: x[0][0][1]):
    ys = [p[1] for p in bbox]
    xs = [p[0] for p in bbox]
    out.append({'t': text, 'c': round(conf,2), 'x': round(min(xs)/img_up.shape[1],2), 'y': round(min(ys)/img_up.shape[0],2)})

with open('ocr_test_result.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"Done. Found {len(out)} blocks. Written to ocr_test_result.json")

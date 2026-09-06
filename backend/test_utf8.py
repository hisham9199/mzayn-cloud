import cv2, json
import easyocr

reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
img = cv2.imread(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787318179855.png')
h, w = img.shape[:2]
scale = 2.0
img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
results = reader.readtext(img_up, detail=1, paragraph=False)

blocks = []
for (bbox, text, conf) in sorted(results, key=lambda x: x[0][0][1]):
    ys = [p[1] for p in bbox]
    xs = [p[0] for p in bbox]
    blocks.append({'y': round(min(ys)), 'x': round(min(xs)), 'text': text, 'conf': round(conf, 2)})

with open('test_blocks_utf8.json', 'w', encoding='utf-8') as f:
    json.dump(blocks, f, ensure_ascii=False, indent=2)

print("Saved test_blocks_utf8.json")

import cv2, re
import easyocr

reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)

def extract_header_name(path):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    scale = 2.0
    img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
    results = reader.readtext(img_up, detail=1, paragraph=False)

    best_name = None
    best_conf = 0.0

    for (bbox, text, conf) in results:
        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2

        # Header is in top 25% of image and right half (x > 50%)
        if cy < img_up.shape[0] * 0.25 and cx > img_up.shape[1] * 0.50 and conf > 0.3:
            txt = text.strip()
            # Match ت5 or ت13 or 5 or 13
            m = re.search(r'([تtT#]?\s*\d+)', txt)
            if m:
                clean_name = m.group(1).replace(' ', '')
                if conf > best_conf:
                    best_name = clean_name
                    best_conf = conf

    print(f"Path: {path}")
    print(f"  -> Header Name: '{best_name}' (conf: {best_conf:.2f})")

extract_header_name(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787318179855.png')
extract_header_name(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/media__1787313555767.jpg')

import asyncio, cv2, json
from services.ocr_service import extract_camel_data_from_image, run_easyocr, parse_camel_blocks

async def inspect_new_image():
    path = r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787320069017.jpg'
    with open(path, 'rb') as f:
        img_bytes = f.read()
    
    img = cv2.imread(path)
    h, w = img.shape[:2]
    scale = 2.0
    img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
    blocks = run_easyocr(img_up)
    
    print("=== RAW OCR BLOCKS ===")
    for b in blocks:
        print(f"y={b['y1']:.0f}, x={b['x1']:.0f}, conf={b['confidence']:.2f}, text='{b['text']}'")
        
    print("\n=== PARSED CAMEL DATA ===")
    res = await extract_camel_data_from_image(img_bytes)
    for k, v in res.items():
        if isinstance(v, dict):
            print(f"  {k:15s}: {v.get('value')} (conf: {v.get('confidence')}, status: {v.get('status')})")
        else:
            print(f"  {k:15s}: {v}")

asyncio.run(inspect_new_image())

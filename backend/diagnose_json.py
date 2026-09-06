import asyncio, cv2, json
from services.ocr_service import extract_camel_data_from_image, run_easyocr

async def inspect_new_image():
    path = r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787320069017.jpg'
    with open(path, 'rb') as f:
        img_bytes = f.read()
    
    img = cv2.imread(path)
    h, w = img.shape[:2]
    scale = 2.0
    img_up = cv2.resize(img, (int(w*scale), int(h*scale)))
    blocks = run_easyocr(img_up)
    
    res = await extract_camel_data_from_image(img_bytes)
    
    output = {
        "raw_blocks": blocks,
        "extracted_result": res
    }
    
    with open('diagnose_result.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

asyncio.run(inspect_new_image())

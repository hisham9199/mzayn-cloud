import asyncio, cv2, json
import numpy as np

def convert_types(obj):
    if isinstance(obj, (np.int32, np.int64, np.integer)):
        return int(obj)
    elif isinstance(obj, (np.float32, np.float64, np.floating)):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_types(i) for i in obj]
    return obj

async def inspect_new_image():
    from services.ocr_service import extract_camel_data_from_image, run_easyocr
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
        "raw_blocks": convert_types(blocks),
        "extracted_result": convert_types(res)
    }
    
    with open('diagnose_result.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

asyncio.run(inspect_new_image())

import asyncio
from services.ocr_service import extract_camel_data_from_image

async def main():
    with open(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/media__1787313555767.jpg', 'rb') as f:
        img_bytes = f.read()
    res = await extract_camel_data_from_image(img_bytes)
    print("=== EXTRACTED OCR RESULT ===")
    for k, v in res.items():
        if isinstance(v, dict):
            print(f"  {k:12s}: {v.get('value')} (conf: {v.get('confidence')}, status: {v.get('status')})")
        else:
            print(f"  {k:12s}: {v}")

asyncio.run(main())

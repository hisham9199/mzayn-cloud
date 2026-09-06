import asyncio
from services.ocr_service import extract_camel_data_from_image

async def run_test(path):
    print(f"\n======================================")
    print(f"Testing: {path}")
    print(f"======================================")
    with open(path, 'rb') as f:
        img_bytes = f.read()
    res = await extract_camel_data_from_image(img_bytes)
    for k, v in res.items():
        if isinstance(v, dict):
            print(f"  {k:15s}: {v.get('value')} (conf: {v.get('confidence')}, status: {v.get('status')})")
        else:
            print(f"  {k:15s}: {v}")

async def main():
    await run_test(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/.user_uploaded/media_1787318179855.png')
    await run_test(r'C:/Users/pc/.gemini/antigravity/brain/7f2ee6d7-f4ff-48dc-a241-7dd207ad64c0/media__1787313555767.jpg')

asyncio.run(main())

"""
storage_service.py - خدمة تخزين الصور على Cloudflare R2
متوافقة مع S3 API عبر boto3
"""

import os
import uuid
import io
from typing import Optional

# ------------------------------------------------------------------ #
# Cloudflare R2 Configuration                                          #
# ------------------------------------------------------------------ #
R2_ACCOUNT_ID    = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_KEY    = os.getenv("R2_SECRET_KEY", "")
R2_BUCKET_NAME   = os.getenv("R2_BUCKET_NAME", "mzayn")
R2_PUBLIC_URL    = os.getenv("R2_PUBLIC_URL", "")  # e.g. https://pub-xxx.r2.dev

# Local fallback directory (used if R2 not configured)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

_s3_client = None
_use_r2 = False


def _get_s3_client():
    """Initialize boto3 S3 client for Cloudflare R2 (lazy init)."""
    global _s3_client, _use_r2

    if _s3_client is not None:
        return _s3_client

    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY]):
        return None

    try:
        import boto3
        from botocore.config import Config

        endpoint_url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

        _s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
            region_name="auto",
        )
        _use_r2 = True
        print("✅ Cloudflare R2 storage initialized")
        return _s3_client
    except Exception as e:
        print(f"⚠️  R2 not available, using local storage: {e}")
        return None


def upload_image(image_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """
    رفع صورة للتخزين.
    يستخدم Cloudflare R2 إذا كان مُعدًّا، وإلا يحفظ محلياً.
    يُعيد URL كامل للصورة.
    """
    client = _get_s3_client()

    if client and _use_r2:
        return _upload_to_r2(client, image_bytes, filename, content_type)
    else:
        return _save_locally(image_bytes, filename)


def _upload_to_r2(client, image_bytes: bytes, filename: str, content_type: str) -> str:
    """رفع الصورة لـ Cloudflare R2 وإرجاع URL عام."""
    try:
        # Generate unique key
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        unique_key = f"camels/{uuid.uuid4().hex}.{ext}"

        client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=unique_key,
            Body=image_bytes,
            ContentType=content_type,
        )

        # Return public URL
        if R2_PUBLIC_URL:
            return f"{R2_PUBLIC_URL.rstrip('/')}/{unique_key}"
        else:
            # Private URL format
            return f"r2://{R2_BUCKET_NAME}/{unique_key}"

    except Exception as e:
        print(f"R2 upload error: {e}, falling back to local storage")
        return _save_locally(image_bytes, filename)


def _save_locally(image_bytes: bytes, filename: str) -> str:
    """حفظ الصورة محلياً (fallback)."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(UPLOAD_DIR, unique_name)
    with open(path, "wb") as f:
        f.write(image_bytes)
    return f"/uploads/{unique_name}"


def delete_image(image_url: str) -> bool:
    """حذف صورة من R2 أو من القرص المحلي."""
    client = _get_s3_client()

    if client and _use_r2 and not image_url.startswith("/uploads/"):
        try:
            # Extract key from URL
            if R2_PUBLIC_URL and image_url.startswith(R2_PUBLIC_URL):
                key = image_url[len(R2_PUBLIC_URL):].lstrip("/")
            elif image_url.startswith("r2://"):
                key = image_url.split("/", 2)[-1]
            else:
                return False

            client.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
            return True
        except Exception as e:
            print(f"R2 delete error: {e}")
            return False
    elif image_url.startswith("/uploads/"):
        # Local file
        local_path = os.path.join(UPLOAD_DIR, image_url.replace("/uploads/", ""))
        if os.path.exists(local_path):
            os.remove(local_path)
            return True
    return False


def get_storage_info() -> dict:
    """معلومات عن خدمة التخزين المستخدمة حالياً."""
    client = _get_s3_client()
    if client and _use_r2:
        return {
            "type": "cloudflare_r2",
            "bucket": R2_BUCKET_NAME,
            "public_url": R2_PUBLIC_URL or "private",
        }
    return {
        "type": "local",
        "directory": UPLOAD_DIR,
    }

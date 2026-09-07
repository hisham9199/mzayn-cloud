"""
Celery OCR Worker — معالجة صور البطاقات بشكل متوازي
كل Worker عملية مستقلة = 4 صور في نفس الوقت على 4 cores
"""
import os
import sys

# Add parent directory so we can import services
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from celery import Celery
from celery.signals import worker_process_init
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

BROKER = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

celery_app = Celery('mzayn_ocr', broker=BROKER, backend=BACKEND)

celery_app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    result_expires=3600,           # نتائج محفوظة ساعة كاملة
    task_track_started=True,
    worker_prefetch_multiplier=1,  # لا تأخذ مهام أكثر من طاقتك
    task_acks_late=True,           # تأكيد بعد الإنجاز (لا تخسر مهام عند الخطأ)
    task_reject_on_worker_lost=True,
)


@worker_process_init.connect
def preload_easyocr(**kwargs):
    """
    تحميل نموذج EasyOCR مرة واحدة عند بدء كل Worker Process.
    هذا يمنع إعادة تحميل النموذج (600MB) مع كل صورة.
    """
    global _ocr_reader
    logger.info("🔄 تحميل نموذج EasyOCR...")
    try:
        import easyocr
        _ocr_reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
        logger.info("✅ EasyOCR جاهز للعمل")
    except Exception as e:
        logger.error(f"❌ فشل تحميل EasyOCR: {e}")
        _ocr_reader = None


@celery_app.task(
    bind=True,
    name='process_ocr_image',
    queue='ocr',
    max_retries=2,
    soft_time_limit=60,   # تحذير بعد 60 ثانية
    time_limit=90,         # قتل المهمة بعد 90 ثانية
)
def process_ocr_image(self, image_path: str, filename: str = ''):
    """
    معالجة صورة بطاقة ناقة واحدة وإرجاع البيانات المستخرجة.
    
    Args:
        image_path: مسار الملف المؤقت على القرص
        filename: اسم الملف الأصلي للمستخدم
    """
    try:
        logger.info(f"📷 معالجة: {filename}")
        
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        from services.ocr_service import extract_camel_data_from_image_sync
        result = extract_camel_data_from_image_sync(image_bytes)
        result['filename'] = filename
        
        logger.info(f"✅ انتهت: {filename} — {result.get('overall_status', '?')}")
        return result

    except FileNotFoundError:
        logger.error(f"❌ الملف غير موجود: {image_path}")
        return {'filename': filename, 'error': 'الملف غير موجود', 'overall_status': 'red'}

    except Exception as exc:
        logger.error(f"❌ خطأ في {filename}: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=3)
        return {'filename': filename, 'error': str(exc), 'overall_status': 'red'}

    finally:
        # حذف الملف المؤقت بعد المعالجة
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
        except Exception:
            pass

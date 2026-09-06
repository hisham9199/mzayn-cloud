@echo off
chcp 65001 > nul
echo ========================================================
echo        تثبيت متطلبات نظام مزاين (Setup Script)
echo ========================================================
echo.

echo [1/2] تثبيت حزم الخادم الخلفي (Python Backend)...
cd /d %~dp0backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [تحذير] تعذر تثبيت بعض حزم Python. تأكد من تثبيت Python وإضافته للـ PATH.
) else (
    echo [نجاح] تم تثبيت حزم Backend بنجاح.
)

echo.
echo [2/2] تثبيت حزم الواجهة الأمامية (Node.js Frontend)...
cd /d %~dp0frontend
call npm install
if %errorlevel% neq 0 (
    echo [تحذير] تعذر تثبيت حزم npm. تأكد من تثبيت Node.js.
) else (
    echo [نجاح] تم تثبيت حزم Frontend بنجاح.
)

echo.
echo ========================================================
echo   اكتمل التثبيت! يمكنك الآن تشغيل النظام عبر ملف start.bat
echo ========================================================
cd /d %~dp0
pause

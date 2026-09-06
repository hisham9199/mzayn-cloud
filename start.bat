@echo off
chcp 65001 > nul
echo ==========================================
echo       جاري تشغيل نظام مزاين...
echo ==========================================

echo [1/3] تشغيل الخادم الخلفي (Backend)...
start "Mzayn Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

echo [2/3] تشغيل الواجهة الأمامية (Frontend)...
start "Mzayn Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/3] تشغيل بوت ديسكورد (Discord Bot)...
start "Mzayn Discord Bot" cmd /k "cd /d %~dp0backend && python bot.py"

timeout /t 3 > nul
echo.
echo ==========================================
echo   تم تشغيل النظام والبوت بنجاح!
echo   الرابط: http://localhost:5173
echo ==========================================
start http://localhost:5173
pause

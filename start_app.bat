@echo off
title نظام مزاين - تشغيل النظام
chcp 65001 > nul
echo ==============================================
echo        🐪 جاري تشغيل نظام مزاين...
echo ==============================================

set "PATH=C:\Users\pc\AppData\Local\Programs\Python\Python311;C:\Users\pc\AppData\Local\Programs\Python\Python311\Scripts;%PATH%"

cd /d "%~dp0backend"
start "Mzayn Backend" cmd /k "set PATH=C:\Users\pc\AppData\Local\Programs\Python\Python311;C:\Users\pc\AppData\Local\Programs\Python\Python311\Scripts;%%PATH%% && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

cd /d "%~dp0frontend"
start "Mzayn Frontend" cmd /k "npm run dev"

timeout /t 3 > nul
start http://localhost:5173

echo ==============================================
echo        ✅ تم تشغيل النظام بنجاح!
echo ==============================================

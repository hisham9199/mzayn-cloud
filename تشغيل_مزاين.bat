@echo off
chcp 65001 >nul
title 🐪 نظام مزاين

:: Find Python - check common install paths
set PYTHON_EXE=python
set PYTHON_FOUND=0

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_EXE=python
    set PYTHON_FOUND=1
)

if "%PYTHON_FOUND%"=="0" (
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" (
        set "PYTHON_EXE=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe"
        set "PATH=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311;C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\Scripts;%PATH%"
        set PYTHON_FOUND=1
    )
)

if "%PYTHON_FOUND%"=="0" (
    echo ❌ Python غير موجود. يرجى تشغيل INSTALL.bat أولاً
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo       🐪  جاري تشغيل نظام مزاين...
echo  ============================================================
echo.

:: Start Backend
echo  🔵 تشغيل الخادم الخلفي (Backend)...
cd /d "%~dp0backend"
start "Mzayn - Backend" cmd /k "%PYTHON_EXE% -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Wait 3 seconds for backend to start
timeout /t 3 >nul

:: Start Frontend
echo  🟢 تشغيل الواجهة (Frontend)...
cd /d "%~dp0frontend"
start "Mzayn - Frontend" cmd /k "npm run dev"

:: Wait 4 seconds then open browser
timeout /t 4 >nul
start http://localhost:5173

echo.
echo  ============================================================
echo   ✅ تم تشغيل نظام مزاين!
echo   🌐 الرابط: http://localhost:5173
echo   📡 API:    http://localhost:8000
echo  ============================================================
echo.
echo  ⚠️  لا تغلق نوافذ CMD - يؤدي إغلاقها إلى إيقاف البرنامج
echo.

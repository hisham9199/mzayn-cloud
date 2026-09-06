@echo off
chcp 65001 >nul
title مزاين - تثبيت النظام
color 0A

echo.
echo  ============================================================
echo       🐪  تثبيت نظام مزاين لإدارة النياق
echo  ============================================================
echo.

:: =============================================
:: Step 1: Check Python
:: =============================================
echo [1/5] 🔍 فحص Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Python غير موجود! يرجى تثبيت Python 3.11 أولاً:
    echo     https://www.python.org/downloads/release/python-3119/
    echo.
    echo  ⚠️  تأكد من تفعيل خيار "Add Python to PATH" أثناء التثبيت
    echo.
    pause
    exit /b 1
)
python --version
echo  ✅ Python موجود

:: =============================================
:: Step 2: Check Node.js
:: =============================================
echo.
echo [2/5] 🔍 فحص Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Node.js غير موجود! يرجى تثبيت Node.js أولاً:
    echo     https://nodejs.org/en/download (اختر LTS)
    echo.
    pause
    exit /b 1
)
node --version
echo  ✅ Node.js موجود

:: =============================================
:: Step 3: Install Python packages
:: =============================================
echo.
echo [3/5] 📦 تثبيت مكتبات Python (قد يستغرق 5-10 دقائق)...
echo       يرجى الانتظار...
echo.
cd /d "%~dp0backend"
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo  ❌ فشل تثبيت مكتبات Python
    pause
    exit /b 1
)
echo.
echo  ✅ تم تثبيت مكتبات Python

:: =============================================
:: Step 4: Install Node packages
:: =============================================
echo.
echo [4/5] 📦 تثبيت مكتبات Node.js...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
    echo  ❌ فشل تثبيت مكتبات Node.js
    pause
    exit /b 1
)
echo  ✅ تم تثبيت مكتبات Node.js

:: =============================================
:: Step 5: Done
:: =============================================
echo.
echo  ============================================================
echo   🎉 اكتمل التثبيت بنجاح!
echo  ============================================================
echo.
echo   لتشغيل البرنامج: انقر نقراً مزدوجاً على ملف  تشغيل_مزاين.bat
echo.
pause

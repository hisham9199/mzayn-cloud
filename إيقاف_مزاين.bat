@echo off
chcp 65001 >nul
title إيقاف نظام مزاين

echo  🔴 جاري إيقاف نظام مزاين...
taskkill /f /fi "WINDOWTITLE eq Mzayn - Backend" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Mzayn - Frontend" >nul 2>&1
taskkill /f /im "uvicorn.exe" >nul 2>&1
:: Kill any process using port 8000 or 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1
echo  ✅ تم إيقاف النظام
timeout /t 2 >nul

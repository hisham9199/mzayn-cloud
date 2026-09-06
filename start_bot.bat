@echo off
chcp 65001 > nul
echo ==========================================
echo       جاري تشغيل بوت ديسكورد - مزاين
echo ==========================================

cd /d %~dp0backend
python bot.py

pause

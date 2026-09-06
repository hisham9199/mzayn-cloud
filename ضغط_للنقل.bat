@echo off
chcp 65001 >nul
title ضغط نظام مزاين للنقل

echo.
echo  ============================================================
echo       🗜️  جاري إنشاء ملف مضغوط لنقل نظام مزاين
echo  ============================================================
echo.

set "SOURCE=%~dp0"
set "OUTPUT=%USERPROFILE%\Desktop\مزاين_للنقل.zip"

echo  📁 المصدر: %SOURCE%
echo  💾 الوجهة: %OUTPUT%
echo.
echo  🔄 جاري الضغط (قد يستغرق دقيقة)...

:: Use PowerShell to create ZIP (excluding node_modules, __pycache__, .git, uploads, db)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$src = '%SOURCE%'.TrimEnd('\'); $dst = '%OUTPUT%'; " ^
    "if (Test-Path $dst) { Remove-Item $dst -Force }; " ^
    "$exclude = @('node_modules','.git','__pycache__','uploads','*.pyc','*.log','easyocr_models','*.zip'); " ^
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; " ^
    "$compression = [System.IO.Compression.CompressionLevel]::Optimal; " ^
    "$zip = [System.IO.Compression.ZipFile]::Open($dst, 'Create'); " ^
    "Get-ChildItem -Path $src -Recurse -File | Where-Object { " ^
    "  $rel = $_.FullName.Substring($src.Length + 1); " ^
    "  $skip = $false; " ^
    "  foreach ($ex in $exclude) { if ($rel -like \"*$ex*\") { $skip = $true; break } }; " ^
    "  -not $skip " ^
    "} | ForEach-Object { " ^
    "  $rel = $_.FullName.Substring($src.Length + 1); " ^
    "  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, $compression) | Out-Null " ^
    "}; " ^
    "$zip.Dispose(); " ^
    "Write-Host '✅ تم الضغط بنجاح' -ForegroundColor Green"

if exist "%OUTPUT%" (
    echo.
    echo  ✅ تم إنشاء الملف المضغوط بنجاح!
    echo  📂 الملف: %OUTPUT%
    echo.
    :: Open Desktop folder
    explorer "%USERPROFILE%\Desktop"
) else (
    echo.
    echo  ❌ حدث خطأ في الضغط
)

echo.
pause

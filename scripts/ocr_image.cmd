@echo off
setlocal
where node >nul 2>&1 || (echo [xxx] node not in PATH & exit /b 9009)
node "%~dp0scripts\\ocr_image.js" %*
exit /b %ERRORLEVEL%

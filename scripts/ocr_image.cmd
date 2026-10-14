@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ocr_image.ps1" %*

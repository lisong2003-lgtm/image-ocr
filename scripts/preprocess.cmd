@echo off
rem preprocess 跨平台 CLI 入口（Windows；macOS/Linux 用 scripts/preprocess.sh）。
setlocal
set "PY_SCRIPT=%~dp0preprocess.py"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%PY_SCRIPT%" %*
  exit /b %errorlevel%
)
where python >nul 2>nul
if %errorlevel%==0 (
  python "%PY_SCRIPT%" %*
  exit /b %errorlevel%
)
echo [preprocess] 未找到 Python 3（py/python）；请安装 Python 并加入 PATH 1>&2
exit /b 127

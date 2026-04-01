@echo off
title Gitub Analysis for You Server
cd /d C:\githubProject
echo Starting Gitub Analysis for You...
if exist C:\Python\python.exe (
  C:\Python\python.exe -u server.py
) else (
  python -u server.py
)
if errorlevel 1 (
  echo.
  echo Server failed to start.
  echo Please keep this window open and send me the error message shown above.
  pause
)

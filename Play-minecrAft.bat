@echo off
title minecrAft - Adyah's Adventure
cd /d "%~dp0"

echo ==============================================
echo    minecrAft - Adyah's Adventure
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install LTS from https://nodejs.org then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First-time setup: installing the game engine ^(can take a few minutes^)...
  echo.
  call npm install
  if errorlevel 1 ( echo Install failed. Check your internet and try again. & pause & exit /b 1 )
  echo.
)

echo Launching the game for Adyah...
call npm start

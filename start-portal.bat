@echo off
cd /d "%~dp0backend"
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo Installing Node.js packages...
  call npm install
)
echo Starting Ndia TVC Communication Portal...
call npm start
pause

@echo off
setlocal

cd /d "%~dp0"

echo [smag] Starting project in %CD%

where npm >nul 2>&1
if errorlevel 1 (
  echo [smag] ERROR: npm is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist node_modules (
  goto install_deps
)

if not exist node_modules\.bin\nodemon.cmd (
  goto install_deps
)

if not exist node_modules\.bin\ts-node.cmd (
  goto install_deps
)

goto run_dev

:install_deps
  echo [smag] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [smag] ERROR: npm install failed.
    pause
    exit /b 1
  )
)

:run_dev
echo [smag] Running development server...
call npm run dev

if errorlevel 1 (
  echo [smag] ERROR: dev server exited with an error.
  pause
  exit /b 1
)

endlocal

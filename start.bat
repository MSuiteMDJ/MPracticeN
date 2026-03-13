@echo off
REM M Practice Manager - Startup Script (Windows)
REM Starts both backend and frontend servers

echo ================================================================
echo.
echo          M Practice Manager - Starting Application
echo.
echo ================================================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing frontend dependencies...
    call npm install
)

if not exist "backend\node_modules\" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

echo.
echo Starting servers...
echo.

REM Start backend
echo Starting backend on http://localhost:3003...
start "SPV Backend" cmd /k "cd backend && npm run dev"

REM Wait a moment
timeout /t 3 /nobreak > nul

REM Start frontend
echo Starting frontend on http://localhost:3002...
start "SPV Frontend" cmd /k "npm run dev"

echo.
echo ================================================================
echo.
echo                    Servers Running!
echo.
echo ================================================================
echo.
echo Backend:  http://localhost:3003
echo Frontend: http://localhost:3002
echo.
echo Close the terminal windows to stop the servers
echo.

pause

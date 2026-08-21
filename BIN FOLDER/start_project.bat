@echo off
echo ==========================================
echo Starting LifeOS Healthcare AI Services...
echo ==========================================

:: Get the parent directory of the BIN FOLDER (which is the project root)
set "PROJECT_DIR=%~dp0.."

echo Starting Frontend...
start "Frontend" cmd /k "cd /d "%PROJECT_DIR%\frontend-react" && npm install && npm run dev"

echo Starting Backend...
start "Backend" cmd /k "cd /d "%PROJECT_DIR%" && python -m venv venv && call venv\Scripts\activate.bat && python -m pip install -r requirements.txt && cd backend && python -m uvicorn app.main:app --reload --port 8000"

echo Starting Chatbot...
start "Chatbot" cmd /k "cd /d "%PROJECT_DIR%" && call venv\Scripts\activate.bat && cd backend\chatbot && python -m pip install -r requirements.txt && python app.py"

echo All services are starting up in separate terminal windows.
pause

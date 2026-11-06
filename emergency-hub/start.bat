@echo off
rem Start the Emergency Hub. Open http://127.0.0.1:8080 afterwards.
cd /d "%~dp0"
where py >nul 2>nul && (py hub.py %*) || (python hub.py %*)
pause

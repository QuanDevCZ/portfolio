@echo off
rem Double-click to run the portfolio locally at http://localhost:4321 (opens in Chrome)
rem Close this window to stop the server.
cd /d "%~dp0"
rem Open Chrome after 3 s so the server is ready; falls back to the default browser if Chrome is missing.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & (start "" chrome "http://localhost:4321" || start "" "http://localhost:4321")"
npx -y serve -l 4321 .

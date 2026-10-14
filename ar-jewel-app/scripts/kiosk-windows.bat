@echo off
rem Booth kiosk launcher. Put a shortcut to this file in shell:startup so it runs at boot (FR-16).
rem 1) start the app server (built app: run `npm run build` once first)
cd /d "%~dp0.."
set ADMIN_TOKEN=CHANGE_ME
set PUBLIC_BASE_URL=http://BOOTH-PC-LAN-IP:8787
start "" /min cmd /c "node server\server.mjs"
timeout /t 4 >nul
rem 2) Chrome full-screen kiosk. The camera permission prompt is skipped only for this local app.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-infobars --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\booth-profile" http://localhost:8787/booth.html

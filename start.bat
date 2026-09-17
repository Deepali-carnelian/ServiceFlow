@echo off
setlocal
cd /d "%~dp0"
if exist "data\active-port.txt" del /q "data\active-port.txt" >nul 2>&1
start "ServiceFlow Server" cmd /k "node server.js"
for /L %%i in (1,1,20) do (
  if exist "data\active-port.txt" goto :open
  timeout /t 1 /nobreak >nul
)
echo ServiceFlow server did not report a port. Check the server window for errors.
pause
exit /b 1
:open
set /p SFPORT=<"data\active-port.txt"
start "" "http://localhost:%SFPORT%"
endlocal

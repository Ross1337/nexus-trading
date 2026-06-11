@echo off
cd /d "C:\Users\ross server tiny11\nexus-trading\frontend"
set NEXT_PUBLIC_API_URL=http://192.168.1.33:8001
set NEXT_PUBLIC_WS_URL=ws://192.168.1.33:8001
echo === BUILD START ===
call npm.cmd run build
echo === BUILD EXIT CODE: %ERRORLEVEL% ===

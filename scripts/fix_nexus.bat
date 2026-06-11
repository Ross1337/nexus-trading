@echo off
set NSSM=C:\ProgramData\chocolatey\bin\nssm.exe
set ROOT=C:\Users\ross server tiny11\nexus-trading
set VENVPY=%ROOT%\.venv\Scripts\python.exe

echo === Stop services ===
"%NSSM%" stop Nexus-API confirm
"%NSSM%" stop Nexus-Frontend confirm
"%NSSM%" stop Nexus-MT5 confirm
"%NSSM%" stop Nexus-Watchdog confirm

echo === Set AppParameters (API) ===
"%NSSM%" set Nexus-API AppParameters "-m uvicorn api.main:app --host 0.0.0.0 --port 8001"
"%NSSM%" set Nexus-API AppExit Default Restart
"%NSSM%" set Nexus-API AppStdin ""

echo === Set AppParameters (MT5) ===
"%NSSM%" set Nexus-MT5 AppParameters "-m mt5_connector.main"

echo === Set AppParameters (Frontend) ===
"%NSSM%" set Nexus-Frontend AppParameters "start"

echo === Verify ===
echo --- API params:
"%NSSM%" get Nexus-API AppParameters
echo --- MT5 params:
"%NSSM%" get Nexus-MT5 AppParameters
echo --- Frontend params:
"%NSSM%" get Nexus-Frontend AppParameters

echo === Start API ===
"%NSSM%" start Nexus-API

@echo off
set NSSM=C:\ProgramData\chocolatey\bin\nssm.exe
echo === Stop Nexus-MT5 ===
"%NSSM%" stop Nexus-MT5 confirm
echo === Set service account to user (interactive IPC) ===
"%NSSM%" set Nexus-MT5 ObjectName ".\ross server tiny11" "Azerty123"
"%NSSM%" set Nexus-MT5 Type SERVICE_INTERACTIVE_PROCESS
echo === Verify ObjectName ===
"%NSSM%" get Nexus-MT5 ObjectName
echo === Start ===
"%NSSM%" start Nexus-MT5
echo === EXIT %ERRORLEVEL% ===

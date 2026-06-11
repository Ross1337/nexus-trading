# NEXUS V2 - Deploiement corrige (venv python + NSSM)
$ErrorActionPreference = "Continue"
$Root = "C:\Users\ross server tiny11\nexus-trading"
$VenvPy = "$Root\.venv\Scripts\python.exe"
$nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"
$logsDir = "$Root\logs"
New-Item -ItemType Directory -Force $logsDir | Out-Null

# npm.cmd path
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = (Get-Command npm).Source }
$psPath = (Get-Command powershell).Source

Write-Host "VenvPy: $VenvPy"
Write-Host "npm: $npmCmd"

function Install-Svc {
    param($Name, $Exe, $Args, $WorkDir, $DependsOn = $null)
    Write-Host "-> $Name"
    & $nssm stop $Name confirm 2>$null | Out-Null
    & $nssm remove $Name confirm 2>$null | Out-Null
    & $nssm install $Name $Exe | Out-Null
    & $nssm set $Name AppParameters $Args | Out-Null
    & $nssm set $Name AppDirectory $WorkDir | Out-Null
    & $nssm set $Name AppStdout "$logsDir\$Name.log" | Out-Null
    & $nssm set $Name AppStderr "$logsDir\$Name.err.log" | Out-Null
    & $nssm set $Name AppRotateFiles 1 | Out-Null
    & $nssm set $Name AppRotateBytes 10485760 | Out-Null
    & $nssm set $Name Start SERVICE_AUTO_START | Out-Null
    & $nssm set $Name ObjectName LocalSystem | Out-Null
    & $nssm set $Name AppRestartDelay 5000 | Out-Null
    & $nssm set $Name AppEnvironmentExtra "PYTHONIOENCODING=utf-8" | Out-Null
    if ($DependsOn) { & $nssm set $Name DependOnService $DependsOn | Out-Null }
}

# 1. API (venv python)
Install-Svc -Name "Nexus-API" -Exe $VenvPy -Args "-m uvicorn api.main:app --host 0.0.0.0 --port 8001" -WorkDir $Root

# 2. MT5 connector (venv python)
Install-Svc -Name "Nexus-MT5" -Exe $VenvPy -Args "-m mt5_connector.main" -WorkDir $Root -DependsOn "Nexus-API"

# 3. Frontend
Install-Svc -Name "Nexus-Frontend" -Exe $npmCmd -Args "start" -WorkDir "$Root\frontend" -DependsOn "Nexus-API"

# 4. Watchdog
Install-Svc -Name "Nexus-Watchdog" -Exe $psPath -Args "-NonInteractive -ExecutionPolicy Bypass -File `"$Root\scripts\watchdog.ps1`"" -WorkDir $Root

# NOTE: Nexus-Telegram NON installe (TELEGRAM_BOT_TOKEN vide dans .env)

Write-Host "=== Demarrage API + Frontend ==="
Start-Service Nexus-API
Start-Sleep -Seconds 8
Start-Service Nexus-Frontend
Start-Sleep -Seconds 10

Write-Host "=== STATUT ==="
Get-Service Nexus-* | Select-Object Name, Status | Format-Table -AutoSize

Write-Host "=== HEALTH API ==="
try { (Invoke-RestMethod "http://localhost:8001/api/health" -TimeoutSec 5) | ConvertTo-Json -Compress } catch { Write-Host "API KO: $($_.Exception.Message)" }

Write-Host "=== PORTS ==="
netstat -ano | findstr ":3001 :8001"

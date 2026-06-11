# NEXUS Trading Bot V2 - Install Windows Services via NSSM
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== Installation services NSSM NEXUS V2 ===" -ForegroundColor Cyan

# Find NSSM
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssm) {
    $nssmPath = "C:\nssm\nssm.exe"
    if (-not (Test-Path $nssmPath)) {
        Write-Host "NSSM non trouvé. Téléchargement..." -ForegroundColor Yellow
        $nssmZip = "$env:TEMP\nssm.zip"
        Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
        Expand-Archive $nssmZip -DestinationPath "$env:TEMP\nssm_extracted"
        New-Item -ItemType Directory -Force "C:\nssm" | Out-Null
        Copy-Item "$env:TEMP\nssm_extracted\nssm-2.24\win64\nssm.exe" "C:\nssm\nssm.exe"
    }
    $nssm = "C:\nssm\nssm.exe"
} else {
    $nssm = $nssm.Source
}

Write-Host "NSSM: $nssm" -ForegroundColor Gray

$pythonPath = (Get-Command python).Source
$npmPath = (Get-Command npm).Source
$envFile = "$ProjectRoot\.env"
$logsDir = "$ProjectRoot\logs"
New-Item -ItemType Directory -Force $logsDir | Out-Null

function Install-NexusService {
    param($Name, $Executable, $Args, $WorkDir, $DependsOn = $null)

    Write-Host "▶ Service: $Name" -ForegroundColor Cyan

    # Stop and remove if exists
    $existing = & $nssm status $Name 2>$null
    if ($LASTEXITCODE -eq 0) {
        & $nssm stop $Name confirm 2>$null
        & $nssm remove $Name confirm
    }

    & $nssm install $Name $Executable
    & $nssm set $Name AppParameters $Args
    & $nssm set $Name AppDirectory $WorkDir
    & $nssm set $Name AppStdout "$logsDir\$Name.log"
    & $nssm set $Name AppStderr "$logsDir\$Name.err.log"
    & $nssm set $Name AppRotateFiles 1
    & $nssm set $Name AppRotateBytes 10485760  # 10MB
    & $nssm set $Name Start SERVICE_AUTO_START
    & $nssm set $Name ObjectName LocalSystem
    & $nssm set $Name AppRestartDelay 5000  # 5s restart delay

    if ($DependsOn) {
        & $nssm set $Name DependOnService $DependsOn
    }

    Write-Host "  ✅ Installé" -ForegroundColor Green
}

# 1. Nexus-API
Install-NexusService `
    -Name "Nexus-API" `
    -Executable $pythonPath `
    -Args "-m uvicorn api.main:app --host 0.0.0.0 --port 8001" `
    -WorkDir $ProjectRoot

# 2. Nexus-MT5
Install-NexusService `
    -Name "Nexus-MT5" `
    -Executable $pythonPath `
    -Args "-m mt5_connector.main" `
    -WorkDir $ProjectRoot `
    -DependsOn "Nexus-API"

& $nssm set "Nexus-MT5" AppRestartDelay 5000

# 3. Nexus-Frontend
$frontendDir = "$ProjectRoot\frontend"
Install-NexusService `
    -Name "Nexus-Frontend" `
    -Executable $npmPath `
    -Args "start" `
    -WorkDir $frontendDir `
    -DependsOn "Nexus-API"

# 4. Nexus-Telegram
Install-NexusService `
    -Name "Nexus-Telegram" `
    -Executable $pythonPath `
    -Args "-m telegram_bot.main" `
    -WorkDir $ProjectRoot `
    -DependsOn "Nexus-API"

# 5. Nexus-Watchdog
$psPath = (Get-Command powershell).Source
Install-NexusService `
    -Name "Nexus-Watchdog" `
    -Executable $psPath `
    -Args "-NonInteractive -File `"$ProjectRoot\scripts\watchdog.ps1`"" `
    -WorkDir $ProjectRoot

Write-Host ""
Write-Host "=== Services installés ===" -ForegroundColor Green
Write-Host "Démarrez avec: Start-Service Nexus-API, Nexus-MT5, Nexus-Frontend, Nexus-Telegram, Nexus-Watchdog"
Write-Host "Ou: powershell -File scripts\start-all.ps1"

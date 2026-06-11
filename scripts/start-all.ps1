# NEXUS Trading Bot V2 - Start All Services
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== NEXUS Trading Bot V2 - Démarrage ===" -ForegroundColor Cyan

# Check ports
$ports = @(8001, 3001, 5002)
foreach ($port in $ports) {
    $inUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($inUse) {
        Write-Host "⚠️  Port $port déjà utilisé - vérifiez les doublons" -ForegroundColor Yellow
    }
}

# Create logs directory
New-Item -ItemType Directory -Force -Path "$ProjectRoot\logs" | Out-Null

# Check PostgreSQL
Write-Host "▶ Vérification PostgreSQL..." -ForegroundColor Cyan
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "  ✅ PostgreSQL running" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  PostgreSQL non détecté - assurez-vous qu'il tourne" -ForegroundColor Yellow
}

# Check Redis
Write-Host "▶ Vérification Redis..." -ForegroundColor Cyan
$redisCheck = Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet -ErrorAction SilentlyContinue
if ($redisCheck) {
    Write-Host "  ✅ Redis accessible" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Redis non accessible sur port 6379" -ForegroundColor Yellow
}

# Start API
Write-Host "▶ Démarrage API FastAPI (port 8001)..." -ForegroundColor Cyan
$apiLog = "$ProjectRoot\logs\api.log"
$apiJob = Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn api.main:app --host 0.0.0.0 --port 8001 --log-level info" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $apiLog `
    -RedirectStandardError "$ProjectRoot\logs\api.err.log" `
    -PassThru
$apiJob.Id | Out-File "$ProjectRoot\logs\api.pid"
Write-Host "  PID: $($apiJob.Id)" -ForegroundColor Gray
Start-Sleep -Seconds 3

# Check API health
$apiOk = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8001/api/health" -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { $apiOk = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if ($apiOk) { Write-Host "  ✅ API démarrée" -ForegroundColor Green }
else { Write-Host "  ❌ API ne répond pas" -ForegroundColor Red }

# Start MT5 Connector
Write-Host "▶ Démarrage MT5 Connector (port 5002)..." -ForegroundColor Cyan
$mt5Job = Start-Process -FilePath "python" `
    -ArgumentList "-m mt5_connector.main" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput "$ProjectRoot\logs\mt5_connector.log" `
    -RedirectStandardError "$ProjectRoot\logs\mt5.err.log" `
    -PassThru
$mt5Job.Id | Out-File "$ProjectRoot\logs\mt5.pid"
Write-Host "  PID: $($mt5Job.Id)" -ForegroundColor Gray

# Start Frontend
Write-Host "▶ Démarrage Frontend Next.js (port 3001)..." -ForegroundColor Cyan
$frontJob = Start-Process -FilePath "npm" `
    -ArgumentList "start" `
    -WorkingDirectory "$ProjectRoot\frontend" `
    -WindowStyle Hidden `
    -RedirectStandardOutput "$ProjectRoot\logs\frontend.log" `
    -RedirectStandardError "$ProjectRoot\logs\frontend.err.log" `
    -PassThru
$frontJob.Id | Out-File "$ProjectRoot\logs\frontend.pid"
Write-Host "  PID: $($frontJob.Id)" -ForegroundColor Gray

# Start Telegram Bot (if configured)
$envContent = Get-Content "$ProjectRoot\.env" -ErrorAction SilentlyContinue
$telegramToken = ($envContent | Where-Object { $_ -match "^TELEGRAM_BOT_TOKEN=(.+)$" }) -replace "TELEGRAM_BOT_TOKEN=", ""
if ($telegramToken -and $telegramToken.Length -gt 5) {
    Write-Host "▶ Démarrage Telegram Bot..." -ForegroundColor Cyan
    $tgJob = Start-Process -FilePath "python" `
        -ArgumentList "-m telegram_bot.main" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$ProjectRoot\logs\telegram_bot.log" `
        -RedirectStandardError "$ProjectRoot\logs\telegram.err.log" `
        -PassThru
    $tgJob.Id | Out-File "$ProjectRoot\logs\telegram.pid"
    Write-Host "  PID: $($tgJob.Id)" -ForegroundColor Gray
} else {
    Write-Host "  ⚠️  Telegram Bot non configuré (TELEGRAM_BOT_TOKEN manquant)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Services démarrés ===" -ForegroundColor Green
Write-Host "  Dashboard:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "  API:        http://localhost:8001" -ForegroundColor Cyan
Write-Host "  API Docs:   http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host "  MT5 Health: http://localhost:5002/health" -ForegroundColor Cyan

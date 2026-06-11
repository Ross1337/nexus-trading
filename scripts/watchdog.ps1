# NEXUS Watchdog - runs every 60 seconds
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Send-TelegramAlert {
    param($Message)
    try {
        $envContent = Get-Content "$ProjectRoot\.env" -ErrorAction Stop
        $token = ($envContent | Where-Object { $_ -match "^TELEGRAM_BOT_TOKEN=(.+)$" }) -replace "TELEGRAM_BOT_TOKEN=", ""
        $chatId = ($envContent | Where-Object { $_ -match "^TELEGRAM_CHAT_ID=(.+)$" }) -replace "TELEGRAM_CHAT_ID=", ""
        if (-not $token -or $token.Length -lt 5) { return }
        $body = @{ chat_id = $chatId; text = $Message; parse_mode = "HTML" } | ConvertTo-Json
        Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/sendMessage" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5
    } catch {}
}

$failCount = 0
$lastRestart = 0
$COOLDOWN = 180  # 3 minutes

Write-Host "[Watchdog] Started - NEXUS V2 watchdog running"

while ($true) {
    $now = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

    # Step 1: Check terminal64.exe
    $termRunning = $false
    Get-Process -Name "terminal64" -ErrorAction SilentlyContinue | ForEach-Object { $termRunning = $true }

    if (-not $termRunning) {
        Write-Host "[Watchdog] MT5 terminal not running - launching..."
        $mt5Paths = @(
            "C:\Program Files\MetaTrader 5\terminal64.exe",
            "C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
            "C:\MT5\terminal64.exe"
        )
        foreach ($path in $mt5Paths) {
            if (Test-Path $path) {
                Start-Process $path
                Write-Host "[Watchdog] Terminal launched: $path"
                Send-TelegramAlert "⚠️ NEXUS Watchdog: MT5 terminal relancé"
                Start-Sleep -Seconds 30
                break
            }
        }
    }

    # Step 2: Check MT5 connector health
    $mt5Status = "unreachable"
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5002/health" -TimeoutSec 5 -ErrorAction Stop
        $health = $resp.Content | ConvertFrom-Json
        $mt5Status = $health.status
        Write-Host "[Watchdog] MT5 health: $mt5Status (uptime: $($health.uptime_seconds)s)"
    } catch {
        Write-Host "[Watchdog] MT5 connector unreachable"
    }

    if ($mt5Status -eq "starting") {
        Write-Host "[Watchdog] MT5 starting - skipping restart"
        $failCount = 0
    } elseif ($mt5Status -eq "ok") {
        if ($failCount -gt 0) {
            Write-Host "[Watchdog] MT5 recovered"
            Send-TelegramAlert "✅ MT5 Connector de nouveau en ligne"
        }
        $failCount = 0
    } else {
        $failCount++
        Write-Host "[Watchdog] MT5 fail count: $failCount"

        if ($failCount -ge 3 -and ($now - $lastRestart) -gt $COOLDOWN) {
            Write-Host "[Watchdog] Restarting Nexus-MT5 service..."
            Send-TelegramAlert "🚨 NEXUS Watchdog: Restart MT5 Connector (failCount=$failCount)"
            try {
                Restart-Service "Nexus-MT5" -ErrorAction Stop
                $lastRestart = $now
                $failCount = 0
                Write-Host "[Watchdog] Nexus-MT5 restarted, waiting 45s..."
                Start-Sleep -Seconds 45
                continue
            } catch {
                Write-Host "[Watchdog] Failed to restart service: $_"
                Send-TelegramAlert "❌ NEXUS Watchdog: Impossible de redémarrer Nexus-MT5 - intervention manuelle requise"
            }
        }
    }

    Start-Sleep -Seconds 60
}

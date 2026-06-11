# NEXUS - Init Database
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== NEXUS V2 - Initialisation base de données ===" -ForegroundColor Cyan

# Load .env
$envFile = "$ProjectRoot\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
}

$pgUser = $env:POSTGRES_USER ?? "postgres"
$pgPass = $env:POSTGRES_PASSWORD ?? "postgres"
$pgDb = $env:POSTGRES_DB ?? "nexus_trading"

# Create database
Write-Host "▶ Création base $pgDb..." -ForegroundColor Cyan
$env:PGPASSWORD = $pgPass
$createDb = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$pgDb') THEN EXECUTE 'CREATE DATABASE $pgDb'; END IF; END `$`$;"
try {
    & psql -U $pgUser -c $createDb 2>$null
    Write-Host "  ✅ Base de données prête" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  psql non disponible ou DB déjà existante - continuons" -ForegroundColor Yellow
}

# Run Python init
Write-Host "▶ Exécution migrations SQLAlchemy..." -ForegroundColor Cyan
$initScript = @"
import asyncio
import sys
sys.path.insert(0, r'$ProjectRoot')
from api.database import init_db
from api.models import *
asyncio.run(init_db())
print('Tables créées avec succès')
"@

$initScript | python -
Write-Host "  ✅ Tables créées" -ForegroundColor Green

# Seed symbol rules
Write-Host "▶ Seed symbol rules..." -ForegroundColor Cyan
$seedScript = @"
import asyncio, json, sys
sys.path.insert(0, r'$ProjectRoot')
from api.database import AsyncSessionLocal, init_db
from api.models.symbol_rule import SymbolRule
from sqlalchemy import select

async def seed():
    await init_db()
    with open(r'$ProjectRoot\config\symbol_rules.default.json') as f:
        rules = json.load(f)
    async with AsyncSessionLocal() as db:
        count = 0
        for r in rules:
            ex = await db.execute(select(SymbolRule).where(SymbolRule.input_pattern == r['input_pattern']))
            if not ex.scalar_one_or_none():
                db.add(SymbolRule(**r))
                count += 1
        await db.commit()
        print(f'{count} règles seedées')

asyncio.run(seed())
"@

$seedScript | python -
Write-Host "  ✅ Symbol rules seedées" -ForegroundColor Green

Write-Host ""
Write-Host "=== Initialisation terminée ===" -ForegroundColor Green

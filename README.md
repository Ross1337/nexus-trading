# NEXUS — Automated Trading Bot V2

Bot de trading automatisé: TradingView → FastAPI → MetaTrader 5

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL + Redis
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS 4
- **MT5**: Python native Windows (MetaTrader5 lib)
- **Telegram**: python-telegram-bot v20
- **Services**: NSSM (Windows services)
- **Design**: Dark terminal Bloomberg — Space Grotesk + JetBrains Mono

## Ports

| Service | Port |
|---------|------|
| Dashboard (Next.js) | 3001 |
| API (FastAPI) | 8001 |
| MT5 Connector | 5002 |

## Démarrage rapide

### 1. Configuration
```powershell
copy .env.example .env
# Editer .env avec vos valeurs
```

### 2. Installation dépendances
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r api\requirements.txt
pip install -r mt5_connector\requirements.txt
pip install -r telegram_bot\requirements.txt
cd frontend && npm install && npm run build && cd ..
```

### 3. Init base de données
```powershell
powershell -File scripts\init-db.ps1
```

### 4. Installation services Windows
```powershell
powershell -File scripts\install-nssm.ps1
```

### 5. Démarrage
```powershell
powershell -File scripts\start-all.ps1
```

## URLs

- **Dashboard**: http://localhost:3001
- **API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **MT5 Health**: http://localhost:5002/health

## Connexion MT5

Les identifiants MT5 sont configurés dans `.env`:
```
MT5_ACCOUNT_0_LOGIN=votre_login
MT5_ACCOUNT_0_PASSWORD=votre_password
MT5_ACCOUNT_0_SERVER=NomDuBroker-Demo
```

## Webhooks TradingView

Payload JSON attendu:
```json
{
  "symbol": "EURUSD",
  "action": "buy",
  "lot": 0.01,
  "sl": 1.0800,
  "tp": 1.0950
}
```

URL webhook: `http://YOUR_IP:8001/api/webhook/tradingview`

## PineConnector

Format CSV compatible:
```
LICENSE_ID,buy,EURUSD,0.01,1.0800,1.0950
```

URL: `http://YOUR_IP:8001/api/webhook/pineconnector`

## Services Windows (NSSM)

| Service | Description |
|---------|-------------|
| Nexus-API | FastAPI backend |
| Nexus-MT5 | MT5 Connector |
| Nexus-Frontend | Next.js dashboard |
| Nexus-Telegram | Bot Telegram |
| Nexus-Watchdog | Surveillance auto |

## Tests
```powershell
pip install pytest pytest-asyncio httpx aiosqlite
pytest tests/ -v
```

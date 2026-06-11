import httpx
import psutil
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import get_current_user
from api.config import settings

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/status")
async def service_status(_: dict = Depends(get_current_user)):
    services = {}

    # Check MT5 connector
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/health")
            services["mt5_connector"] = resp.json() if resp.status_code == 200 else {"status": "error"}
    except Exception:
        services["mt5_connector"] = {"status": "unreachable"}

    # System info
    services["system"] = {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage("/").percent if not __import__("sys").platform.startswith("win") else psutil.disk_usage("C:\\").percent,
    }

    return services


class WebhookTestRequest(BaseModel):
    symbol: str = "EURUSD"
    action: str = "buy"
    lot: float = 0.01
    sl: float = 1.0800
    tp: float = 1.0900


@router.post("/test-webhook")
async def test_webhook(body: WebhookTestRequest, _: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"http://localhost:{settings.API_PORT}/api/webhook/tradingview",
                json={
                    "symbol": body.symbol,
                    "action": body.action,
                    "lot": body.lot,
                    "sl": body.sl,
                    "tp": body.tp,
                },
            )
            return resp.json()
    except Exception as e:
        return {"error": str(e)}


@router.get("/logs/{service}")
async def get_logs(service: str, lines: int = 50, _: dict = Depends(get_current_user)):
    import os
    log_files = {
        "api": "logs/api.log",
        "mt5": "logs/mt5_connector.log",
        "telegram": "logs/telegram_bot.log",
    }
    path = log_files.get(service)
    if not path or not os.path.exists(path):
        return {"lines": [], "error": f"Log file not found for {service}"}
    try:
        with open(path) as f:
            all_lines = f.readlines()
        return {"lines": all_lines[-lines:]}
    except Exception as e:
        return {"lines": [], "error": str(e)}

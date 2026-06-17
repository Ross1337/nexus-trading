import asyncio
import time
import json
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from api.config import settings
from api.database import init_db

from api.routers.auth_router import router as auth_router
from api.routers.webhook import router as webhook_router
from api.routers.pineconnector import router as pineconnector_router
from api.routers.signals import router as signals_router
from api.routers.strategies import router as strategies_router
from api.routers.trades import router as trades_router
from api.routers.accounts import router as accounts_router
from api.routers.orders import router as orders_router
from api.routers.performance import router as performance_router
from api.routers.mt5_data import router as mt5_data_router
from api.routers.trading_plan import router as trading_plan_router
from api.routers.symbol_rules import router as symbol_rules_router
from api.routers.webhook_logs import router as webhook_logs_router
from api.routers.debug import router as debug_router
from api.routers.telegram import router as telegram_router
from api.routers.test_runner import router as test_runner_router
from api.routers.v1_compat import router as v1_compat_router

# Rate limiter: {ip: [(timestamp, count)]}
_rate_limits: dict[str, list] = defaultdict(list)

RATE_CONFIGS = {
    "/api/auth/login": (10, 60),
    "/api/webhook": (60, 60),
    "default": (120, 60),
}

active_ws_connections: list[WebSocket] = []


def _get_client_ip(request: Request) -> str:
    return request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "unknown")


def _check_rate_limit(ip: str, path: str) -> bool:
    now = time.time()
    for prefix, (limit, window) in RATE_CONFIGS.items():
        if prefix != "default" and path.startswith(prefix):
            break
    else:
        limit, window = RATE_CONFIGS["default"]

    key = f"{ip}:{path[:30]}"
    timestamps = _rate_limits[key]
    timestamps = [t for t in timestamps if now - t < window]
    _rate_limits[key] = timestamps
    if len(timestamps) >= limit:
        return False
    timestamps.append(now)
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="NEXUS Trading Bot API V2",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Rate limiting
    ip = _get_client_ip(request)
    if not _check_rate_limit(ip, request.url.path):
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})

    # Strip null bytes from query params
    for key in list(request.query_params.keys()):
        if "\x00" in request.query_params[key]:
            return JSONResponse(status_code=400, content={"detail": "Invalid request"})

    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Routers
app.include_router(auth_router)
app.include_router(webhook_router)
app.include_router(pineconnector_router)
app.include_router(signals_router)
app.include_router(strategies_router)
app.include_router(trades_router)
app.include_router(accounts_router)
app.include_router(orders_router)
app.include_router(performance_router)
app.include_router(mt5_data_router)
app.include_router(trading_plan_router)
app.include_router(symbol_rules_router)
app.include_router(webhook_logs_router)
app.include_router(debug_router)
app.include_router(telegram_router)
app.include_router(test_runner_router)
app.include_router(v1_compat_router)


@app.get("/api/health")
async def health():
    mt5_ok = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/health")
            mt5_ok = resp.status_code == 200
    except Exception:
        pass
    return {"status": "ok", "mt5_connector": mt5_ok, "version": "2.0.0"}


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    active_ws_connections.append(websocket)
    try:
        while True:
            try:
                async with httpx.AsyncClient(timeout=3) as client:
                    resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/account")
                    account = resp.json() if resp.status_code == 200 else {}
            except Exception:
                account = {}
            try:
                async with httpx.AsyncClient(timeout=3) as client:
                    resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/positions")
                    positions = resp.json() if resp.status_code == 200 else []
            except Exception:
                positions = []
            await websocket.send_json({
                "type": "live_update",
                "account": account,
                "positions": positions,
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in active_ws_connections:
            active_ws_connections.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=settings.API_PORT, reload=settings.DEBUG)

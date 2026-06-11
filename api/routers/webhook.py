import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from api.database import get_db
from api.models.webhook_log import WebhookLog
from api.models.signal import Signal
from api.models.trading_plan import TradingPlan
from api.services.signal_processor import process_signal
from api.services.symbol_normalizer import normalize_symbol
from api.config import settings
from sqlalchemy import select

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


def _verify_secret(payload: bytes, signature: str | None) -> bool:
    if not settings.WEBHOOK_SECRET:
        return True
    if not signature:
        return False
    expected = hmac.new(settings.WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


async def _get_trading_plan(db: AsyncSession) -> dict:
    result = await db.execute(select(TradingPlan).limit(1))
    plan = result.scalar_one_or_none()
    if not plan:
        return {}
    return {
        "be_enabled": plan.be_enabled,
        "be_trigger_pips": plan.be_trigger_pips,
        "trailing_enabled": plan.trailing_enabled,
        "trailing_distance_pips": plan.trailing_distance_pips,
        "partial_tp_enabled": plan.partial_tp_enabled,
        "partial_tp_rr": plan.partial_tp_rr,
        "partial_tp_percent": plan.partial_tp_percent,
        "propfirm_enabled": plan.propfirm_enabled,
        "max_daily_drawdown_pct": plan.max_daily_drawdown_pct,
        "max_total_drawdown_pct": plan.max_total_drawdown_pct,
        "max_daily_loss_usd": plan.max_daily_loss_usd,
        "profit_target_pct": plan.profit_target_pct,
        "max_risk_per_trade_pct": plan.max_risk_per_trade_pct,
        "max_open_trades": plan.max_open_trades,
        "max_lot_size": plan.max_lot_size,
    }


@router.post("/tradingview")
async def tradingview_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("X-Signature-256")
    client_ip = request.headers.get("CF-Connecting-IP") or request.client.host

    log = WebhookLog(source="tradingview", ip_address=client_ip, payload=body.decode()[:5000])
    db.add(log)
    await db.flush()

    if not _verify_secret(body, sig):
        log.status = "rejected"
        log.error_message = "Invalid signature"
        await db.commit()
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = await request.json()
    except Exception:
        log.status = "error"
        log.error_message = "Invalid JSON"
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON")

    raw_symbol = str(data.get("symbol", "")).strip().replace("\x00", "")
    symbol = await normalize_symbol(raw_symbol, db)
    action = str(data.get("action", "")).lower().strip()
    lot_size = float(data["lot"]) if data.get("lot") else None
    stop_loss = float(data["sl"]) if data.get("sl") else None
    take_profit = float(data["tp"]) if data.get("tp") else None
    entry_price = float(data["price"]) if data.get("price") else None

    trading_plan = await _get_trading_plan(db)
    result = await process_signal(symbol, action, lot_size, stop_loss, take_profit, entry_price, None, trading_plan)

    signal = Signal(
        source="tradingview",
        symbol=symbol,
        action=action,
        lot_size=lot_size,
        stop_loss=stop_loss,
        take_profit=take_profit,
        entry_price=entry_price,
        raw_payload=body.decode()[:5000],
        status=result["status"],
        reject_reason=result.get("reason"),
    )
    db.add(signal)
    log.status = result["status"]
    log.signal_id = signal.id
    await db.commit()

    return {"status": result["status"], "detail": result.get("reason", "ok")}


@router.post("/tradingview/close")
async def tradingview_close(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    raw_symbol = str(data.get("symbol", "")).replace("\x00", "")
    symbol = await normalize_symbol(raw_symbol, db)
    action = str(data.get("action", "close")).lower()
    trading_plan = await _get_trading_plan(db)
    result = await process_signal(symbol, action, None, None, None, None, None, trading_plan)
    return {"status": result["status"]}

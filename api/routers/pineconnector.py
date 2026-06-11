"""
PineConnector-compatible webhook endpoint.
Format: "LICENSE_ID,ACTION,SYMBOL,LOT,SL,TP,COMMENT"
"""
from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from api.database import get_db
from api.models.signal import Signal
from api.models.webhook_log import WebhookLog
from api.models.trading_plan import TradingPlan
from api.services.signal_processor import process_signal
from api.services.symbol_normalizer import normalize_symbol
from sqlalchemy import select

router = APIRouter(prefix="/api/webhook", tags=["pineconnector"])

PC_ACTIONS = {"buy", "sell", "closebuy", "closesell", "close"}


async def _get_plan(db: AsyncSession) -> dict:
    result = await db.execute(select(TradingPlan).limit(1))
    plan = result.scalar_one_or_none()
    return {
        "max_open_trades": plan.max_open_trades if plan else 10,
        "max_lot_size": plan.max_lot_size if plan else 10.0,
        "max_risk_per_trade_pct": plan.max_risk_per_trade_pct if plan else 2.0,
        "propfirm_enabled": plan.propfirm_enabled if plan else False,
        "max_daily_drawdown_pct": plan.max_daily_drawdown_pct if plan else 5.0,
        "max_total_drawdown_pct": plan.max_total_drawdown_pct if plan else 10.0,
    } if plan else {}


@router.post("/pineconnector")
async def pineconnector_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body_text = (await request.body()).decode("utf-8", errors="ignore").strip()
    client_ip = request.headers.get("CF-Connecting-IP") or request.client.host

    log = WebhookLog(source="pineconnector", ip_address=client_ip, payload=body_text[:2000])
    db.add(log)
    await db.flush()

    parts = [p.strip() for p in body_text.split(",")]
    if len(parts) < 3:
        log.status = "rejected"
        log.error_message = "Invalid PineConnector format"
        await db.commit()
        return {"status": "error", "detail": "Invalid format"}

    # parts: LICENSE, ACTION, SYMBOL[, LOT[, SL[, TP[, COMMENT]]]]
    _license = parts[0]
    action = parts[1].lower()
    raw_symbol = parts[2].replace("\x00", "")
    symbol = await normalize_symbol(raw_symbol, db)
    lot_size = float(parts[3]) if len(parts) > 3 and parts[3] else None
    stop_loss = float(parts[4]) if len(parts) > 4 and parts[4] else None
    take_profit = float(parts[5]) if len(parts) > 5 and parts[5] else None

    if action not in PC_ACTIONS:
        log.status = "rejected"
        log.error_message = f"Unknown action: {action}"
        await db.commit()
        return {"status": "error", "detail": f"Unknown action: {action}"}

    plan = await _get_plan(db)
    result = await process_signal(symbol, action, lot_size, stop_loss, take_profit, None, None, plan)

    signal = Signal(
        source="pineconnector",
        symbol=symbol,
        action=action,
        lot_size=lot_size,
        stop_loss=stop_loss,
        take_profit=take_profit,
        raw_payload=body_text[:2000],
        status=result["status"],
        reject_reason=result.get("reason"),
    )
    db.add(signal)
    log.status = result["status"]
    await db.commit()
    return {"status": result["status"]}

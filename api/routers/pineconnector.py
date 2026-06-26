"""
PineConnector-compatible webhook endpoint.
Format: "LICENSE_ID,ACTION,SYMBOL,LOT,SL,TP,COMMENT"
"""
import logging
from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from api.database import get_db
from api.models.signal import Signal
from api.models.webhook_log import WebhookLog
from api.models.trading_plan import TradingPlan
from api.services.signal_processor import process_signal
from api.services.symbol_normalizer import normalize_symbol
from sqlalchemy import select

logger = logging.getLogger("nexus.pineconnector")

router = APIRouter(prefix="/api/webhook", tags=["pineconnector"])

# Actions natives PineConnector + alias TradingView ({{strategy.order.action}} & co.)
PC_ACTIONS = {"buy", "sell", "closebuy", "closesell", "close"}

# Mapping des alias TradingView/Pine vers les actions canoniques
ACTION_ALIASES = {
    "long": "buy",
    "buylong": "buy",
    "openlong": "buy",
    "short": "sell",
    "sellshort": "sell",
    "opensell": "sell",
    "op. short": "sell",
    "closelong": "closebuy",
    "exitlong": "closebuy",
    "closeshort": "closesell",
    "exitshort": "closesell",
    "closelongshort": "close",
    "closeall": "close",
    "exit": "close",
    "flat": "close",
}

# Actions informationnelles sans effet de trading (on les accepte mais on ne trade pas)
NOOP_ACTIONS = {"new", "alert", "ping", "test", "update"}


def _safe_float(value):
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


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
    client_ip = request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "")

    log = WebhookLog(source="pineconnector", ip_address=client_ip, payload=body_text[:2000])
    db.add(log)
    await db.flush()

    # Tout est wrappé : on garantit que le log est TOUJOURS committé (plus de 500 invisibles)
    try:
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
        lot_size = _safe_float(parts[3]) if len(parts) > 3 else None
        stop_loss = _safe_float(parts[4]) if len(parts) > 4 else None
        take_profit = _safe_float(parts[5]) if len(parts) > 5 else None

        # Normalisation de l'action (alias TradingView -> canonique)
        action = ACTION_ALIASES.get(action, action)

        # Actions informationnelles : accepté mais aucun trade
        if action in NOOP_ACTIONS:
            log.status = "received"
            log.error_message = None
            await db.commit()
            return {"status": "ignored", "detail": f"No-op action: {action}"}

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
        log.error_message = result.get("reason")
        await db.commit()
        return {"status": result["status"]}

    except Exception as e:
        logger.exception("PineConnector webhook crash")
        # On rollback la transaction cassée puis on RE-LOG proprement pour visibilité
        await db.rollback()
        try:
            err_log = WebhookLog(
                source="pineconnector",
                ip_address=client_ip,
                payload=body_text[:2000],
                status="error",
                error_message=f"Exception: {type(e).__name__}: {str(e)[:300]}",
            )
            db.add(err_log)
            await db.commit()
        except Exception:
            await db.rollback()
        # On renvoie 200 pour que TradingView n'affiche pas "500" et garde l'alerte
        return {"status": "error", "detail": f"{type(e).__name__}: {str(e)[:200]}"}

import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from api.database import get_db
from api.models.webhook_log import WebhookLog
from api.models.signal import Signal
from api.models.trading_plan import TradingPlan
from api.services.signal_processor import process_signal
from api.services.symbol_normalizer import normalize_symbol
from api.config import settings
from sqlalchemy import select

logger = logging.getLogger("nexus.tradingview")

router = APIRouter(prefix="/api/webhook", tags=["webhook"])

# Mapping des alias TradingView vers les actions canoniques
ACTION_ALIASES = {
    "long": "buy",
    "buylong": "buy",
    "openlong": "buy",
    "short": "sell",
    "sellshort": "sell",
    "opensell": "sell",
    "closelong": "closebuy",
    "exitlong": "closebuy",
    "closeshort": "closesell",
    "exitshort": "closesell",
    "closelongshort": "close",
    "closeall": "close",
    "exit": "close",
    "flat": "close",
}

NOOP_ACTIONS = {"new", "alert", "ping", "test", "update"}


def _safe_float(value):
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _verify_secret(payload: bytes, signature: str | None, body_data: dict | None) -> bool:
    """
    TradingView ne signe PAS nativement les webhooks (pas de header HMAC).
    On accepte donc 3 modes d'auth, dans l'ordre :
      1. Pas de secret configuré -> tout passe
      2. Header HMAC X-Signature-256 valide (clients qui signent)
      3. passphrase dans le body JSON == WEBHOOK_SECRET (cas TradingView standard)
    """
    if not settings.WEBHOOK_SECRET:
        return True

    secret = settings.WEBHOOK_SECRET

    # Mode 2 : signature HMAC dans le header
    if signature:
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        if hmac.compare_digest(f"sha256={expected}", signature):
            return True
        # certains clients envoient le hex brut sans le prefixe "sha256="
        if hmac.compare_digest(expected, signature):
            return True

    # Mode 3 : passphrase dans le body (cas TradingView natif)
    if body_data and isinstance(body_data, dict):
        passphrase = str(body_data.get("passphrase", "")).strip()
        if passphrase and hmac.compare_digest(passphrase, secret):
            return True

    return False


def _parse_body(body: bytes) -> dict | None:
    """Parse le body en JSON. Tolère un éventuel CSV PineConnector en fallback."""
    text = body.decode("utf-8", errors="ignore").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        # Fallback CSV : "passphrase,action,symbol,lot,sl,tp"
        parts = [p.strip() for p in text.split(",")]
        if len(parts) >= 3:
            return {
                "passphrase": parts[0],
                "action": parts[1],
                "symbol": parts[2],
                "lot": parts[3] if len(parts) > 3 else None,
                "sl": parts[4] if len(parts) > 4 else None,
                "tp": parts[5] if len(parts) > 5 else None,
            }
        return None


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
    client_ip = request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "")

    log = WebhookLog(source="tradingview", ip_address=client_ip, payload=body.decode("utf-8", errors="ignore")[:5000])
    db.add(log)
    await db.flush()

    try:
        data = _parse_body(body)
        if data is None:
            log.status = "error"
            log.error_message = "Invalid JSON / empty body"
            await db.commit()
            return {"status": "error", "detail": "Invalid JSON"}

        # Auth : header HMAC OU passphrase dans le body
        if not _verify_secret(body, sig, data):
            log.status = "rejected"
            log.error_message = "Invalid signature / passphrase"
            await db.commit()
            return {"status": "rejected", "detail": "Invalid signature"}

        raw_symbol = str(data.get("symbol", "")).strip().replace("\x00", "")
        symbol = await normalize_symbol(raw_symbol, db)
        action = str(data.get("action", "")).lower().strip()
        action = ACTION_ALIASES.get(action, action)

        # Actions informationnelles : on log mais on ne trade pas
        if action in NOOP_ACTIONS:
            log.status = "received"
            await db.commit()
            return {"status": "ignored", "detail": f"No-op action: {action}"}

        lot_size = _safe_float(data.get("lot") if data.get("lot") is not None else data.get("qty"))
        stop_loss = _safe_float(data.get("sl"))
        take_profit = _safe_float(data.get("tp"))
        entry_price = _safe_float(data.get("price"))

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
            raw_payload=body.decode("utf-8", errors="ignore")[:5000],
            status=result["status"],
            reject_reason=result.get("reason"),
        )
        db.add(signal)
        await db.flush()
        log.status = result["status"]
        log.error_message = result.get("reason")
        log.signal_id = signal.id
        await db.commit()

        return {"status": result["status"], "detail": result.get("reason", "ok")}

    except Exception as e:
        logger.exception("TradingView webhook crash")
        await db.rollback()
        try:
            err_log = WebhookLog(
                source="tradingview",
                ip_address=client_ip,
                payload=body.decode("utf-8", errors="ignore")[:5000],
                status="error",
                error_message=f"Exception: {type(e).__name__}: {str(e)[:300]}",
            )
            db.add(err_log)
            await db.commit()
        except Exception:
            await db.rollback()
        # 200 pour que TradingView garde l'alerte (pas de "500")
        return {"status": "error", "detail": f"{type(e).__name__}: {str(e)[:200]}"}


@router.post("/tradingview/close")
async def tradingview_close(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    client_ip = request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "")

    log = WebhookLog(source="tradingview", ip_address=client_ip, payload=body.decode("utf-8", errors="ignore")[:5000])
    db.add(log)
    await db.flush()

    try:
        data = _parse_body(body) or {}
        sig = request.headers.get("X-Signature-256")
        if not _verify_secret(body, sig, data):
            log.status = "rejected"
            log.error_message = "Invalid signature / passphrase"
            await db.commit()
            return {"status": "rejected", "detail": "Invalid signature"}

        raw_symbol = str(data.get("symbol", "")).replace("\x00", "")
        symbol = await normalize_symbol(raw_symbol, db)
        action = str(data.get("action", "close")).lower()
        action = ACTION_ALIASES.get(action, action)
        trading_plan = await _get_trading_plan(db)
        result = await process_signal(symbol, action, None, None, None, None, None, trading_plan)
        log.status = result["status"]
        log.error_message = result.get("reason")
        await db.commit()
        return {"status": result["status"]}

    except Exception as e:
        logger.exception("TradingView close webhook crash")
        await db.rollback()
        try:
            err_log = WebhookLog(
                source="tradingview",
                ip_address=client_ip,
                payload=body.decode("utf-8", errors="ignore")[:5000],
                status="error",
                error_message=f"Exception: {type(e).__name__}: {str(e)[:300]}",
            )
            db.add(err_log)
            await db.commit()
        except Exception:
            await db.rollback()
        return {"status": "error", "detail": f"{type(e).__name__}: {str(e)[:200]}"}

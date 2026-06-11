"""
Routes signals to the appropriate MT5 accounts.
"""
import httpx
from typing import Optional
from api.config import settings
from api.services.risk_manager import run_risk_checks
from api.services.notification import notify


async def get_mt5_account_info() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/account")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {"connected": False, "balance": 0, "equity": 0, "margin_free": 0}


async def get_open_positions() -> list:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/positions")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return []


async def process_signal(
    symbol: str,
    action: str,
    lot_size: Optional[float],
    stop_loss: Optional[float],
    take_profit: Optional[float],
    entry_price: Optional[float],
    strategy_id: Optional[int],
    trading_plan: dict,
) -> dict:
    account_info = await get_mt5_account_info()
    open_positions = await get_open_positions()

    ok, reason = await run_risk_checks(
        symbol=symbol,
        action=action,
        lot_size=lot_size,
        stop_loss=stop_loss,
        entry_price=entry_price,
        account_info=account_info,
        open_positions=open_positions,
        trading_plan=trading_plan,
    )

    if not ok:
        await notify(f"⛔ Signal rejeté <b>{symbol} {action.upper()}</b>: {reason}")
        return {"status": "rejected", "reason": reason}

    # Send to MT5 connector
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            payload = {
                "symbol": symbol,
                "action": action,
                "lot_size": lot_size,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "entry_price": entry_price,
            }
            resp = await client.post(f"{settings.MT5_CONNECTOR_URL}/order", json=payload)
            result = resp.json()
            if resp.status_code == 200 and result.get("success"):
                await notify(
                    f"✅ Trade ouvert: <b>{symbol} {action.upper()}</b> "
                    f"{lot_size} lots @ {entry_price or 'market'}"
                )
                return {"status": "executed", "result": result}
            else:
                err = result.get("error", "MT5 error")
                await notify(f"⛔ Erreur MT5 <b>{symbol} {action.upper()}</b>: {err}")
                return {"status": "error", "reason": err}
    except Exception as e:
        await notify(f"🚨 Exception traitement signal <b>{symbol}</b>: {str(e)}")
        return {"status": "error", "reason": str(e)}

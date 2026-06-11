"""
Breakeven, trailing stop, and partial TP management.
"""
import httpx
from api.config import settings


async def apply_breakeven(ticket: str, entry_price: float, current_price: float, plan: dict) -> bool:
    if not plan.get("be_enabled"):
        return False
    trigger_pips = float(plan.get("be_trigger_pips", 20)) / 10000
    offset_pips = float(plan.get("be_offset_pips", 2)) / 10000
    action = plan.get("action", "buy")

    if action == "buy" and (current_price - entry_price) >= trigger_pips:
        new_sl = entry_price + offset_pips
        return await _modify_sl(ticket, new_sl)
    elif action == "sell" and (entry_price - current_price) >= trigger_pips:
        new_sl = entry_price - offset_pips
        return await _modify_sl(ticket, new_sl)
    return False


async def apply_trailing_stop(ticket: str, current_price: float, current_sl: float, plan: dict) -> bool:
    if not plan.get("trailing_enabled"):
        return False
    step = float(plan.get("trailing_step_pips", 10)) / 10000
    distance = float(plan.get("trailing_distance_pips", 20)) / 10000
    action = plan.get("action", "buy")

    if action == "buy":
        new_sl = current_price - distance
        if new_sl > (current_sl + step):
            return await _modify_sl(ticket, new_sl)
    elif action == "sell":
        new_sl = current_price + distance
        if new_sl < (current_sl - step):
            return await _modify_sl(ticket, new_sl)
    return False


async def apply_partial_tp(ticket: str, entry_price: float, current_price: float, plan: dict) -> bool:
    if not plan.get("partial_tp_enabled"):
        return False
    rr = float(plan.get("partial_tp_rr", 1.0))
    percent = float(plan.get("partial_tp_percent", 50.0))
    sl = plan.get("stop_loss")
    if not sl:
        return False
    sl_distance = abs(entry_price - sl)
    tp_level = entry_price + (sl_distance * rr) if plan.get("action") == "buy" else entry_price - (sl_distance * rr)

    if plan.get("action") == "buy" and current_price >= tp_level:
        return await _partial_close(ticket, percent)
    elif plan.get("action") == "sell" and current_price <= tp_level:
        return await _partial_close(ticket, percent)
    return False


async def _modify_sl(ticket: str, new_sl: float) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{settings.MT5_CONNECTOR_URL}/modify",
                json={"ticket": ticket, "stop_loss": new_sl},
            )
            return resp.status_code == 200
    except Exception:
        return False


async def _partial_close(ticket: str, percent: float) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{settings.MT5_CONNECTOR_URL}/partial_close",
                json={"ticket": ticket, "percent": percent},
            )
            return resp.status_code == 200
    except Exception:
        return False

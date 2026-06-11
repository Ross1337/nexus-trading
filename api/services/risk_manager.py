"""
14-check risk manager. Checks run in order; first failure returns (False, reason).
"""
from typing import Optional


class RiskCheckError(Exception):
    pass


async def run_risk_checks(
    symbol: str,
    action: str,
    lot_size: Optional[float],
    stop_loss: Optional[float],
    entry_price: Optional[float],
    account_info: dict,
    open_positions: list,
    trading_plan: dict,
) -> tuple[bool, str]:
    checks = [
        _check_sl_required,
        _check_symbol_not_empty,
        _check_action_valid,
        _check_lot_positive,
        _check_max_lot,
        _check_max_open_trades,
        _check_account_connected,
        _check_free_margin,
        _check_daily_drawdown,
        _check_total_drawdown,
        _check_daily_loss_usd,
        _check_profit_target_reached,
        _check_duplicate_position,
        _check_max_risk_per_trade,
    ]

    ctx = {
        "symbol": symbol,
        "action": action,
        "lot_size": lot_size,
        "stop_loss": stop_loss,
        "entry_price": entry_price,
        "account_info": account_info,
        "open_positions": open_positions,
        "trading_plan": trading_plan,
    }

    for check in checks:
        ok, reason = await check(ctx)
        if not ok:
            return False, reason

    return True, "ok"


async def _check_sl_required(ctx) -> tuple[bool, str]:
    if ctx.get("stop_loss") is None:
        return False, "Stop loss is required"
    return True, ""


async def _check_symbol_not_empty(ctx) -> tuple[bool, str]:
    if not ctx.get("symbol"):
        return False, "Symbol is required"
    return True, ""


async def _check_action_valid(ctx) -> tuple[bool, str]:
    if ctx.get("action") not in ("buy", "sell", "close", "closebuy", "closesell"):
        return False, f"Invalid action: {ctx.get('action')}"
    return True, ""


async def _check_lot_positive(ctx) -> tuple[bool, str]:
    lot = ctx.get("lot_size")
    if lot is not None and lot <= 0:
        return False, "Lot size must be positive"
    return True, ""


async def _check_max_lot(ctx) -> tuple[bool, str]:
    lot = ctx.get("lot_size") or 0
    max_lot = float(ctx["trading_plan"].get("max_lot_size", 10.0))
    if lot > max_lot:
        return False, f"Lot size {lot} exceeds maximum {max_lot}"
    return True, ""


async def _check_max_open_trades(ctx) -> tuple[bool, str]:
    max_trades = int(ctx["trading_plan"].get("max_open_trades", 10))
    open_count = len(ctx.get("open_positions", []))
    if open_count >= max_trades:
        return False, f"Max open trades reached ({open_count}/{max_trades})"
    return True, ""


async def _check_account_connected(ctx) -> tuple[bool, str]:
    info = ctx.get("account_info", {})
    if not info.get("connected", False):
        return False, "MT5 account not connected"
    return True, ""


async def _check_free_margin(ctx) -> tuple[bool, str]:
    info = ctx.get("account_info", {})
    free_margin = info.get("margin_free", 0)
    if free_margin <= 0:
        return False, "Insufficient free margin"
    return True, ""


async def _check_daily_drawdown(ctx) -> tuple[bool, str]:
    plan = ctx.get("trading_plan", {})
    if not plan.get("propfirm_enabled"):
        return True, ""
    info = ctx.get("account_info", {})
    balance = info.get("balance", 0)
    equity = info.get("equity", 0)
    if balance <= 0:
        return True, ""
    dd_pct = ((balance - equity) / balance) * 100
    max_dd = float(plan.get("max_daily_drawdown_pct", 5.0))
    if dd_pct >= max_dd:
        return False, f"Daily drawdown limit reached ({dd_pct:.2f}% >= {max_dd}%)"
    return True, ""


async def _check_total_drawdown(ctx) -> tuple[bool, str]:
    plan = ctx.get("trading_plan", {})
    if not plan.get("propfirm_enabled"):
        return True, ""
    info = ctx.get("account_info", {})
    balance = info.get("balance", 0)
    equity = info.get("equity", 0)
    if balance <= 0:
        return True, ""
    dd_pct = ((balance - equity) / balance) * 100
    max_dd = float(plan.get("max_total_drawdown_pct", 10.0))
    if dd_pct >= max_dd:
        return False, f"Total drawdown limit reached ({dd_pct:.2f}% >= {max_dd}%)"
    return True, ""


async def _check_daily_loss_usd(ctx) -> tuple[bool, str]:
    plan = ctx.get("trading_plan", {})
    max_loss = plan.get("max_daily_loss_usd")
    if not max_loss:
        return True, ""
    info = ctx.get("account_info", {})
    daily_pnl = info.get("daily_pnl", 0)
    if daily_pnl <= -float(max_loss):
        return False, f"Daily loss limit reached (${abs(daily_pnl):.2f} >= ${max_loss})"
    return True, ""


async def _check_profit_target_reached(ctx) -> tuple[bool, str]:
    plan = ctx.get("trading_plan", {})
    if not plan.get("propfirm_enabled") or not plan.get("profit_target_pct"):
        return True, ""
    info = ctx.get("account_info", {})
    balance = info.get("balance", 0)
    equity = info.get("equity", 0)
    if balance <= 0:
        return True, ""
    gain_pct = ((equity - balance) / balance) * 100
    target = float(plan.get("profit_target_pct", 0))
    if gain_pct >= target:
        return False, f"Profit target already reached ({gain_pct:.2f}% >= {target}%)"
    return True, ""


async def _check_duplicate_position(ctx) -> tuple[bool, str]:
    symbol = ctx.get("symbol", "")
    action = ctx.get("action", "")
    positions = ctx.get("open_positions", [])
    for pos in positions:
        if pos.get("symbol") == symbol and pos.get("type") == action:
            return False, f"Duplicate position: {symbol} {action} already open"
    return True, ""


async def _check_max_risk_per_trade(ctx) -> tuple[bool, str]:
    plan = ctx.get("trading_plan", {})
    max_risk_pct = float(plan.get("max_risk_per_trade_pct", 2.0))
    lot = ctx.get("lot_size") or 0
    sl = ctx.get("stop_loss")
    entry = ctx.get("entry_price")
    info = ctx.get("account_info", {})
    balance = info.get("balance", 0)
    if not sl or not entry or balance <= 0 or lot <= 0:
        return True, ""
    sl_pips = abs(entry - sl) * 10000
    risk_usd = sl_pips * lot * 10
    risk_pct = (risk_usd / balance) * 100
    if risk_pct > max_risk_pct:
        return False, f"Risk per trade too high ({risk_pct:.2f}% > {max_risk_pct}%)"
    return True, ""

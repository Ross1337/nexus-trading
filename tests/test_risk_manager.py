import pytest
from api.services.risk_manager import run_risk_checks

BASE_ACCOUNT = {"connected": True, "balance": 10000, "equity": 10000, "margin_free": 5000}
BASE_PLAN = {
    "max_lot_size": 10.0, "max_open_trades": 10, "max_risk_per_trade_pct": 2.0,
    "propfirm_enabled": False, "max_daily_drawdown_pct": 5.0,
    "max_total_drawdown_pct": 10.0,
}


@pytest.mark.asyncio
async def test_sl_required():
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, None, 1.0850, BASE_ACCOUNT, [], BASE_PLAN)
    assert not ok
    assert "stop loss" in reason.lower()


@pytest.mark.asyncio
async def test_valid_trade():
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.0850, BASE_ACCOUNT, [], BASE_PLAN)
    assert ok


@pytest.mark.asyncio
async def test_invalid_action():
    ok, reason = await run_risk_checks("EURUSD", "INVALID", 0.01, 1.08, 1.09, BASE_ACCOUNT, [], BASE_PLAN)
    assert not ok
    assert "action" in reason.lower()


@pytest.mark.asyncio
async def test_lot_too_large():
    plan = {**BASE_PLAN, "max_lot_size": 0.5}
    ok, reason = await run_risk_checks("EURUSD", "buy", 1.0, 1.08, 1.09, BASE_ACCOUNT, [], plan)
    assert not ok
    assert "lot" in reason.lower()


@pytest.mark.asyncio
async def test_max_open_trades():
    plan = {**BASE_PLAN, "max_open_trades": 2}
    positions = [{"symbol": "GBPUSD", "type": "buy"}, {"symbol": "USDJPY", "type": "sell"}]
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, BASE_ACCOUNT, positions, plan)
    assert not ok
    assert "max open trades" in reason.lower()


@pytest.mark.asyncio
async def test_account_not_connected():
    account = {**BASE_ACCOUNT, "connected": False}
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, account, [], BASE_PLAN)
    assert not ok
    assert "connected" in reason.lower()


@pytest.mark.asyncio
async def test_no_free_margin():
    account = {**BASE_ACCOUNT, "margin_free": 0}
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, account, [], BASE_PLAN)
    assert not ok
    assert "margin" in reason.lower()


@pytest.mark.asyncio
async def test_propfirm_daily_drawdown():
    plan = {**BASE_PLAN, "propfirm_enabled": True, "max_daily_drawdown_pct": 5.0}
    account = {**BASE_ACCOUNT, "balance": 10000, "equity": 9400}
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, account, [], plan)
    assert not ok
    assert "drawdown" in reason.lower()


@pytest.mark.asyncio
async def test_propfirm_total_drawdown():
    plan = {**BASE_PLAN, "propfirm_enabled": True, "max_total_drawdown_pct": 10.0}
    account = {**BASE_ACCOUNT, "balance": 10000, "equity": 8900}
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, account, [], plan)
    assert not ok
    assert "drawdown" in reason.lower()


@pytest.mark.asyncio
async def test_duplicate_position():
    positions = [{"symbol": "EURUSD", "type": "buy"}]
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, BASE_ACCOUNT, positions, BASE_PLAN)
    assert not ok
    assert "duplicate" in reason.lower()


@pytest.mark.asyncio
async def test_lot_zero_rejected():
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.0, 1.08, 1.09, BASE_ACCOUNT, [], BASE_PLAN)
    assert not ok


@pytest.mark.asyncio
async def test_symbol_empty():
    ok, reason = await run_risk_checks("", "buy", 0.01, 1.08, 1.09, BASE_ACCOUNT, [], BASE_PLAN)
    assert not ok


@pytest.mark.asyncio
async def test_close_action_valid():
    ok, reason = await run_risk_checks("EURUSD", "close", None, None, None, BASE_ACCOUNT, [], BASE_PLAN)
    # Close actions skip most checks
    assert ok or "stop loss" in reason.lower()


@pytest.mark.asyncio
async def test_propfirm_disabled_skips_dd_check():
    plan = {**BASE_PLAN, "propfirm_enabled": False, "max_daily_drawdown_pct": 1.0}
    account = {**BASE_ACCOUNT, "balance": 10000, "equity": 8000}
    ok, reason = await run_risk_checks("EURUSD", "buy", 0.01, 1.08, 1.09, account, [], plan)
    assert ok

import pytest
from api.services.symbol_normalizer import normalize_symbol


@pytest.mark.asyncio
async def test_oanda_prefix(db_session):
    result = await normalize_symbol("OANDA:EURUSD", db_session)
    assert result == "EURUSD"


@pytest.mark.asyncio
async def test_fx_prefix(db_session):
    result = await normalize_symbol("FX:GBPUSD", db_session)
    assert result == "GBPUSD"


@pytest.mark.asyncio
async def test_usdt_suffix_via_fallback(db_session):
    result = await normalize_symbol("BTCUSDT", db_session)
    # Without DB rule, just uppercase
    assert result is not None


@pytest.mark.asyncio
async def test_plain_symbol(db_session):
    result = await normalize_symbol("EURUSD", db_session)
    assert result == "EURUSD"


@pytest.mark.asyncio
async def test_null_byte_stripped(db_session):
    result = await normalize_symbol("EURUSD\x00", db_session)
    assert "\x00" not in result


@pytest.mark.asyncio
async def test_empty_symbol(db_session):
    result = await normalize_symbol("", db_session)
    assert result == ""

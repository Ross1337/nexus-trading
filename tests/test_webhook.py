import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_health_public(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_tradingview_webhook_missing_sl(client):
    with patch("api.services.signal_processor.process_signal", new_callable=AsyncMock) as mock_proc:
        mock_proc.return_value = {"status": "rejected", "reason": "Stop loss is required"}
        resp = await client.post(
            "/api/webhook/tradingview",
            json={"symbol": "EURUSD", "action": "buy", "lot": 0.01},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"


@pytest.mark.asyncio
async def test_pineconnector_invalid_format(client):
    resp = await client.post(
        "/api/webhook/pineconnector",
        content="invalid",
        headers={"Content-Type": "text/plain"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"


@pytest.mark.asyncio
async def test_pineconnector_valid_format(client):
    with patch("api.services.signal_processor.process_signal", new_callable=AsyncMock) as mock_proc:
        mock_proc.return_value = {"status": "executed"}
        resp = await client.post(
            "/api/webhook/pineconnector",
            content="LICENSE123,buy,EURUSD,0.01,1.0800,1.0950",
            headers={"Content-Type": "text/plain"},
        )
        assert resp.status_code == 200

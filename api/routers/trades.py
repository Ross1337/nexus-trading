import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from api.database import get_db
from api.models.trade import Trade
from api.auth import get_current_user
from api.config import settings

router = APIRouter(prefix="/api/trades", tags=["trades"])


@router.get("/history")
async def trade_history(
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    symbol: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    q = select(Trade).order_by(desc(Trade.id)).offset(offset).limit(limit)
    if symbol:
        q = q.where(Trade.symbol == symbol.upper())
    result = await db.execute(q)
    return [_trade_dict(t) for t in result.scalars().all()]


@router.get("/positions")
async def open_positions(_: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/positions")
            return resp.json()
    except Exception as e:
        return {"error": str(e), "positions": []}


@router.get("/mt5-history")
async def mt5_history(days: int = Query(7, le=90), _: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}/history", params={"days": days})
            return resp.json()
    except Exception as e:
        return {"error": str(e), "trades": []}


class CloseRequest(BaseModel):
    ticket: str
    lot: Optional[float] = None


@router.post("/close")
async def close_trade(body: CloseRequest, _: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.MT5_CONNECTOR_URL}/close",
                json={"ticket": body.ticket, "lot": body.lot},
            )
            return resp.json()
    except Exception as e:
        raise HTTPException(500, str(e))


def _trade_dict(t: Trade) -> dict:
    return {
        "id": t.id,
        "ticket": t.ticket,
        "symbol": t.symbol,
        "action": t.action,
        "lot_size": t.lot_size,
        "entry_price": t.entry_price,
        "close_price": t.close_price,
        "stop_loss": t.stop_loss,
        "take_profit": t.take_profit,
        "profit": t.profit,
        "pips": t.pips,
        "status": t.status,
        "open_time": t.open_time.isoformat() if t.open_time else None,
        "close_time": t.close_time.isoformat() if t.close_time else None,
    }

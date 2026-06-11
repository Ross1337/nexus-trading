from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from api.database import get_db
from api.models.strategy import Strategy
from api.auth import get_current_user

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    enabled: bool = True
    risk_per_trade: float = 1.0
    max_trades: int = 5
    allowed_symbols: Optional[str] = None
    allowed_sessions: Optional[str] = None


@router.get("/")
async def list_strategies(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Strategy))
    return [_to_dict(s) for s in result.scalars().all()]


@router.post("/")
async def create_strategy(body: StrategyCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    s = Strategy(**body.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _to_dict(s)


@router.put("/{strategy_id}")
async def update_strategy(strategy_id: int, body: StrategyCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Strategy not found")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    await db.commit()
    return _to_dict(s)


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Strategy not found")
    await db.delete(s)
    await db.commit()
    return {"ok": True}


def _to_dict(s: Strategy) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "enabled": s.enabled,
        "risk_per_trade": s.risk_per_trade,
        "max_trades": s.max_trades,
        "allowed_symbols": s.allowed_symbols,
        "allowed_sessions": s.allowed_sessions,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

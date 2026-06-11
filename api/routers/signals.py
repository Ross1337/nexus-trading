from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from api.database import get_db
from api.models.signal import Signal
from api.auth import get_current_user

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("/")
async def list_signals(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(Signal).order_by(desc(Signal.id)).offset(offset).limit(limit))
    items = result.scalars().all()
    return [_signal_dict(s) for s in items]


@router.get("/{signal_id}")
async def get_signal(signal_id: int, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Signal).where(Signal.id == signal_id))
    s = result.scalar_one_or_none()
    if not s:
        from fastapi import HTTPException
        raise HTTPException(404, "Signal not found")
    return _signal_dict(s)


def _signal_dict(s: Signal) -> dict:
    return {
        "id": s.id,
        "source": s.source,
        "symbol": s.symbol,
        "action": s.action,
        "lot_size": s.lot_size,
        "stop_loss": s.stop_loss,
        "take_profit": s.take_profit,
        "entry_price": s.entry_price,
        "status": s.status,
        "reject_reason": s.reject_reason,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

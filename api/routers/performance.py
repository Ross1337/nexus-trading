from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from api.database import get_db
from api.models.trade import Trade
from api.auth import get_current_user

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/summary")
async def performance_summary(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Trade).where(Trade.status == "closed"))
    trades = result.scalars().all()
    if not trades:
        return {"total_trades": 0, "wins": 0, "losses": 0, "winrate": 0, "total_profit": 0, "profit_factor": 0, "avg_rr": 0}

    wins = [t for t in trades if (t.profit or 0) > 0]
    losses = [t for t in trades if (t.profit or 0) <= 0]
    total_profit = sum(t.profit or 0 for t in trades)
    gross_profit = sum(t.profit for t in wins if t.profit)
    gross_loss = abs(sum(t.profit for t in losses if t.profit))
    winrate = len(wins) / len(trades) * 100
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

    return {
        "total_trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "winrate": round(winrate, 2),
        "total_profit": round(total_profit, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "profit_factor": round(profit_factor, 2),
    }


@router.get("/by-strategy")
async def performance_by_strategy(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Trade).where(Trade.status == "closed"))
    trades = result.scalars().all()
    by_strategy: dict = {}
    for t in trades:
        key = t.strategy_id or 0
        if key not in by_strategy:
            by_strategy[key] = {"trades": 0, "profit": 0, "wins": 0}
        by_strategy[key]["trades"] += 1
        by_strategy[key]["profit"] += t.profit or 0
        if (t.profit or 0) > 0:
            by_strategy[key]["wins"] += 1
    return [{"strategy_id": k, **v, "winrate": round(v["wins"] / v["trades"] * 100, 2)} for k, v in by_strategy.items()]


@router.get("/equity-curve")
async def equity_curve(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(
        select(Trade).where(Trade.status == "closed").order_by(Trade.close_time)
    )
    trades = result.scalars().all()
    equity = 0.0
    curve = []
    for t in trades:
        equity += t.profit or 0
        curve.append({
            "time": t.close_time.isoformat() if t.close_time else None,
            "equity": round(equity, 2),
            "profit": round(t.profit or 0, 2),
            "symbol": t.symbol,
        })
    return curve

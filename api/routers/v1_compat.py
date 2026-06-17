"""
V1 compatibility routes — fills in endpoints the V1 panel calls but that don't
exist in the V2 backend yet. Keeps the V1 frontend happy without forking the UI.

All routes are safe stubs returning sensible default shapes the V1 frontend
expects (empty arrays, zeros).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from api.database import get_db
from api.auth import get_current_user

router = APIRouter(tags=["v1_compat"])


# ---------- /api/performance/ (root) -----------------------------------------


@router.get("/api/performance/")
async def performance_root(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """V1 frontend hits the root — return summary stats."""
    from api.models.trade import Trade

    result = await db.execute(select(Trade).where(Trade.status == "closed"))
    trades = result.scalars().all()
    if not trades:
        return {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "winrate": 0.0,
            "total_profit": 0.0,
            "profit_factor": 0.0,
            "avg_rr": 0.0,
            "equity": 0.0,
            "drawdown": 0.0,
        }
    wins = [t for t in trades if (t.profit or 0) > 0]
    losses = [t for t in trades if (t.profit or 0) <= 0]
    total_profit = sum(t.profit or 0 for t in trades)
    gross_profit = sum(t.profit for t in wins if t.profit)
    gross_loss = abs(sum(t.profit for t in losses if t.profit))
    winrate = len(wins) / len(trades) * 100 if trades else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    return {
        "total_trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "winrate": winrate,
        "total_profit": total_profit,
        "profit_factor": profit_factor,
        "avg_rr": 0.0,
        "equity": total_profit,
        "drawdown": 0.0,
    }


# ---------- /api/trades/equity-history & daily-pnl ---------------------------


@router.get("/api/trades/equity-history")
async def equity_history(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Return equity over time. Format: [{date, equity}, ...]."""
    from api.models.trade import Trade

    result = await db.execute(
        select(Trade).where(Trade.status == "closed").order_by(Trade.close_time)
    )
    trades = result.scalars().all()
    if not trades:
        return []
    out: list[dict] = []
    running = 0.0
    for t in trades:
        running += float(t.profit or 0)
        out.append({
            "date": (t.close_time or t.open_time or datetime.utcnow()).isoformat(),
            "equity": round(running, 2),
        })
    return out


@router.get("/api/trades/daily-pnl")
async def daily_pnl(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Return P&L per day for the last 30 days. Format: [{date, pnl}, ...]."""
    from api.models.trade import Trade

    cutoff = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(Trade).where(Trade.status == "closed").where(Trade.close_time >= cutoff)
    )
    trades = result.scalars().all()
    buckets: dict[str, float] = {}
    for t in trades:
        d = (t.close_time or t.open_time)
        if not d:
            continue
        key = d.date().isoformat()
        buckets[key] = buckets.get(key, 0.0) + float(t.profit or 0)
    return [{"date": k, "pnl": round(v, 2)} for k, v in sorted(buckets.items())]


# ---------- /api/test/symbols ------------------------------------------------


@router.get("/api/test/symbols")
async def test_symbols(_: dict = Depends(get_current_user)):
    """Return the broker symbol catalog used by the test page.

    Shape expected by the V1 frontend: `{ symbols: ["EURUSD+", ...] }`.
    """
    symbols = [
        "EURUSD+", "GBPUSD+", "USDJPY+", "AUDCAD+", "USDCAD+", "EURGBP+",
        "BTCUSD", "ETHUSD", "XAUUSD+", "XAGUSD+",
        "US30", "NAS100", "SPX500", "GER40",
    ]
    return {"symbols": symbols}

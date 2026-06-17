from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from api.database import get_db
from api.models.trading_plan import TradingPlan
from api.auth import get_current_user

router = APIRouter(prefix="/api/trading-plan", tags=["trading_plan"])


class PlanUpdate(BaseModel):
    """Accepts BOTH V1 and V2 field names."""
    name: Optional[str] = None
    be_enabled: Optional[bool] = None
    be_trigger_pips: Optional[float] = None
    be_offset_pips: Optional[float] = None
    trailing_enabled: Optional[bool] = None
    trailing_step_pips: Optional[float] = None
    trailing_distance_pips: Optional[float] = None
    partial_tp_enabled: Optional[bool] = None
    partial_tp_percent: Optional[float] = None
    partial_tp_rr: Optional[float] = None
    propfirm_enabled: Optional[bool] = None
    max_daily_drawdown_pct: Optional[float] = None
    max_total_drawdown_pct: Optional[float] = None
    max_daily_loss_usd: Optional[float] = None
    profit_target_pct: Optional[float] = None
    max_risk_per_trade_pct: Optional[float] = None
    max_open_trades: Optional[int] = None
    max_lot_size: Optional[float] = None
    notes: Optional[str] = None
    # V1 aliases
    max_risk_per_trade: Optional[float] = None
    max_total_drawdown: Optional[float] = None
    max_open_positions: Optional[int] = None
    trading_hours_bypass: Optional[bool] = None

    model_config = {"extra": "allow"}


def _to_dict(p: TradingPlan) -> dict:
    return {
        # V2 canonical
        "id": p.id,
        "name": p.name,
        "be_enabled": p.be_enabled,
        "be_trigger_pips": p.be_trigger_pips,
        "be_offset_pips": p.be_offset_pips,
        "trailing_enabled": p.trailing_enabled,
        "trailing_step_pips": p.trailing_step_pips,
        "trailing_distance_pips": p.trailing_distance_pips,
        "partial_tp_enabled": p.partial_tp_enabled,
        "partial_tp_percent": p.partial_tp_percent,
        "partial_tp_rr": p.partial_tp_rr,
        "propfirm_enabled": p.propfirm_enabled,
        "max_daily_drawdown_pct": p.max_daily_drawdown_pct,
        "max_total_drawdown_pct": p.max_total_drawdown_pct,
        "max_daily_loss_usd": p.max_daily_loss_usd,
        "profit_target_pct": p.profit_target_pct,
        "max_risk_per_trade_pct": p.max_risk_per_trade_pct,
        "max_open_trades": p.max_open_trades,
        "max_lot_size": p.max_lot_size,
        "notes": p.notes,
        # V1 aliases (so the V1 frontend renders without crashing)
        "max_risk_per_trade": p.max_risk_per_trade_pct,
        "max_total_drawdown": p.max_total_drawdown_pct,
        "max_open_positions": p.max_open_trades,
        "trading_hours_bypass": True,
        "trading_hours_start": "00:00",
        "trading_hours_end": "23:59",
    }


@router.get("/")
async def get_plan(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(TradingPlan).limit(1))
    plan = result.scalar_one_or_none()
    if not plan:
        plan = TradingPlan(name="default")
        db.add(plan)
        await db.commit()
        await db.refresh(plan)
    return _to_dict(plan)


@router.put("/")
async def update_plan(
    body: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(TradingPlan).limit(1))
    plan = result.scalar_one_or_none()
    if not plan:
        plan = TradingPlan(name="default")
        db.add(plan)

    data = body.model_dump(exclude_none=True)

    # Translate V1 aliases -> V2 column names
    if "max_risk_per_trade" in data:
        data["max_risk_per_trade_pct"] = float(data.pop("max_risk_per_trade"))
    if "max_total_drawdown" in data:
        data["max_total_drawdown_pct"] = float(data.pop("max_total_drawdown"))
    if "max_open_positions" in data:
        data["max_open_trades"] = int(data.pop("max_open_positions"))
    # trading_hours_* are not persisted (no columns yet) — just drop
    for k in ("trading_hours_bypass", "trading_hours_start", "trading_hours_end"):
        data.pop(k, None)

    for k, v in data.items():
        if hasattr(plan, k):
            setattr(plan, k, v)

    await db.commit()
    await db.refresh(plan)
    return _to_dict(plan)

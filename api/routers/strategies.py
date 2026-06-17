from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, Any
from api.database import get_db
from api.models.strategy import Strategy
from api.auth import get_current_user

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


# ---------- helpers ------------------------------------------------------------


def _split_csv(s: Optional[str]) -> list[str]:
    if not s:
        return []
    return [x.strip() for x in s.split(",") if x.strip()]


def _join_csv(items: Optional[list[str] | str]) -> Optional[str]:
    if items is None:
        return None
    if isinstance(items, str):
        return items
    return ",".join(items) if items else None


def _normalize_payload(body: dict) -> dict:
    """Accept both V1 (symbols/timeframes/is_active/strategy_id) and V2 schemas.

    The V1 panel sends:
      { strategy_id, name, description, symbols: [...], timeframes: [...] }
    We translate it to the V2 columns the DB actually uses.
    """
    out: dict[str, Any] = {}
    # name
    if "name" in body:
        out["name"] = body["name"]
    if "description" in body:
        out["description"] = body["description"]
    # enabled / is_active alias
    if "is_active" in body and "enabled" not in body:
        out["enabled"] = bool(body["is_active"])
    elif "enabled" in body:
        out["enabled"] = bool(body["enabled"])
    # numeric fields
    for k in ("risk_per_trade", "max_trades"):
        if k in body and body[k] is not None:
            out[k] = body[k]
    # symbols alias -> allowed_symbols (CSV string)
    if "symbols" in body:
        out["allowed_symbols"] = _join_csv(body["symbols"])
    elif "allowed_symbols" in body:
        out["allowed_symbols"] = body["allowed_symbols"]
    # timeframes -> stored in allowed_sessions (text) to avoid DB migration
    if "timeframes" in body:
        out["allowed_sessions"] = _join_csv(body["timeframes"])
    elif "allowed_sessions" in body:
        out["allowed_sessions"] = body["allowed_sessions"]
    return out


def _to_dict(s: Strategy) -> dict:
    """Return both V1 and V2 field names so old/new frontends both work."""
    symbols = _split_csv(s.allowed_symbols)
    timeframes = _split_csv(s.allowed_sessions)
    return {
        # V2 canonical
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "enabled": s.enabled,
        "risk_per_trade": s.risk_per_trade,
        "max_trades": s.max_trades,
        "allowed_symbols": s.allowed_symbols,
        "allowed_sessions": s.allowed_sessions,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        # V1 aliases (so the V1 panel renders without crashing)
        "strategy_id": str(s.id),
        "is_active": s.enabled,
        "symbols": symbols,
        "timeframes": timeframes,
    }


# ---------- schemas -----------------------------------------------------------


class StrategyPayload(BaseModel):
    """Accept anything — payload normalization happens in _normalize_payload."""
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    strategy_id: Optional[str] = None
    risk_per_trade: Optional[float] = None
    max_trades: Optional[int] = None
    allowed_symbols: Optional[str] = None
    allowed_sessions: Optional[str] = None
    symbols: Optional[list[str]] = None
    timeframes: Optional[list[str]] = None

    model_config = {"extra": "allow"}


# ---------- helpers for ID lookup --------------------------------------------


async def _get_strategy(db: AsyncSession, ident: str) -> Optional[Strategy]:
    """Look up a strategy by integer id OR string strategy_id (which is just str(id) for V1 compat)."""
    try:
        ident_int = int(ident)
    except (TypeError, ValueError):
        return None
    result = await db.execute(select(Strategy).where(Strategy.id == ident_int))
    return result.scalar_one_or_none()


# ---------- routes ------------------------------------------------------------


@router.get("/")
async def list_strategies(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(Strategy))
    return [_to_dict(s) for s in result.scalars().all()]


@router.post("/")
async def create_strategy(
    body: StrategyPayload,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    payload = _normalize_payload(body.model_dump(exclude_none=True))
    if "name" not in payload or not payload["name"]:
        raise HTTPException(422, "Field 'name' is required")
    s = Strategy(**payload)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _to_dict(s)


@router.put("/{strategy_id}")
async def update_strategy(
    strategy_id: str,
    body: StrategyPayload,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    s = await _get_strategy(db, strategy_id)
    if not s:
        raise HTTPException(404, "Strategy not found")
    payload = _normalize_payload(body.model_dump(exclude_none=True))
    for k, v in payload.items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return _to_dict(s)


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    s = await _get_strategy(db, strategy_id)
    if not s:
        raise HTTPException(404, "Strategy not found")
    await db.delete(s)
    await db.commit()
    return {"ok": True}


# ---------- per-strategy trading plan stub -----------------------------------
# The V1 panel queries /api/strategies/{id}/trading-plan for each strategy.
# We have a single global trading plan in V2 — expose it under each strategy id
# so the panel doesn't 404 (the global /api/trading-plan/ remains the source of truth).


@router.get("/{strategy_id}/trading-plan")
async def get_strategy_trading_plan(
    strategy_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Return the global trading plan, mapped to V1 field names."""
    from api.models.trading_plan import TradingPlan

    result = await db.execute(select(TradingPlan).limit(1))
    plan = result.scalar_one_or_none()
    if not plan:
        # Return defaults so the V1 frontend can still render the strategy card.
        return {
            "strategy_id": strategy_id,
            "max_risk_per_trade": 2.0,
            "max_total_drawdown": 10.0,
            "max_open_positions": 10,
            "trading_hours_bypass": True,
            "trading_hours_start": "00:00",
            "trading_hours_end": "23:59",
        }
    return {
        "strategy_id": strategy_id,
        "max_risk_per_trade": plan.max_risk_per_trade_pct,
        "max_total_drawdown": plan.max_total_drawdown_pct,
        "max_open_positions": plan.max_open_trades,
        "trading_hours_bypass": True,
        "trading_hours_start": "00:00",
        "trading_hours_end": "23:59",
    }


@router.put("/{strategy_id}/trading-plan")
async def update_strategy_trading_plan(
    strategy_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Forward updates to the global trading plan (single-plan deployment)."""
    from api.models.trading_plan import TradingPlan

    result = await db.execute(select(TradingPlan).limit(1))
    plan = result.scalar_one_or_none()
    if not plan:
        plan = TradingPlan(name="default")
        db.add(plan)

    # Translate V1 -> V2 column names
    if "max_risk_per_trade" in body:
        plan.max_risk_per_trade_pct = float(body["max_risk_per_trade"])
    if "max_total_drawdown" in body:
        plan.max_total_drawdown_pct = float(body["max_total_drawdown"])
    if "max_open_positions" in body:
        plan.max_open_trades = int(body["max_open_positions"])

    await db.commit()
    return await get_strategy_trading_plan(strategy_id, db, {"sub": "x"})

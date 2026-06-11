import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from api.database import get_db
from api.models.symbol_rule import SymbolRule
from api.auth import get_current_user
from api.services.symbol_normalizer import normalize_symbol

router = APIRouter(prefix="/api/symbol-rules", tags=["symbol_rules"])


class RuleCreate(BaseModel):
    input_pattern: str
    output_symbol: str
    enabled: bool = True
    description: Optional[str] = None


@router.get("/")
async def list_rules(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(SymbolRule))
    return [_to_dict(r) for r in result.scalars().all()]


@router.post("/")
async def create_rule(body: RuleCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    r = SymbolRule(**body.model_dump())
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _to_dict(r)


@router.put("/{rule_id}")
async def update_rule(rule_id: int, body: RuleCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(SymbolRule).where(SymbolRule.id == rule_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Rule not found")
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    await db.commit()
    return _to_dict(r)


@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(SymbolRule).where(SymbolRule.id == rule_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Rule not found")
    await db.delete(r)
    await db.commit()
    return {"ok": True}


@router.post("/test")
async def test_rule(body: dict, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    raw = body.get("symbol", "")
    normalized = await normalize_symbol(raw, db)
    return {"input": raw, "output": normalized}


@router.post("/seed")
async def seed_rules(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    try:
        with open("config/symbol_rules.default.json") as f:
            rules = json.load(f)
    except FileNotFoundError:
        raise HTTPException(404, "Default rules file not found")
    count = 0
    for r in rules:
        existing = await db.execute(
            select(SymbolRule).where(SymbolRule.input_pattern == r["input_pattern"])
        )
        if not existing.scalar_one_or_none():
            db.add(SymbolRule(**r))
            count += 1
    await db.commit()
    return {"seeded": count}


def _to_dict(r: SymbolRule) -> dict:
    return {
        "id": r.id,
        "input_pattern": r.input_pattern,
        "output_symbol": r.output_symbol,
        "enabled": r.enabled,
        "description": r.description,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from api.database import get_db
from api.models.account import Account
from api.auth import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountCreate(BaseModel):
    name: str
    login: str
    password: str
    server: str
    mode: str = "demo"
    enabled: bool = True
    magic_number: int = 0
    max_lot: str = "1.0"


@router.get("/")
async def list_accounts(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Account))
    return [_to_dict(a) for a in result.scalars().all()]


@router.post("/")
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    a = Account(**body.model_dump())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _to_dict(a)


@router.put("/{account_id}")
async def update_account(account_id: int, body: AccountCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Account not found")
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    await db.commit()
    return _to_dict(a)


@router.delete("/{account_id}")
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Account not found")
    await db.delete(a)
    await db.commit()
    return {"ok": True}


def _to_dict(a: Account) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "login": a.login,
        "server": a.server,
        "mode": a.mode,
        "enabled": a.enabled,
        "magic_number": a.magic_number,
        "max_lot": a.max_lot,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }

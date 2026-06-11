import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional
from api.auth import get_current_user
from api.config import settings

router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderRequest(BaseModel):
    symbol: str
    action: str  # buy | sell
    lot_size: float
    stop_loss: float  # required
    take_profit: Optional[float] = None
    entry_price: Optional[float] = None
    comment: Optional[str] = None

    @field_validator("stop_loss")
    @classmethod
    def sl_required(cls, v):
        if v is None or v <= 0:
            raise ValueError("stop_loss is required and must be > 0")
        return v

    @field_validator("action")
    @classmethod
    def action_valid(cls, v):
        if v.lower() not in ("buy", "sell"):
            raise ValueError("action must be buy or sell")
        return v.lower()


@router.post("/")
async def place_order(body: OrderRequest, _: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.MT5_CONNECTOR_URL}/order",
                json=body.model_dump(),
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"MT5 error: {resp.text}")
            return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

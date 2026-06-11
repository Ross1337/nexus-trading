import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from api.auth import get_current_user
from api.config import settings

router = APIRouter(prefix="/api/mt5", tags=["mt5"])


async def _mt5_get(path: str, params: dict = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(f"{settings.MT5_CONNECTOR_URL}{path}", params=params)
            return resp.json()
    except Exception as e:
        return {"error": str(e)}


@router.get("/account")
async def mt5_account(_: dict = Depends(get_current_user)):
    return await _mt5_get("/account")


@router.get("/prices")
async def mt5_prices(symbols: str = Query(...), _: dict = Depends(get_current_user)):
    return await _mt5_get("/prices", {"symbols": symbols})


@router.get("/price/{symbol}")
async def mt5_price(symbol: str = Path(...), _: dict = Depends(get_current_user)):
    return await _mt5_get(f"/price/{symbol}")


@router.get("/ohlcv/{symbol}")
async def mt5_ohlcv(
    symbol: str = Path(...),
    timeframe: str = Query("H1"),
    count: int = Query(100, le=1000),
    _: dict = Depends(get_current_user),
):
    return await _mt5_get(f"/ohlcv/{symbol}", {"timeframe": timeframe, "count": count})

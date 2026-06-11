"""
HTTP server for MT5 connector — exposes MT5 data and order execution.
"""
import os
import time
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import MetaTrader5 as mt5

START_TIME = time.time()
app = FastAPI(title="NEXUS MT5 Connector", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _is_connected() -> bool:
    info = mt5.account_info()
    return info is not None


@app.get("/health")
def health():
    connected = _is_connected()
    account_ok = False
    btc_ok = False
    terminal_running = False

    import psutil
    for proc in psutil.process_iter(["name"]):
        if proc.info["name"] and "terminal64" in proc.info["name"].lower():
            terminal_running = True
            break

    if connected:
        account_ok = True
        tick = mt5.symbol_info_tick("BTCUSD")
        btc_ok = tick is not None and tick.bid > 0

    return {
        "status": "ok" if connected else "error",
        "mt5_connected": connected,
        "account_ok": account_ok,
        "btc_tick_ok": btc_ok,
        "terminal_running": terminal_running,
        "uptime_seconds": int(time.time() - START_TIME),
        "login": int(os.getenv("MT5_ACCOUNT_0_LOGIN", 0)),
        "server": os.getenv("MT5_ACCOUNT_0_SERVER", ""),
    }


@app.get("/account")
def get_account():
    if not _is_connected():
        raise HTTPException(503, "MT5 not connected")
    info = mt5.account_info()._asdict()
    return {
        "connected": True,
        "login": info["login"],
        "balance": info["balance"],
        "equity": info["equity"],
        "margin": info["margin"],
        "margin_free": info["margin_free"],
        "margin_level": info.get("margin_level", 0),
        "profit": info["profit"],
        "currency": info["currency"],
        "leverage": info["leverage"],
        "server": info["server"],
        "name": info["name"],
    }


@app.get("/positions")
def get_positions():
    if not _is_connected():
        return []
    positions = mt5.positions_get()
    if positions is None:
        return []
    return [
        {
            "ticket": str(p.ticket),
            "symbol": p.symbol,
            "type": "buy" if p.type == 0 else "sell",
            "volume": p.volume,
            "open_price": p.price_open,
            "current_price": p.price_current,
            "sl": p.sl,
            "tp": p.tp,
            "profit": p.profit,
            "swap": p.swap,
            "open_time": datetime.fromtimestamp(p.time).isoformat(),
            "comment": p.comment,
            "magic": p.magic,
        }
        for p in positions
    ]


@app.get("/history")
def get_history(days: int = 7):
    if not _is_connected():
        return []
    from_date = datetime.now() - timedelta(days=days)
    deals = mt5.history_deals_get(from_date, datetime.now())
    if deals is None:
        return []
    return [
        {
            "ticket": str(d.ticket),
            "order": str(d.order),
            "symbol": d.symbol,
            "type": d.type,
            "volume": d.volume,
            "price": d.price,
            "profit": d.profit,
            "commission": d.commission,
            "swap": d.swap,
            "time": datetime.fromtimestamp(d.time).isoformat(),
            "comment": d.comment,
        }
        for d in deals
        if d.profit != 0 or d.symbol
    ]


@app.get("/price/{symbol}")
def get_price(symbol: str):
    if not _is_connected():
        raise HTTPException(503, "MT5 not connected")
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise HTTPException(404, f"Symbol {symbol} not found")
    return {"symbol": symbol, "bid": tick.bid, "ask": tick.ask, "time": tick.time}


@app.get("/prices")
def get_prices(symbols: str):
    syms = [s.strip() for s in symbols.split(",")]
    result = {}
    for sym in syms:
        tick = mt5.symbol_info_tick(sym)
        if tick:
            result[sym] = {"bid": tick.bid, "ask": tick.ask}
        else:
            result[sym] = None
    return result


@app.get("/ohlcv/{symbol}")
def get_ohlcv(symbol: str, timeframe: str = "H1", count: int = 100):
    tf_map = {
        "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1,
    }
    tf = tf_map.get(timeframe.upper(), mt5.TIMEFRAME_H1)
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
    if rates is None:
        return []
    return [
        {
            "time": datetime.fromtimestamp(r["time"]).isoformat(),
            "open": r["open"],
            "high": r["high"],
            "low": r["low"],
            "close": r["close"],
            "volume": int(r["tick_volume"]),
        }
        for r in rates
    ]


class OrderRequest(BaseModel):
    symbol: str
    action: str  # buy | sell | close | closebuy | closesell
    lot_size: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    entry_price: Optional[float] = None
    comment: Optional[str] = "NEXUS"
    magic: Optional[int] = None


@app.post("/order")
def place_order(req: OrderRequest):
    if not _is_connected():
        raise HTTPException(503, "MT5 not connected")

    magic = req.magic or int(os.getenv("MT5_MAGIC_NUMBER", 654321))
    symbol = req.symbol
    action_map = {"buy": mt5.ORDER_TYPE_BUY, "sell": mt5.ORDER_TYPE_SELL}

    if req.action in ("close", "closebuy", "closesell"):
        return _close_by_symbol(symbol, req.action, magic)

    order_type = action_map.get(req.action)
    if order_type is None:
        raise HTTPException(400, f"Unknown action: {req.action}")

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise HTTPException(404, f"Symbol not found: {symbol}")

    price = tick.ask if req.action == "buy" else tick.bid
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": req.lot_size or 0.01,
        "type": order_type,
        "price": price,
        "sl": req.stop_loss or 0.0,
        "tp": req.take_profit or 0.0,
        "deviation": 20,
        "magic": magic,
        "comment": (req.comment or "NEXUS")[:31],
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        err = result.comment if result else "order_send returned None"
        return {"success": False, "error": err, "retcode": result.retcode if result else -1}
    return {"success": True, "ticket": str(result.order), "price": result.price}


def _close_by_symbol(symbol: str, action: str, magic: int) -> dict:
    positions = mt5.positions_get(symbol=symbol)
    if not positions:
        return {"success": False, "error": "No positions found"}
    closed = 0
    for pos in positions:
        if action == "closebuy" and pos.type != 0:
            continue
        if action == "closesell" and pos.type != 1:
            continue
        close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
        tick = mt5.symbol_info_tick(symbol)
        price = tick.bid if pos.type == 0 else tick.ask
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": pos.volume,
            "type": close_type,
            "position": pos.ticket,
            "price": price,
            "deviation": 20,
            "magic": magic,
            "comment": "NEXUS close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            closed += 1
    return {"success": closed > 0, "closed": closed}


class CloseRequest(BaseModel):
    ticket: str
    lot: Optional[float] = None


@app.post("/close")
def close_trade(req: CloseRequest):
    if not _is_connected():
        raise HTTPException(503, "MT5 not connected")
    ticket = int(req.ticket)
    position = mt5.positions_get(ticket=ticket)
    if not position:
        raise HTTPException(404, "Position not found")
    pos = position[0]
    close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
    tick = mt5.symbol_info_tick(pos.symbol)
    price = tick.bid if pos.type == 0 else tick.ask
    volume = req.lot or pos.volume
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": volume,
        "type": close_type,
        "position": ticket,
        "price": price,
        "deviation": 20,
        "magic": pos.magic,
        "comment": "NEXUS close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result and result.retcode == mt5.TRADE_RETCODE_DONE:
        return {"success": True, "ticket": req.ticket}
    return {"success": False, "error": result.comment if result else "error"}


class ModifyRequest(BaseModel):
    ticket: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


@app.post("/modify")
def modify_trade(req: ModifyRequest):
    if not _is_connected():
        raise HTTPException(503, "MT5 not connected")
    ticket = int(req.ticket)
    position = mt5.positions_get(ticket=ticket)
    if not position:
        raise HTTPException(404, "Position not found")
    pos = position[0]
    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": pos.symbol,
        "position": ticket,
        "sl": req.stop_loss or pos.sl,
        "tp": req.take_profit or pos.tp,
    }
    result = mt5.order_send(request)
    if result and result.retcode == mt5.TRADE_RETCODE_DONE:
        return {"success": True}
    return {"success": False, "error": result.comment if result else "error"}

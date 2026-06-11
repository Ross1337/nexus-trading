"""
MT5 Connector V2 — robust startup with terminal detection and retry.
"""
import os
import sys
import time
import asyncio
import subprocess
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [MT5] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/mt5_connector.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

MT5_LOGIN = int(os.getenv("MT5_ACCOUNT_0_LOGIN", 0))
MT5_PASSWORD = os.getenv("MT5_ACCOUNT_0_PASSWORD", "")
MT5_SERVER = os.getenv("MT5_ACCOUNT_0_SERVER", "")
MT5_PORT = int(os.getenv("MT5_CONNECTOR_PORT", 5002))
LOCK_FILE = Path("logs/mt5_connector.lock")

TERMINAL_PATHS = [
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    r"C:\MT5\terminal64.exe",
]


def _terminal_running() -> bool:
    import psutil
    for proc in psutil.process_iter(["name"]):
        if proc.info.get("name") and "terminal64" in proc.info["name"].lower():
            return True
    return False


def _launch_terminal():
    for path in TERMINAL_PATHS:
        if os.path.exists(path):
            log.info(f"Launching MT5 terminal: {path}")
            subprocess.Popen([path])
            return
    log.warning("terminal64.exe not found in known locations")


def _check_lock():
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text().strip())
            import psutil
            if psutil.pid_exists(pid):
                log.error(f"MT5 connector already running (PID {pid}). Exiting.")
                sys.exit(1)
        except Exception:
            pass
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOCK_FILE.write_text(str(os.getpid()))


def _initialize_mt5() -> bool:
    import MetaTrader5 as mt5
    for attempt in range(10):
        delay = min(2 ** attempt, 30)
        log.info(f"MT5 initialize attempt {attempt + 1}/10...")
        if mt5.initialize():
            log.info(f"Logging in: account={MT5_LOGIN}, server={MT5_SERVER}")
            if mt5.login(MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
                info = mt5.account_info()
                if info:
                    log.info(f"Connected: {info.login} @ {info.server} balance={info.balance}")
                    return True
            log.warning(f"Login failed: {mt5.last_error()}")
        else:
            log.warning(f"Initialize failed: {mt5.last_error()}")
        time.sleep(delay)
    return False


async def signal_poller():
    import httpx
    log.info("Signal poller started")
    poll_interval = int(os.getenv("SIGNAL_POLL_INTERVAL", 2))
    while True:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(
                    f"http://localhost:{os.getenv('API_PORT', 8001)}/api/signals/?status=pending&limit=10"
                )
                if resp.status_code == 200:
                    signals = resp.json()
                    if signals:
                        log.debug(f"Found {len(signals)} pending signals")
        except Exception:
            pass
        await asyncio.sleep(poll_interval)


async def position_monitor():
    import httpx
    import MetaTrader5 as mt5
    log.info("Position monitor started")
    while True:
        try:
            positions = mt5.positions_get()
            if positions:
                async with httpx.AsyncClient(timeout=3) as client:
                    await client.post(
                        f"http://localhost:{os.getenv('API_PORT', 8001)}/api/debug/status"
                    )
        except Exception:
            pass
        await asyncio.sleep(5)


async def run_server():
    import uvicorn
    from mt5_connector.http_server import app
    config = uvicorn.Config(app, host="0.0.0.0", port=MT5_PORT, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def main_async():
    await asyncio.gather(
        run_server(),
        signal_poller(),
        position_monitor(),
    )


def main():
    _check_lock()
    Path("logs").mkdir(exist_ok=True)

    # Step 1: Check terminal
    if not _terminal_running():
        log.info("MT5 terminal not running, launching...")
        _launch_terminal()
        log.info("Waiting 30s for MT5 terminal to start...")
        time.sleep(30)

    # Step 2: Initialize MT5
    if not _initialize_mt5():
        log.error("Failed to initialize MT5 after 10 attempts")
        LOCK_FILE.unlink(missing_ok=True)
        sys.exit(1)

    log.info(f"Starting HTTP server on port {MT5_PORT}")
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        log.info("Shutting down MT5 connector")
    finally:
        LOCK_FILE.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

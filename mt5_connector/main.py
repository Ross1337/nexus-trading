"""
MT5 Connector V2 - robust startup with terminal detection and retry.
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
    r"C:\MT5-Nexus\terminal64.exe",
]

# Data dir du terminal (APPDATA) - pour purger les comptes sauvegardes parasites
TERMINAL_DATA_DIR = os.path.expandvars(
    r"%APPDATA%\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075"
)


def _terminal_path():
    for p in TERMINAL_PATHS:
        if os.path.exists(p):
            return p
    return None


def _kill_stale_terminals():
    """Tue les terminaux MT5 zombies (ex: restes d'un autre projet en IPC timeout)."""
    import psutil
    killed = 0
    for proc in psutil.process_iter(["name", "pid"]):
        try:
            if proc.info.get("name") and "terminal64" in proc.info["name"].lower():
                proc.kill()
                killed += 1
        except Exception:
            pass
    if killed:
        log.info(f"Killed {killed} stale terminal64 process(es)")
        time.sleep(3)


def _write_login_config(path: str) -> str:
    """Ecrit un .ini d'auto-login pour forcer le terminal sur NOTRE compte au demarrage."""
    # En mode portable, le data dir = dossier du terminal. On y ecrit le config.
    cfg = Path(path).parent / "config" / "nexus_login.ini"
    cfg.parent.mkdir(parents=True, exist_ok=True)
    content = (
        "[Common]\n"
        f"Login={MT5_LOGIN}\n"
        f"Password={MT5_PASSWORD}\n"
        f"Server={MT5_SERVER}\n"
        "AutoConfiguration=false\n"
        "NewsEnable=false\n"
    )
    cfg.write_text(content, encoding="utf-16le")
    return str(cfg.resolve())


def _purge_saved_accounts():
    """Supprime les comptes sauvegardes parasites pour empecher le terminal de driver
    vers un autre compte. servers.dat (liste serveurs) est conserve."""
    acc = Path(TERMINAL_DATA_DIR) / "config" / "accounts.dat"
    try:
        if acc.exists():
            acc.unlink()
            log.info("Purged saved accounts.dat (anti-drift)")
    except Exception as e:
        log.warning(f"Could not purge accounts.dat: {e}")


def _is_portable(path: str) -> bool:
    return "MT5-Nexus" in path


def _launch_terminal_with_login():
    """Lance le terminal (portable si isole) avec auto-login force sur notre compte."""
    path = _terminal_path()
    if not path:
        log.warning("terminal64.exe introuvable")
        return
    cfg = _write_login_config(path)
    args = [path]
    if _is_portable(path):
        args.append("/portable")
    args.append(f"/config:{cfg}")
    log.info(f"Launching terminal {path} (portable={_is_portable(path)}) -> {MT5_LOGIN} @ {MT5_SERVER}")
    subprocess.Popen(args)
    time.sleep(25)


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
    """Connexion robuste : initialize avec path + identifiants explicites + timeout."""
    import MetaTrader5 as mt5
    path = _terminal_path()
    log.info(f"Terminal path: {path}")
    for attempt in range(10):
        log.info(f"MT5 initialize attempt {attempt + 1}/10 (login={MT5_LOGIN}, server={MT5_SERVER})...")
        try:
            mt5.shutdown()
        except Exception:
            pass
        try:
            if path:
                ok = mt5.initialize(path, login=MT5_LOGIN, password=MT5_PASSWORD,
                                    server=MT5_SERVER, timeout=60000)
            else:
                ok = mt5.initialize(login=MT5_LOGIN, password=MT5_PASSWORD,
                                    server=MT5_SERVER, timeout=60000)
        except Exception as e:
            log.warning(f"initialize() exception: {e}")
            ok = False

        if ok:
            info = mt5.account_info()
            if info and info.login == MT5_LOGIN:
                log.info(f"Connected: {info.login} @ {info.server} balance={info.balance} {info.currency}")
                return True
            # initialise mais mauvais compte -> login explicite
            if mt5.login(MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
                info = mt5.account_info()
                if info:
                    log.info(f"Connected (login): {info.login} @ {info.server} balance={info.balance} {info.currency}")
                    return True
            log.warning(f"Login failed: {mt5.last_error()}")
        else:
            log.warning(f"Initialize failed: {mt5.last_error()}")
        time.sleep(min(2 ** attempt, 30))
    return False


async def _login(client, api_port):
    """Authentifie le connecteur aupres de l'API (cookie access_token persiste dans le client)."""
    email = os.getenv("ADMIN_EMAIL", "")
    password = os.getenv("ADMIN_PASSWORD", "")
    try:
        r = await client.post(
            f"http://localhost:{api_port}/api/auth/login",
            json={"email": email, "password": password},
        )
        if r.status_code == 200:
            log.info("Authenticated with API")
            return True
        log.warning(f"API auth failed: {r.status_code}")
    except Exception as e:
        log.warning(f"API auth error: {e}")
    return False


async def signal_poller():
    import httpx
    log.info("Signal poller started")
    poll_interval = int(os.getenv("SIGNAL_POLL_INTERVAL", 2))
    api_port = os.getenv("API_PORT", "8001")
    # Client persistant (conserve le cookie access_token)
    async with httpx.AsyncClient(timeout=5) as client:
        await _login(client, api_port)
        while True:
            try:
                resp = await client.get(
                    f"http://localhost:{api_port}/api/signals/?status=pending&limit=10"
                )
                if resp.status_code == 401:
                    await _login(client, api_port)
                elif resp.status_code == 200:
                    signals = resp.json()
                    if signals:
                        log.info(f"Found {len(signals)} pending signal(s)")
                        await _execute_signals(signals, client, api_port)
            except Exception:
                pass
            await asyncio.sleep(poll_interval)


async def _execute_signals(signals, client, api_port):
    """Exécute les signaux pending via le HTTP server local /order puis marque executed."""
    import MetaTrader5 as mt5
    for sig in signals:
        try:
            payload = {
                "symbol": sig.get("symbol"),
                "action": (sig.get("direction") or sig.get("action") or "").lower(),
                "lot_size": sig.get("lot_size"),
                "stop_loss": sig.get("stop_loss"),
                "take_profit": sig.get("take_profit"),
                "entry_price": sig.get("entry_price"),
                "comment": sig.get("strategy_id") or "NEXUS",
            }
            r = await client.post(f"http://localhost:{MT5_PORT}/order", json=payload)
            res = r.json()
            new_status = "executed" if res.get("success") else "rejected"
            await client.put(
                f"http://localhost:{api_port}/api/signals/{sig.get('id')}",
                json={"status": new_status},
            )
            log.info(f"Signal {sig.get('id')} {sig.get('symbol')} -> {new_status}")
        except Exception as e:
            log.warning(f"execute signal error: {e}")


async def position_monitor():
    import MetaTrader5 as mt5
    log.info("Position monitor started")
    while True:
        try:
            mt5.positions_get()
        except Exception:
            pass
        await asyncio.sleep(5)


async def account_enforcer():
    """Filet de securite : si le terminal derive vers un autre compte, on re-logge
    immediatement sur le bon. Garantit qu'aucun ordre ne part sur le mauvais compte."""
    import MetaTrader5 as mt5
    log.info("Account enforcer started")
    while True:
        try:
            info = mt5.account_info()
            if info and info.login != MT5_LOGIN:
                log.warning(f"Account drift detected ({info.login}), re-login to {MT5_LOGIN}")
                mt5.login(MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER)
        except Exception:
            pass
        await asyncio.sleep(8)


async def run_server():
    import uvicorn
    from mt5_connector.http_server import app
    config = uvicorn.Config(app, host="0.0.0.0", port=MT5_PORT, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


async def main_async():
    await asyncio.gather(
        run_server(),
        signal_poller(),
        position_monitor(),
        account_enforcer(),
    )


def main():
    _check_lock()
    Path("logs").mkdir(exist_ok=True)

    # Step 1: Nettoyer les terminaux zombies
    _kill_stale_terminals()

    # Step 2: Purger les comptes sauvegardes parasites (anti-drift)
    _purge_saved_accounts()

    # Step 3: Lancer le terminal avec auto-login force sur NOTRE compte
    _launch_terminal_with_login()

    # Step 3: Initialize MT5 (attache au terminal deja logge sur le bon compte)
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

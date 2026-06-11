"""
NEXUS Telegram Bot V2 — commands + automatic alerts.
"""
import asyncio
import logging
import os
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

import httpx
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [TG] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/telegram_bot.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
API_URL = os.getenv("API_BASE_URL", "http://localhost:8001")
MT5_URL = f"http://localhost:{os.getenv('MT5_CONNECTOR_PORT', '5002')}"

_service_states: dict = {}
_last_alert: dict = {}


async def _get(path: str, base: str = None) -> dict | list | None:
    url = (base or API_URL) + path
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 <b>NEXUS Trading Bot V2</b>\n\n"
        "Commandes disponibles:\n"
        "/status — Statut des services\n"
        "/balance — Balance du compte MT5\n"
        "/positions — Positions ouvertes\n"
        "/trades — 5 derniers trades\n"
        "/restart &lt;service&gt; — Redémarrer un service\n"
        "/logs &lt;service&gt; — Dernières lignes de log",
        parse_mode="HTML",
    )


async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    mt5_health = await _get("/health", MT5_URL)
    api_health = await _get("/api/health")

    mt5_icon = "🟢" if mt5_health and mt5_health.get("status") == "ok" else "🔴"
    api_icon = "🟢" if api_health and api_health.get("status") == "ok" else "🔴"
    mt5_conn = mt5_health.get("mt5_connected", False) if mt5_health else False
    uptime = mt5_health.get("uptime_seconds", 0) if mt5_health else 0

    text = (
        f"📊 <b>Statut NEXUS V2</b>\n\n"
        f"{api_icon} API: {'en ligne' if api_health else 'hors ligne'}\n"
        f"{mt5_icon} MT5 Connector: {'en ligne' if mt5_health else 'hors ligne'}\n"
        f"  └ MT5 connecté: {'✅' if mt5_conn else '❌'}\n"
        f"  └ Terminal: {'✅' if mt5_health and mt5_health.get('terminal_running') else '❌'}\n"
        f"  └ Uptime: {uptime}s\n"
    )
    await update.message.reply_text(text, parse_mode="HTML")


async def cmd_balance(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = await _get("/account", MT5_URL)
    if not data or "error" in data:
        await update.message.reply_text("❌ Impossible de récupérer la balance (MT5 déconnecté?)")
        return
    text = (
        f"💰 <b>Compte MT5</b>\n\n"
        f"Login: {data.get('login')}\n"
        f"Serveur: {data.get('server')}\n"
        f"Balance: <b>{data.get('balance', 0):.2f} {data.get('currency', 'USD')}</b>\n"
        f"Equity: <b>{data.get('equity', 0):.2f}</b>\n"
        f"Marge libre: {data.get('margin_free', 0):.2f}\n"
        f"P&L flottant: {data.get('profit', 0):.2f}\n"
        f"Levier: 1:{data.get('leverage', 0)}"
    )
    await update.message.reply_text(text, parse_mode="HTML")


async def cmd_positions(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    positions = await _get("/positions", MT5_URL)
    if not positions:
        await update.message.reply_text("📭 Aucune position ouverte")
        return
    lines = [f"📈 <b>{len(positions)} position(s) ouverte(s)</b>\n"]
    for p in positions[:10]:
        icon = "🟢" if (p.get("profit", 0) >= 0) else "🔴"
        lines.append(
            f"{icon} <b>{p['symbol']}</b> {p['type'].upper()} "
            f"{p['volume']} @ {p['open_price']:.5f}\n"
            f"   P&L: {p['profit']:.2f}$ | SL: {p.get('sl', 0):.5f}"
        )
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def cmd_trades(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = await _get("/api/trades/history?limit=5")
    if not data:
        await update.message.reply_text("📭 Aucun trade dans l'historique")
        return
    lines = [f"📋 <b>5 derniers trades</b>\n"]
    for t in data[:5]:
        icon = "✅" if (t.get("profit") or 0) > 0 else "❌"
        lines.append(
            f"{icon} <b>{t['symbol']}</b> {t['action'].upper()} "
            f"P&L: {t.get('profit', 0):.2f}$"
        )
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def cmd_restart(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /restart <api|mt5|frontend|telegram>")
        return
    service = ctx.args[0].lower()
    service_map = {
        "api": "Nexus-API",
        "mt5": "Nexus-MT5",
        "frontend": "Nexus-Frontend",
        "telegram": "Nexus-Telegram",
    }
    nssm_name = service_map.get(service)
    if not nssm_name:
        await update.message.reply_text(f"Service inconnu: {service}")
        return
    import subprocess
    try:
        result = subprocess.run(
            ["powershell", "-Command", f"Restart-Service {nssm_name}"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            await update.message.reply_text(f"✅ Service {nssm_name} redémarré")
        else:
            await update.message.reply_text(f"❌ Erreur: {result.stderr[:500]}")
    except Exception as e:
        await update.message.reply_text(f"❌ Exception: {e}")


async def cmd_logs(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /logs <api|mt5|telegram>")
        return
    service = ctx.args[0].lower()
    log_files = {"api": "logs/api.log", "mt5": "logs/mt5_connector.log", "telegram": "logs/telegram_bot.log"}
    path = log_files.get(service)
    if not path or not os.path.exists(path):
        await update.message.reply_text(f"Log file not found for {service}")
        return
    with open(path) as f:
        lines = f.readlines()[-20:]
    text = f"📄 <b>Logs {service} (20 dernières lignes)</b>\n\n<pre>{''.join(lines)[-3000:]}</pre>"
    await update.message.reply_text(text, parse_mode="HTML")


async def monitoring_task(app: Application):
    """Background monitoring — sends alerts on service down/recovery."""
    service_failures = {"mt5": 0, "api": 0}
    service_last_restart = {"mt5": 0, "api": 0}
    COOLDOWN = 300  # 5 min

    while True:
        await asyncio.sleep(60)
        if not CHAT_ID:
            continue

        # Check MT5
        mt5_health = await _get("/health", MT5_URL)
        if not mt5_health or mt5_health.get("status") != "ok":
            service_failures["mt5"] += 1
            was_ok = _service_states.get("mt5", True)
            _service_states["mt5"] = False
            if service_failures["mt5"] == 3:
                await app.bot.send_message(
                    chat_id=CHAT_ID,
                    text=f"🚨 MT5 Connector DOWN depuis {service_failures['mt5']} min",
                    parse_mode="HTML",
                )
        else:
            was_down = not _service_states.get("mt5", True)
            _service_states["mt5"] = True
            if was_down and service_failures["mt5"] > 0:
                await app.bot.send_message(
                    chat_id=CHAT_ID,
                    text="✅ MT5 Connector de nouveau en ligne",
                    parse_mode="HTML",
                )
            service_failures["mt5"] = 0

        # Check API
        api_health = await _get("/api/health")
        if not api_health:
            service_failures["api"] += 1
            _service_states["api"] = False
            if service_failures["api"] == 3:
                await app.bot.send_message(
                    chat_id=CHAT_ID,
                    text="🚨 API NEXUS DOWN depuis 3 min",
                    parse_mode="HTML",
                )
        else:
            was_down = not _service_states.get("api", True)
            _service_states["api"] = True
            if was_down and service_failures["api"] > 0:
                await app.bot.send_message(
                    chat_id=CHAT_ID,
                    text="✅ API NEXUS de nouveau en ligne",
                    parse_mode="HTML",
                )
            service_failures["api"] = 0


def main():
    if not BOT_TOKEN:
        log.error("TELEGRAM_BOT_TOKEN not set — bot disabled")
        return

    log.info("Starting NEXUS Telegram Bot V2")
    app_builder = Application.builder().token(BOT_TOKEN)
    application = app_builder.build()

    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("status", cmd_status))
    application.add_handler(CommandHandler("balance", cmd_balance))
    application.add_handler(CommandHandler("positions", cmd_positions))
    application.add_handler(CommandHandler("trades", cmd_trades))
    application.add_handler(CommandHandler("restart", cmd_restart))
    application.add_handler(CommandHandler("logs", cmd_logs))

    application.job_queue.run_repeating(
        lambda ctx: asyncio.ensure_future(monitoring_task(application)),
        interval=60,
        first=10,
    )

    application.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()

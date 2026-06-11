import httpx
from api.config import settings


async def send_telegram(message: str) -> bool:
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            )
            return resp.status_code == 200
    except Exception:
        return False


async def send_discord(message: str) -> bool:
    url = settings.DISCORD_WEBHOOK_URL
    if not url:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"content": message})
            return resp.status_code in (200, 204)
    except Exception:
        return False


async def notify(message: str) -> None:
    await send_telegram(message)
    await send_discord(message)

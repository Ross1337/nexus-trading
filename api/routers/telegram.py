from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import get_current_user
from api.services.notification import send_telegram

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


class TelegramMessage(BaseModel):
    message: str


@router.post("/send")
async def send_message(body: TelegramMessage, _: dict = Depends(get_current_user)):
    ok = await send_telegram(body.message)
    return {"ok": ok}

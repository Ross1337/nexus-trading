from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from api.database import get_db
from api.models.webhook_log import WebhookLog
from api.auth import get_current_user

router = APIRouter(prefix="/api/webhook-logs", tags=["webhook_logs"])


@router.get("/")
async def list_logs(
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    source: str = Query(None),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    q = select(WebhookLog).order_by(desc(WebhookLog.id)).offset(offset).limit(limit)
    if source:
        q = q.where(WebhookLog.source == source)
    result = await db.execute(q)
    return [_to_dict(l) for l in result.scalars().all()]


@router.delete("/")
async def clear_logs(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_user)):
    await db.execute(delete(WebhookLog))
    await db.commit()
    return {"ok": True}


def _to_dict(l: WebhookLog) -> dict:
    return {
        "id": l.id,
        "source": l.source,
        "ip_address": l.ip_address,
        "status": l.status,
        "error_message": l.error_message,
        "signal_id": l.signal_id,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }

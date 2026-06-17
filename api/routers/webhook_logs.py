from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete, func
from datetime import datetime, timedelta
from collections import Counter
from api.database import get_db
from api.models.webhook_log import WebhookLog
from api.auth import get_current_user

router = APIRouter(prefix="/api/webhook-logs", tags=["webhook_logs"])


def _to_summary(l: WebhookLog) -> dict:
    """Map WebhookLog row to the WebhookLogSummary shape expected by the frontend."""
    # Endpoint derived from source
    endpoint_map = {
        "tradingview": "/api/webhook/tradingview",
        "pineconnector": "/api/webhook/pineconnector",
    }
    # status_code derived from status string
    status_to_code = {
        "received": 200,
        "processed": 200,
        "rejected": 400,
        "error": 500,
    }
    body_preview = None
    if l.payload:
        body_preview = l.payload[:200] if len(l.payload) > 200 else l.payload
    return {
        "id": l.id,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "client_ip": l.ip_address or "",
        "method": "POST",
        "endpoint": endpoint_map.get(l.source, f"/api/webhook/{l.source}") if l.source else "",
        "status_code": status_to_code.get(l.status, 200),
        "symbol": None,
        "direction": None,
        "signal_id": l.signal_id,
        "error_message": l.error_message,
        "processing_time_ms": None,
        "body_preview": body_preview,
    }


def _to_detail(l: WebhookLog) -> dict:
    base = _to_summary(l)
    base.update({
        "headers": {},
        "body_raw": l.payload,
        "body_parsed": None,
        "response": None,
    })
    return base


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
    return [_to_summary(l) for l in result.scalars().all()]


@router.get("/stats")
async def get_stats(
    since_hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Stats over the last N hours, matching the WebhookLogStats shape expected by the frontend."""
    cutoff = datetime.utcnow() - timedelta(hours=since_hours)
    q = select(WebhookLog).where(WebhookLog.created_at >= cutoff)
    result = await db.execute(q)
    rows = result.scalars().all()

    summaries = [_to_summary(r) for r in rows]
    total = len(summaries)
    success = sum(1 for s in summaries if 200 <= s["status_code"] < 300)
    rejected = sum(1 for s in summaries if s["status_code"] >= 400)

    by_status_code: dict[str, int] = {}
    for s in summaries:
        code = str(s["status_code"])
        by_status_code[code] = by_status_code.get(code, 0) + 1

    ip_counter = Counter(s["client_ip"] for s in summaries if s["client_ip"])
    top_ips = [{"ip": ip, "count": n} for ip, n in ip_counter.most_common(10)]

    return {
        "since_hours": since_hours,
        "total": total,
        "success": success,
        "rejected": rejected,
        "by_status_code": by_status_code,
        "top_ips": top_ips,
    }


@router.get("/{log_id}")
async def get_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    result = await db.execute(select(WebhookLog).where(WebhookLog.id == log_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Webhook log not found")
    return _to_detail(row)


@router.delete("/")
async def clear_logs(
    older_than_days: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Delete logs. If older_than_days is provided (>0), only delete logs older than that."""
    if older_than_days > 0:
        cutoff = datetime.utcnow() - timedelta(days=older_than_days)
        result = await db.execute(
            delete(WebhookLog).where(WebhookLog.created_at < cutoff)
        )
    else:
        result = await db.execute(delete(WebhookLog))
    await db.commit()
    return {"deleted": result.rowcount or 0}

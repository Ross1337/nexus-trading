from sqlalchemy import Column, Integer, String, DateTime, Text, func
from api.database import Base


class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), nullable=False)  # tradingview | pineconnector
    ip_address = Column(String(50), nullable=True)
    payload = Column(Text, nullable=True)
    status = Column(String(20), default="received")  # received | processed | rejected | error
    signal_id = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

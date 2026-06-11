from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, func
from api.database import Base


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True)
    risk_per_trade = Column(Float, default=1.0)  # percent
    max_trades = Column(Integer, default=5)
    allowed_symbols = Column(Text, nullable=True)  # comma-separated
    allowed_sessions = Column(Text, nullable=True)  # london,newyork,asia
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

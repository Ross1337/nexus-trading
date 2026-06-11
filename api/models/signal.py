from sqlalchemy import Column, Integer, String, Float, DateTime, Text, func
from api.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), default="tradingview")  # tradingview | pineconnector | manual
    symbol = Column(String(30), nullable=False)
    action = Column(String(10), nullable=False)  # buy | sell | close | closebuy | closesell
    lot_size = Column(Float, nullable=True)
    entry_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    strategy_id = Column(Integer, nullable=True)
    raw_payload = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending | executed | rejected | error
    reject_reason = Column(Text, nullable=True)
    account_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

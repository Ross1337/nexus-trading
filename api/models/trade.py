from sqlalchemy import Column, Integer, String, Float, DateTime, Text, func
from api.database import Base


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    ticket = Column(String(50), nullable=True, index=True)
    symbol = Column(String(30), nullable=False)
    action = Column(String(10), nullable=False)  # buy | sell
    lot_size = Column(Float, nullable=False)
    entry_price = Column(Float, nullable=True)
    close_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    profit = Column(Float, nullable=True)
    pips = Column(Float, nullable=True)
    strategy_id = Column(Integer, nullable=True)
    account_id = Column(Integer, nullable=True)
    signal_id = Column(Integer, nullable=True)
    status = Column(String(20), default="open")  # open | closed | cancelled
    open_time = Column(DateTime, nullable=True)
    close_time = Column(DateTime, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

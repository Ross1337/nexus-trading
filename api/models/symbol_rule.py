from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from api.database import Base


class SymbolRule(Base):
    __tablename__ = "symbol_rules"

    id = Column(Integer, primary_key=True, index=True)
    input_pattern = Column(String(100), nullable=False)   # e.g. "OANDA:EURUSD", "BTCUSDT"
    output_symbol = Column(String(50), nullable=False)    # e.g. "EURUSD", "BTCUSD"
    enabled = Column(Boolean, default=True)
    description = Column(String(200), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

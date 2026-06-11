from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, func
from api.database import Base


class TradingPlan(Base):
    __tablename__ = "trading_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, default="default")
    # Breakeven
    be_enabled = Column(Boolean, default=False)
    be_trigger_pips = Column(Float, default=20.0)
    be_offset_pips = Column(Float, default=2.0)
    # Trailing stop
    trailing_enabled = Column(Boolean, default=False)
    trailing_step_pips = Column(Float, default=10.0)
    trailing_distance_pips = Column(Float, default=20.0)
    # Partial TP
    partial_tp_enabled = Column(Boolean, default=False)
    partial_tp_percent = Column(Float, default=50.0)
    partial_tp_rr = Column(Float, default=1.0)
    # Propfirm rules
    propfirm_enabled = Column(Boolean, default=False)
    max_daily_drawdown_pct = Column(Float, default=5.0)
    max_total_drawdown_pct = Column(Float, default=10.0)
    max_daily_loss_usd = Column(Float, nullable=True)
    profit_target_pct = Column(Float, nullable=True)
    # Global risk
    max_risk_per_trade_pct = Column(Float, default=2.0)
    max_open_trades = Column(Integer, default=10)
    max_lot_size = Column(Float, default=10.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

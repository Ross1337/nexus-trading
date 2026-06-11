from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from api.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    login = Column(String(50), nullable=False)
    password = Column(String(200), nullable=False)
    server = Column(String(100), nullable=False)
    mode = Column(String(20), default="demo")  # demo | live | propfirm
    enabled = Column(Boolean, default=True)
    magic_number = Column(Integer, default=0)
    max_lot = Column(String(20), default="1.0")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String(50), unique=True, index=True, nullable=False)
    username = Column(String(100), nullable=False)
    global_name = Column(String(100), nullable=True)
    avatar = Column(String(200), nullable=True)
    role = Column(String(20), default="basic_user")  # 'admin' or 'basic_user'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

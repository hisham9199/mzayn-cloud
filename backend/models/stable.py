from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Stable(Base):
    __tablename__ = "stables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    discord_user_id = Column(String(50), nullable=True, index=True)
    discord_username = Column(String(100), nullable=True)
    min_camels = Column(Integer, default=10)
    max_camels = Column(Integer, default=10)
    required_spacing = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    camels = relationship("Camel", back_populates="stable")
    championships = relationship("Championship", back_populates="stable")

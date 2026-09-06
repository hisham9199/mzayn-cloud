from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    camel_id = Column(Integer, ForeignKey("camels.id"), nullable=True)
    entity_type = Column(String(50), default="camel")
    entity_id = Column(Integer, nullable=True)
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)
    changed_by = Column(String(100), default="user")
    action = Column(String(20), default="update")  # create / update / delete

    camel = relationship("Camel", back_populates="audit_logs")

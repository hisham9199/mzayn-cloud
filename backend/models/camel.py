from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Camel(Base):
    __tablename__ = "camels"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False, index=True)
    name = Column(String(200), nullable=True)
    gender = Column(String(10), nullable=True)  # ذكر / أنثى
    color = Column(String(100), nullable=True)   # اللون / السلالة
    stable_id = Column(Integer, ForeignKey("stables.id"), nullable=True)
    owner = Column(String(200), nullable=True)

    # Computed / entered fields
    points = Column(Integer, nullable=True)
    spacing = Column(Integer, nullable=True)
    harmony = Column(Float, nullable=True)   # التناسق العام

    # The 7 attributes
    nose = Column(Integer, nullable=True)       # الأنف
    lips = Column(Integer, nullable=True)       # الشفاه
    head = Column(Integer, nullable=True)       # الرأس
    neck = Column(Integer, nullable=True)       # الرقبة
    hump = Column(Integer, nullable=True)       # السنام
    eyelashes = Column(Integer, nullable=True)  # الرموش
    ear = Column(Integer, nullable=True)        # الأذن

    # Validation flags
    is_valid = Column(Boolean, default=False)
    points_valid = Column(Boolean, default=False)
    spacing_valid = Column(Boolean, default=False)

    # OCR-related
    ocr_confidence = Column(Float, nullable=True)
    ocr_raw_data = Column(Text, nullable=True)  # JSON string of raw OCR
    needs_review = Column(Boolean, default=False)

    # Meta
    acquisition_date = Column(Date, nullable=True)
    status = Column(String(30), default="available")  # available/sold/unavailable/reserved
    image_path = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    stable = relationship("Stable", back_populates="camels")
    audit_logs = relationship("AuditLog", back_populates="camel")

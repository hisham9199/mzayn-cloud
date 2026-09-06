from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Championship(Base):
    __tablename__ = "championships"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    stable_id = Column(Integer, ForeignKey("stables.id"), nullable=True)
    min_camels = Column(Integer, nullable=False, default=50)
    max_camels = Column(Integer, nullable=False, default=60)
    max_points_per_camel = Column(Integer, nullable=True)  # الحد الأعلى لنقاط الناقة
    required_spacing = Column(Integer, nullable=True)       # التباعد المطلوب
    mandatory_camel_ids = Column(JSON, default=list)        # نياق إجبارية
    excluded_camel_ids = Column(JSON, default=list)         # نياق مستبعدة
    allow_males = Column(Boolean, default=True)
    allow_other_stables = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    stable = relationship("Stable", back_populates="championships")
    results = relationship("ChampionshipResult", back_populates="championship", cascade="all, delete-orphan")


class ChampionshipResult(Base):
    __tablename__ = "championship_results"

    id = Column(Integer, primary_key=True, index=True)
    championship_id = Column(Integer, ForeignKey("championships.id"), nullable=False)
    selected_camel_ids = Column(JSON, default=list)
    total_points = Column(Integer, nullable=True)
    num_camels = Column(Integer, nullable=True)
    final_spacing = Column(Integer, nullable=True)
    attr_sums = Column(JSON, nullable=True)   # {nose: x, lips: y, ...}
    solve_status = Column(String(30), nullable=True)  # OPTIMAL / FEASIBLE / INFEASIBLE
    solve_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    championship = relationship("Championship", back_populates="results")

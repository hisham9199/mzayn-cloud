from typing import Optional, List
from pydantic import BaseModel, validator
from datetime import datetime, date


class StableBase(BaseModel):
    name: str
    description: Optional[str] = None


class StableCreate(StableBase):
    pass


class StableUpdate(StableBase):
    name: Optional[str] = None


class StableOut(StableBase):
    id: int
    created_at: datetime
    camel_count: Optional[int] = 0
    discord_user_id: Optional[str] = None
    discord_username: Optional[str] = None

    class Config:
        from_attributes = True


class CamelBase(BaseModel):
    number: Optional[str] = None
    name: Optional[str] = None
    gender: Optional[str] = None
    color: Optional[str] = None
    stable_id: Optional[int] = None
    owner: Optional[str] = None
    points: Optional[int] = None
    spacing: Optional[int] = None
    harmony: Optional[float] = None
    nose: Optional[int] = None
    lips: Optional[int] = None
    head: Optional[int] = None
    neck: Optional[int] = None
    hump: Optional[int] = None
    eyelashes: Optional[int] = None
    ear: Optional[int] = None
    acquisition_date: Optional[date] = None
    status: Optional[str] = "available"
    notes: Optional[str] = None


class CamelCreate(CamelBase):
    pass


class CamelUpdate(CamelBase):
    number: Optional[str] = None


class ValidationResult(BaseModel):
    points_valid: bool
    spacing_valid: bool
    expected_points: Optional[int] = None
    expected_spacing: Optional[int] = None
    error_fields: List[str] = []


class CamelOut(CamelBase):
    id: int
    is_valid: bool
    points_valid: bool
    spacing_valid: bool
    needs_review: bool
    ocr_confidence: Optional[float] = None
    image_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    validation: Optional[ValidationResult] = None
    stable_name: Optional[str] = None

    class Config:
        from_attributes = True


class ChampionshipBase(BaseModel):
    name: str
    stable_id: Optional[int] = None
    min_camels: int = 50
    max_camels: int = 60
    max_points_per_camel: Optional[int] = None
    required_spacing: Optional[int] = None
    mandatory_camel_ids: List[int] = []
    excluded_camel_ids: List[int] = []
    allow_males: bool = True
    allow_other_stables: bool = False


class ChampionshipCreate(ChampionshipBase):
    pass


class ChampionshipOut(ChampionshipBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OptimizeRequest(BaseModel):
    current_camel_ids: Optional[List[int]] = None  # for comparison
    time_limit_seconds: int = 60
    required_spacing: Optional[int] = None
    optimization_goal: str = "balanced"  # balanced, min_spacing, max_points


class OptimizeResult(BaseModel):
    num_camels: int
    total_points: int
    final_spacing: int
    attr_sums: dict
    solve_status: str
    solve_time_ms: int
    selected_camel_ids: List[int]
    current_total_points: Optional[int] = None
    improvement: Optional[int] = None
    camels_to_remove: Optional[List[int]] = None
    camels_to_add: Optional[List[int]] = None
    optimization_goal: Optional[str] = "balanced"
    required_spacing: Optional[int] = None



class OCRFieldResult(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0
    status: str = "unknown"  # green / yellow / red


class OCRResult(BaseModel):
    number: OCRFieldResult = OCRFieldResult()
    name: OCRFieldResult = OCRFieldResult()
    gender: OCRFieldResult = OCRFieldResult()
    color: OCRFieldResult = OCRFieldResult()
    points: OCRFieldResult = OCRFieldResult()
    spacing: OCRFieldResult = OCRFieldResult()
    harmony: OCRFieldResult = OCRFieldResult()
    nose: OCRFieldResult = OCRFieldResult()
    lips: OCRFieldResult = OCRFieldResult()
    head: OCRFieldResult = OCRFieldResult()
    neck: OCRFieldResult = OCRFieldResult()
    hump: OCRFieldResult = OCRFieldResult()
    eyelashes: OCRFieldResult = OCRFieldResult()
    ear: OCRFieldResult = OCRFieldResult()
    overall_confidence: float = 0.0
    overall_status: str = "red"  # green / yellow / red
    validation_ok: bool = False
    raw_image_base64: Optional[str] = None


class BulkOCRResult(BaseModel):
    total_images: int
    successful: int
    needs_review: int
    errors: int
    results: List[dict] = []


class ExcelImportResult(BaseModel):
    total_rows: int
    imported: int
    errors: List[dict] = []


class TestCamelResult(BaseModel):
    camel_id: int
    current_best_points: int
    new_best_points: int
    improvement: int
    benefits_stable: bool
    camels_removed: List[int] = []
    message: str


class AnalysisResult(BaseModel):
    weakest_camels: List[dict] = []
    weakest_attributes: List[dict] = []
    recommended_specs: dict = {}

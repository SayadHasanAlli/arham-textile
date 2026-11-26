from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class ProductionTypeCreate(BaseModel):
    production_name: str = Field(..., min_length=1, max_length=120)
    initial_rate: Decimal | None = Field(default=None, ge=0)


class ProductionTypeUpdate(BaseModel):
    production_name: str | None = Field(default=None, min_length=1, max_length=120)
    status: str | None = Field(default=None, pattern="^(active|inactive)$")


class RateUpdateRequest(BaseModel):
    rate_per_piece: Decimal = Field(..., ge=0)


class RateHistoryItem(BaseModel):
    id: int
    rate_per_piece: Decimal
    effective_from: datetime

    model_config = {"from_attributes": True}


class ProductionTypeResponse(BaseModel):
    id: int
    production_name: str
    normalized_name: str
    status: str
    current_rate: Decimal | None = None
    rate_effective_from: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

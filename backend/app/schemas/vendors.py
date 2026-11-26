from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class VendorCreate(BaseModel):
    vendor_name: str = Field(..., min_length=1, max_length=120)


class VendorUpdate(BaseModel):
    vendor_name: str | None = Field(default=None, min_length=1, max_length=120)
    status: str | None = Field(default=None, pattern="^(active|inactive)$")


class VendorResponse(BaseModel):
    id: int
    vendor_name: str
    normalized_name: str
    status: str
    total_quantity: Decimal = Decimal("0.00")
    total_value: Decimal = Decimal("0.00")
    total_records: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}

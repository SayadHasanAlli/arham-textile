from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class ProductionRecordCreate(BaseModel):
    production_date: date
    worker_id: int
    vendor_id: int
    production_type_id: int
    quantity: Decimal = Field(..., gt=0)
    notes: str | None = Field(default=None, max_length=500)


class ProductionRecordUpdate(BaseModel):
    production_date: date | None = None
    worker_id: int | None = None
    vendor_id: int | None = None
    production_type_id: int | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=500)


class ProductionRecordResponse(BaseModel):
    id: int
    production_date: date
    worker_id: int
    worker_name: str
    vendor_id: int
    vendor_name: str
    production_type_id: int
    production_type_name: str
    quantity: Decimal
    rate_per_piece: Decimal
    total_price: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductionRecordsSummary(BaseModel):
    total_records: int
    total_quantity: Decimal
    total_earnings: Decimal


class PaginatedProductionRecordsResponse(BaseModel):
    items: list[ProductionRecordResponse]
    summary: ProductionRecordsSummary
    page: int
    page_size: int
    total_pages: int

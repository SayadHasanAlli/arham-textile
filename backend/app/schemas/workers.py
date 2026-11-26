from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class WorkerCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    phone_number: str | None = Field(default=None, max_length=20)
    joining_date: date | None = None
    username: str | None = Field(default=None, min_length=3, max_length=60)
    password: str | None = Field(default=None, min_length=6, max_length=100)


class WorkerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone_number: str | None = Field(default=None, max_length=20)
    joining_date: date | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive)$")


class WorkerCredentialsUpdate(BaseModel):
    username: str = Field(..., min_length=3, max_length=60)
    password: str = Field(..., min_length=6, max_length=100)


class WorkerResponse(BaseModel):
    id: int
    full_name: str
    normalized_name: str
    phone_number: str | None
    joining_date: date
    status: str
    username: str | None = None
    total_quantity: Decimal = Decimal("0.00")
    total_earnings: Decimal = Decimal("0.00")
    total_records: int = 0
    latest_production_date: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== PHASE 5: WORKER PROFILE SCHEMAS ====================
class WorkerProfileInfo(BaseModel):
    id: int
    full_name: str
    phone_number: str | None
    joining_date: date
    status: str


class WorkerProfileSummary(BaseModel):
    total_production: Decimal
    total_earnings: Decimal
    total_paid: Decimal = Decimal("0.00")
    pending_balance: Decimal = Decimal("0.00")
    week_production: Decimal
    week_earnings: Decimal
    month_production: Decimal
    month_earnings: Decimal
    total_records: int


class WorkerDailyPoint(BaseModel):
    date: date
    quantity: Decimal
    earnings: Decimal


class WorkerMonthlyPoint(BaseModel):
    month: str
    quantity: Decimal
    earnings: Decimal


class WorkerTypePoint(BaseModel):
    name: str
    quantity: Decimal
    earnings: Decimal


class WorkerHistoryRecord(BaseModel):
    id: int
    production_date: date
    production_type_name: str
    vendor_name: str
    quantity: Decimal
    rate_per_piece: Decimal
    total_price: Decimal
    notes: str | None


class WorkerProfileResponse(BaseModel):
    worker: WorkerProfileInfo
    summary: WorkerProfileSummary
    daily_production: list[WorkerDailyPoint]
    monthly_production: list[WorkerMonthlyPoint]
    type_distribution: list[WorkerTypePoint]
    history: list[WorkerHistoryRecord]

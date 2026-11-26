from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_workers: int
    today_production: Decimal
    today_earnings: Decimal
    month_production: Decimal
    month_earnings: Decimal
    total_records: int


class DailyProductionPoint(BaseModel):
    date: date
    quantity: Decimal
    earnings: Decimal


class NamedMetricPoint(BaseModel):
    name: str
    quantity: Decimal
    earnings: Decimal


class MonthlyEarningsPoint(BaseModel):
    month: str
    quantity: Decimal
    earnings: Decimal


class RecentActivityItem(BaseModel):
    id: int
    production_date: date
    worker_name: str
    production_type: str
    vendor_name: str
    quantity: Decimal
    rate_per_piece: Decimal
    total_price: Decimal


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    daily_production: list[DailyProductionPoint]
    worker_comparison: list[NamedMetricPoint]
    type_distribution: list[NamedMetricPoint]
    vendor_production: list[NamedMetricPoint]
    monthly_earnings: list[MonthlyEarningsPoint]
    recent_activity: list[RecentActivityItem]

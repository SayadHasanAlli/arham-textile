from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Worker, Vendor, ProductionType, ProductionRecord, User
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardSummary,
    DailyProductionPoint,
    NamedMetricPoint,
    MonthlyEarningsPoint,
    RecentActivityItem,
)
from app.auth.dependencies import require_admin

router = APIRouter(prefix="/api/dashboard", tags=["Admin Dashboard"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/admin", response_model=DashboardResponse)
def get_admin_dashboard(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    today = datetime.now(IST).date()
    month_start = today.replace(day=1)

    if not end_date:
        end_date = today
    if not start_date:
        start_date = end_date - timedelta(days=29)

    total_workers = db.query(func.count(Worker.id)).scalar() or 0
    total_records = db.query(func.count(ProductionRecord.id)).scalar() or 0

    today_row = (
        db.query(
            func.coalesce(func.sum(ProductionRecord.quantity), 0),
            func.coalesce(func.sum(ProductionRecord.total_price), 0),
        )
        .filter(ProductionRecord.production_date == today)
        .one()
    )

    month_row = (
        db.query(
            func.coalesce(func.sum(ProductionRecord.quantity), 0),
            func.coalesce(func.sum(ProductionRecord.total_price), 0),
        )
        .filter(ProductionRecord.production_date >= month_start, ProductionRecord.production_date <= today)
        .one()
    )

    summary = DashboardSummary(
        total_workers=total_workers,
        today_production=Decimal(str(today_row[0])),
        today_earnings=Decimal(str(today_row[1])),
        month_production=Decimal(str(month_row[0])),
        month_earnings=Decimal(str(month_row[1])),
        total_records=total_records,
    )

    # Filtered range analytics
    daily_rows = (
        db.query(
            ProductionRecord.production_date,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .filter(ProductionRecord.production_date >= start_date, ProductionRecord.production_date <= end_date)
        .group_by(ProductionRecord.production_date)
        .order_by(ProductionRecord.production_date.asc())
        .all()
    )
    daily_production = [
        DailyProductionPoint(
            date=r.production_date,
            quantity=Decimal(str(r.qty)),
            earnings=Decimal(str(r.earnings)),
        )
        for r in daily_rows
    ]

    worker_rows = (
        db.query(
            Worker.full_name,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .join(ProductionRecord, ProductionRecord.worker_id == Worker.id)
        .filter(ProductionRecord.production_date >= start_date, ProductionRecord.production_date <= end_date)
        .group_by(Worker.id, Worker.full_name)
        .order_by(func.sum(ProductionRecord.total_price).desc())
        .all()
    )
    worker_comparison = [
        NamedMetricPoint(name=r.full_name, quantity=Decimal(str(r.qty)), earnings=Decimal(str(r.earnings)))
        for r in worker_rows
    ]

    type_rows = (
        db.query(
            ProductionType.production_name,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .join(ProductionRecord, ProductionRecord.production_type_id == ProductionType.id)
        .filter(ProductionRecord.production_date >= start_date, ProductionRecord.production_date <= end_date)
        .group_by(ProductionType.id, ProductionType.production_name)
        .order_by(func.sum(ProductionRecord.quantity).desc())
        .all()
    )
    type_distribution = [
        NamedMetricPoint(name=r.production_name, quantity=Decimal(str(r.qty)), earnings=Decimal(str(r.earnings)))
        for r in type_rows
    ]

    vendor_rows = (
        db.query(
            Vendor.vendor_name,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .join(ProductionRecord, ProductionRecord.vendor_id == Vendor.id)
        .filter(ProductionRecord.production_date >= start_date, ProductionRecord.production_date <= end_date)
        .group_by(Vendor.id, Vendor.vendor_name)
        .order_by(func.sum(ProductionRecord.total_price).desc())
        .all()
    )
    vendor_production = [
        NamedMetricPoint(name=r.vendor_name, quantity=Decimal(str(r.qty)), earnings=Decimal(str(r.earnings)))
        for r in vendor_rows
    ]

    # Monthly earnings (last 6 months)
    six_months_ago = (today.replace(day=1) - timedelta(days=150)).replace(day=1)
    month_trunc = func.to_char(ProductionRecord.production_date, "YYYY-MM")
    monthly_rows = (
        db.query(
            month_trunc.label("month"),
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .filter(ProductionRecord.production_date >= six_months_ago)
        .group_by(month_trunc)
        .order_by(month_trunc.asc())
        .all()
    )
    monthly_earnings = [
        MonthlyEarningsPoint(month=r.month, quantity=Decimal(str(r.qty)), earnings=Decimal(str(r.earnings)))
        for r in monthly_rows
    ]

    recent_rows = (
        db.query(ProductionRecord)
        .options(
            joinedload(ProductionRecord.worker),
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .order_by(ProductionRecord.production_date.desc(), ProductionRecord.id.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        RecentActivityItem(
            id=r.id,
            production_date=r.production_date,
            worker_name=r.worker.full_name,
            production_type=r.production_type.production_name,
            vendor_name=r.vendor.vendor_name,
            quantity=r.quantity,
            rate_per_piece=r.rate_per_piece,
            total_price=r.total_price,
        )
        for r in recent_rows
    ]

    return DashboardResponse(
        summary=summary,
        daily_production=daily_production,
        worker_comparison=worker_comparison,
        type_distribution=type_distribution,
        vendor_production=vendor_production,
        monthly_earnings=monthly_earnings,
        recent_activity=recent_activity,
    )

import math
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Worker, User, ProductionRecord, ProductionType, Payment
from app.schemas.workers import (
    WorkerCreate,
    WorkerUpdate,
    WorkerCredentialsUpdate,
    WorkerResponse,
    WorkerProfileInfo,
    WorkerProfileSummary,
    WorkerCycleGarmentItem,
    WorkerLastPayoutInfo,
    WorkerCycleSummary,
    WorkerHistoryPagination,
    WorkerDailyPoint,
    WorkerMonthlyPoint,
    WorkerTypePoint,
    WorkerHistoryRecord,
    WorkerProfileResponse,
)
from app.auth.dependencies import require_admin, get_current_user
from app.auth.security import hash_password
from app.utils.normalize import normalize_name

router = APIRouter(prefix="/api/workers", tags=["Workers"])
IST = ZoneInfo("Asia/Kolkata")


def _build_worker_response(worker: Worker, stats: dict) -> WorkerResponse:
    s = stats.get(worker.id, {})
    return WorkerResponse(
        id=worker.id,
        full_name=worker.full_name,
        normalized_name=worker.normalized_name,
        phone_number=worker.phone_number,
        joining_date=worker.joining_date,
        status=worker.status,
        username=worker.user.username if worker.user else None,
        total_quantity=s.get("qty", Decimal("0.00")),
        total_earnings=s.get("earnings", Decimal("0.00")),
        total_records=s.get("count", 0),
        latest_production_date=s.get("latest_date"),
        created_at=worker.created_at,
    )


def _build_worker_profile(
    db: Session,
    worker_id: int,
    start_date: date | None,
    end_date: date | None,
    sort_by: Literal["production_date", "quantity", "total_price"],
    sort_order: Literal["asc", "desc"],
    page: int = 1,
    page_size: int = 25,
    hide_settled: bool = False,
) -> WorkerProfileResponse:
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    today = datetime.now(IST).date()
    week_start = today - timedelta(days=today.weekday())  # Monday of current week (IST)
    month_start = today.replace(day=1)

    # All-time totals
    all_row = (
        db.query(
            func.coalesce(func.sum(ProductionRecord.quantity), 0),
            func.coalesce(func.sum(ProductionRecord.total_price), 0),
            func.count(ProductionRecord.id),
        )
        .filter(ProductionRecord.worker_id == worker_id)
        .one()
    )

    # This week totals
    week_row = (
        db.query(
            func.coalesce(func.sum(ProductionRecord.quantity), 0),
            func.coalesce(func.sum(ProductionRecord.total_price), 0),
        )
        .filter(
            ProductionRecord.worker_id == worker_id,
            ProductionRecord.production_date >= week_start,
            ProductionRecord.production_date <= today,
        )
        .one()
    )

    # This month totals
    month_row = (
        db.query(
            func.coalesce(func.sum(ProductionRecord.quantity), 0),
            func.coalesce(func.sum(ProductionRecord.total_price), 0),
        )
        .filter(
            ProductionRecord.worker_id == worker_id,
            ProductionRecord.production_date >= month_start,
            ProductionRecord.production_date <= today,
        )
        .one()
    )

    total_earnings = Decimal(str(all_row[1]))
    total_paid_raw = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.worker_id == worker_id)
        .scalar()
    )
    total_paid = Decimal(str(total_paid_raw))
    pending_balance = total_earnings - total_paid

    summary = WorkerProfileSummary(
        total_production=Decimal(str(all_row[0])),
        total_earnings=total_earnings,
        total_paid=total_paid,
        pending_balance=pending_balance,
        total_records=int(all_row[2] or 0),
        week_production=Decimal(str(week_row[0])),
        week_earnings=Decimal(str(week_row[1])),
        month_production=Decimal(str(month_row[0])),
        month_earnings=Decimal(str(month_row[1])),
    )

    # Current Cycle KPIs
    reset_at = worker.last_cycle_reset_at

    cycle_prod_query = db.query(
        func.coalesce(func.sum(ProductionRecord.quantity), 0),
        func.coalesce(func.sum(ProductionRecord.total_price), 0),
    ).filter(ProductionRecord.worker_id == worker_id)

    cycle_garment_query = (
        db.query(
            ProductionType.production_name,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .join(ProductionRecord, ProductionRecord.production_type_id == ProductionType.id)
        .filter(ProductionRecord.worker_id == worker_id)
    )

    cycle_paid_query = db.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(Payment.worker_id == worker_id)

    if reset_at is not None:
        cycle_prod_query = cycle_prod_query.filter(ProductionRecord.created_at > reset_at)
        cycle_garment_query = cycle_garment_query.filter(ProductionRecord.created_at > reset_at)
        cycle_paid_query = cycle_paid_query.filter(Payment.created_at > reset_at)

    cycle_prod_row = cycle_prod_query.one()
    cycle_production = Decimal(str(cycle_prod_row[0]))
    cycle_earnings = Decimal(str(cycle_prod_row[1]))
    cycle_paid = Decimal(str(cycle_paid_query.scalar()))

    opening_balance = (total_earnings - cycle_earnings) - (total_paid - cycle_paid)

    garment_rows = (
        cycle_garment_query.group_by(ProductionType.id, ProductionType.production_name)
        .order_by(func.sum(ProductionRecord.quantity).desc())
        .all()
    )
    garment_breakdown = [
        WorkerCycleGarmentItem(
            name=r.production_name,
            quantity=Decimal(str(r.qty)),
            earnings=Decimal(str(r.earnings)),
        )
        for r in garment_rows
    ]

    last_payment_row = (
        db.query(Payment)
        .filter(Payment.worker_id == worker_id)
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
        .first()
    )
    last_payout = (
        WorkerLastPayoutInfo(
            amount=last_payment_row.amount,
            payment_date=last_payment_row.payment_date,
            payment_mode=last_payment_row.payment_mode,
            reference_note=last_payment_row.reference_note,
        )
        if last_payment_row
        else None
    )

    cycle = WorkerCycleSummary(
        last_reset_at=reset_at,
        last_payout=last_payout,
        cycle_production=cycle_production,
        cycle_earnings=cycle_earnings,
        cycle_paid=cycle_paid,
        opening_balance=opening_balance,
        net_payable=pending_balance,
        garment_breakdown=garment_breakdown,
    )

    # Chart range defaults to last 30 days if no filter is set
    chart_end = end_date or today
    chart_start = start_date or (chart_end - timedelta(days=29))

    daily_rows = (
        db.query(
            ProductionRecord.production_date,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .filter(
            ProductionRecord.worker_id == worker_id,
            ProductionRecord.production_date >= chart_start,
            ProductionRecord.production_date <= chart_end,
        )
        .group_by(ProductionRecord.production_date)
        .order_by(ProductionRecord.production_date.asc())
        .all()
    )
    daily_production = [
        WorkerDailyPoint(
            date=r.production_date,
            quantity=Decimal(str(r.qty)),
            earnings=Decimal(str(r.earnings)),
        )
        for r in daily_rows
    ]

    # Monthly production (last 6 months)
    six_months_ago = (today.replace(day=1) - timedelta(days=150)).replace(day=1)
    month_trunc = func.to_char(ProductionRecord.production_date, "YYYY-MM")
    monthly_rows = (
        db.query(
            month_trunc.label("month"),
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .filter(
            ProductionRecord.worker_id == worker_id,
            ProductionRecord.production_date >= six_months_ago,
        )
        .group_by(month_trunc)
        .order_by(month_trunc.asc())
        .all()
    )
    monthly_production = [
        WorkerMonthlyPoint(
            month=r.month,
            quantity=Decimal(str(r.qty)),
            earnings=Decimal(str(r.earnings)),
        )
        for r in monthly_rows
    ]

    # Production type distribution (respects date filter if provided)
    type_query = (
        db.query(
            ProductionType.production_name,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
        )
        .join(ProductionRecord, ProductionRecord.production_type_id == ProductionType.id)
        .filter(ProductionRecord.worker_id == worker_id)
    )
    if start_date:
        type_query = type_query.filter(ProductionRecord.production_date >= start_date)
    if end_date:
        type_query = type_query.filter(ProductionRecord.production_date <= end_date)

    type_rows = (
        type_query.group_by(ProductionType.id, ProductionType.production_name)
        .order_by(func.sum(ProductionRecord.quantity).desc())
        .all()
    )
    type_distribution = [
        WorkerTypePoint(
            name=r.production_name,
            quantity=Decimal(str(r.qty)),
            earnings=Decimal(str(r.earnings)),
        )
        for r in type_rows
    ]

    # History table (paginated & scoped to worker_id)
    history_query = (
        db.query(ProductionRecord)
        .options(
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .filter(ProductionRecord.worker_id == worker_id)
    )
    if start_date:
        history_query = history_query.filter(ProductionRecord.production_date >= start_date)
    if end_date:
        history_query = history_query.filter(ProductionRecord.production_date <= end_date)
    if hide_settled and reset_at is not None:
        history_query = history_query.filter(ProductionRecord.created_at > reset_at)

    sort_col_map = {
        "production_date": ProductionRecord.production_date,
        "quantity": ProductionRecord.quantity,
        "total_price": ProductionRecord.total_price,
    }
    sort_col = sort_col_map[sort_by]
    order_clauses = [
        sort_col.asc() if sort_order == "asc" else sort_col.desc(),
        ProductionRecord.id.desc(),
    ]

    total_history_records = history_query.count()
    total_pages = max(1, math.ceil(total_history_records / page_size))
    safe_page = min(max(1, page), total_pages)
    offset = (safe_page - 1) * page_size

    history_rows = (
        history_query.order_by(*order_clauses)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    history = [
        WorkerHistoryRecord(
            id=r.id,
            production_date=r.production_date,
            production_type_name=r.production_type.production_name,
            vendor_name=r.vendor.vendor_name,
            quantity=r.quantity,
            rate_per_piece=r.rate_per_piece,
            total_price=r.total_price,
            notes=r.notes,
            created_at=r.created_at,
            is_settled=(reset_at is not None and r.created_at <= reset_at),
        )
        for r in history_rows
    ]

    history_pagination = WorkerHistoryPagination(
        page=safe_page,
        page_size=page_size,
        total_records=total_history_records,
        total_pages=total_pages,
    )

    return WorkerProfileResponse(
        worker=WorkerProfileInfo(
            id=worker.id,
            full_name=worker.full_name,
            phone_number=worker.phone_number,
            joining_date=worker.joining_date,
            status=worker.status,
            last_cycle_reset_at=worker.last_cycle_reset_at,
        ),
        summary=summary,
        cycle=cycle,
        daily_production=daily_production,
        monthly_production=monthly_production,
        type_distribution=type_distribution,
        history=history,
        history_pagination=history_pagination,
    )


@router.get("/me/profile", response_model=WorkerProfileResponse)
def get_my_worker_profile(
    start_date: date | None = None,
    end_date: date | None = None,
    sort_by: Literal["production_date", "quantity", "total_price"] = "production_date",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=10, le=100),
    hide_settled: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "worker" or not current_user.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available for worker accounts.",
        )
    return _build_worker_profile(
        db, current_user.worker_id, start_date, end_date, sort_by, sort_order, page, page_size, hide_settled
    )


@router.get("/{worker_id}/profile", response_model=WorkerProfileResponse)
def get_worker_profile(
    worker_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    sort_by: Literal["production_date", "quantity", "total_price"] = "production_date",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=10, le=100),
    hide_settled: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Strict RBAC: Workers can NEVER access another worker's profile
    if current_user.role == "worker" and current_user.worker_id != worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view another worker's data.",
        )
    if current_user.role not in ("admin", "worker"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return _build_worker_profile(
        db, worker_id, start_date, end_date, sort_by, sort_order, page, page_size, hide_settled
    )


@router.post("/{worker_id}/reset-cycle")
def reset_worker_cycle(
    worker_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    worker.last_cycle_reset_at = datetime.now(IST)
    db.commit()
    db.refresh(worker)
    return {
        "worker_id": worker.id,
        "last_cycle_reset_at": worker.last_cycle_reset_at.isoformat(),
        "message": "Worker cycle reset successfully",
    }


@router.get("", response_model=list[WorkerResponse])
def list_workers(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(Worker)
    if active_only:
        query = query.filter(Worker.status == "active")
    workers = query.order_by(Worker.full_name.asc()).all()

    agg = (
        db.query(
            ProductionRecord.worker_id,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("earnings"),
            func.count(ProductionRecord.id).label("count"),
            func.max(ProductionRecord.production_date).label("latest_date"),
        )
        .group_by(ProductionRecord.worker_id)
        .all()
    )
    stats = {
        row.worker_id: {
            "qty": Decimal(str(row.qty)),
            "earnings": Decimal(str(row.earnings)),
            "count": row.count,
            "latest_date": row.latest_date,
        }
        for row in agg
    }
    return [_build_worker_response(w, stats) for w in workers]


@router.post("", response_model=WorkerResponse, status_code=status.HTTP_201_CREATED)
def create_worker(
    payload: WorkerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    norm = normalize_name(payload.full_name)
    if db.query(Worker).filter(Worker.normalized_name == norm).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Worker '{payload.full_name.strip()}' already exists (case-insensitive match).",
        )

    if (payload.username and not payload.password) or (payload.password and not payload.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both username and password are required to create worker login credentials.",
        )

    if payload.username:
        uname = normalize_name(payload.username)
        if db.query(User).filter(User.username == uname).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    worker = Worker(
        full_name=payload.full_name.strip(),
        normalized_name=norm,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        joining_date=payload.joining_date or date.today(),
        status="active",
    )
    db.add(worker)
    db.flush()

    if payload.username and payload.password:
        db.add(
            User(
                username=normalize_name(payload.username),
                password_hash=hash_password(payload.password),
                role="worker",
                worker_id=worker.id,
                is_active=True,
            )
        )

    db.commit()
    db.refresh(worker)
    return _build_worker_response(worker, {})


@router.put("/{worker_id}", response_model=WorkerResponse)
def update_worker(
    worker_id: int,
    payload: WorkerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    if payload.full_name is not None:
        norm = normalize_name(payload.full_name)
        existing = db.query(Worker).filter(Worker.normalized_name == norm, Worker.id != worker_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another worker named '{existing.full_name}' already exists.",
            )
        worker.full_name = payload.full_name.strip()
        worker.normalized_name = norm

    if payload.phone_number is not None:
        worker.phone_number = payload.phone_number.strip() or None
    if payload.joining_date is not None:
        worker.joining_date = payload.joining_date
    if payload.status is not None:
        worker.status = payload.status
        if worker.user:
            worker.user.is_active = payload.status == "active"

    db.commit()
    db.refresh(worker)
    return _build_worker_response(worker, {})


@router.put("/{worker_id}/credentials", response_model=WorkerResponse)
def set_worker_credentials(
    worker_id: int,
    payload: WorkerCredentialsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    uname = normalize_name(payload.username)
    existing_user = db.query(User).filter(User.username == uname).first()
    if existing_user and existing_user.worker_id != worker.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    if worker.user:
        worker.user.username = uname
        worker.user.password_hash = hash_password(payload.password)
        worker.user.is_active = worker.status == "active"
    else:
        db.add(
            User(
                username=uname,
                password_hash=hash_password(payload.password),
                role="worker",
                worker_id=worker.id,
                is_active=worker.status == "active",
            )
        )

    db.commit()
    db.refresh(worker)
    return _build_worker_response(worker, {})

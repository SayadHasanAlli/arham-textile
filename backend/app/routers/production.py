import math
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import (
    ProductionRecord,
    Worker,
    Vendor,
    ProductionType,
    ProductionRate,
    User,
)
from app.schemas.production import (
    ProductionRecordCreate,
    ProductionRecordUpdate,
    ProductionRecordResponse,
    ProductionRecordsSummary,
    PaginatedProductionRecordsResponse,
)
from app.auth.dependencies import require_admin

router = APIRouter(prefix="/api/production", tags=["Production Records"])


def _get_latest_rate(db: Session, production_type_id: int) -> Decimal | None:
    rate_row = (
        db.query(ProductionRate)
        .filter(ProductionRate.production_type_id == production_type_id)
        .order_by(ProductionRate.effective_from.desc(), ProductionRate.id.desc())
        .first()
    )
    return rate_row.rate_per_piece if rate_row else None


def _calc_total(quantity: Decimal, rate: Decimal) -> Decimal:
    return (quantity * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _to_response(record: ProductionRecord) -> ProductionRecordResponse:
    return ProductionRecordResponse(
        id=record.id,
        production_date=record.production_date,
        worker_id=record.worker_id,
        worker_name=record.worker.full_name,
        vendor_id=record.vendor_id,
        vendor_name=record.vendor.vendor_name,
        production_type_id=record.production_type_id,
        production_type_name=record.production_type.production_name,
        quantity=record.quantity,
        rate_per_piece=record.rate_per_piece,
        total_price=record.total_price,
        notes=record.notes,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get("", response_model=PaginatedProductionRecordsResponse)
def list_production_records(
    worker_search: str | None = None,
    vendor_search: str | None = None,
    production_type_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    sort_by: Literal["production_date", "quantity", "total_price"] = "production_date",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    base_query = (
        db.query(ProductionRecord)
        .join(Worker, ProductionRecord.worker_id == Worker.id)
        .join(Vendor, ProductionRecord.vendor_id == Vendor.id)
        .join(ProductionType, ProductionRecord.production_type_id == ProductionType.id)
    )

    if worker_search and worker_search.strip():
        pattern = f"%{worker_search.strip().lower()}%"
        base_query = base_query.filter(Worker.normalized_name.ilike(pattern))

    if vendor_search and vendor_search.strip():
        pattern = f"%{vendor_search.strip().lower()}%"
        base_query = base_query.filter(Vendor.normalized_name.ilike(pattern))

    if production_type_id is not None:
        base_query = base_query.filter(ProductionRecord.production_type_id == production_type_id)

    if start_date is not None:
        base_query = base_query.filter(ProductionRecord.production_date >= start_date)

    if end_date is not None:
        base_query = base_query.filter(ProductionRecord.production_date <= end_date)

    # Filtered summary aggregation
    agg = base_query.with_entities(
        func.count(ProductionRecord.id),
        func.coalesce(func.sum(ProductionRecord.quantity), 0),
        func.coalesce(func.sum(ProductionRecord.total_price), 0),
    ).one()

    total_records = int(agg[0] or 0)
    summary = ProductionRecordsSummary(
        total_records=total_records,
        total_quantity=Decimal(str(agg[1])),
        total_earnings=Decimal(str(agg[2])),
    )

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

    total_pages = max(1, math.ceil(total_records / page_size))
    offset = (page - 1) * page_size

    rows = (
        base_query.options(
            joinedload(ProductionRecord.worker),
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .order_by(*order_clauses)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return PaginatedProductionRecordsResponse(
        items=[_to_response(r) for r in rows],
        summary=summary,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/recent", response_model=list[ProductionRecordResponse])
def list_recent_records(
    limit: int = 15,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = (
        db.query(ProductionRecord)
        .options(
            joinedload(ProductionRecord.worker),
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .order_by(ProductionRecord.production_date.desc(), ProductionRecord.id.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [_to_response(r) for r in rows]


@router.post("", response_model=ProductionRecordResponse, status_code=status.HTTP_201_CREATED)
def create_production_record(
    payload: ProductionRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    worker = db.query(Worker).filter(Worker.id == payload.worker_id, Worker.status == "active").first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected worker is invalid or inactive.")

    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id, Vendor.status == "active").first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected vendor is invalid or inactive.")

    ptype = (
        db.query(ProductionType)
        .filter(ProductionType.id == payload.production_type_id, ProductionType.status == "active")
        .first()
    )
    if not ptype:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Selected production type is invalid or inactive."
        )

    active_rate = _get_latest_rate(db, ptype.id)
    if active_rate is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No rate configured for '{ptype.production_name}'. Please set a rate in Production Pricing first.",
        )

    total_price = _calc_total(payload.quantity, active_rate)

    record = ProductionRecord(
        production_date=payload.production_date,
        worker_id=worker.id,
        vendor_id=vendor.id,
        production_type_id=ptype.id,
        quantity=payload.quantity,
        rate_per_piece=active_rate,
        total_price=total_price,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    record = (
        db.query(ProductionRecord)
        .options(
            joinedload(ProductionRecord.worker),
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .filter(ProductionRecord.id == record.id)
        .one()
    )
    return _to_response(record)


@router.put("/{record_id}", response_model=ProductionRecordResponse)
def update_production_record(
    record_id: int,
    payload: ProductionRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    record = db.query(ProductionRecord).filter(ProductionRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production record not found.")

    if payload.production_date is not None:
        record.production_date = payload.production_date

    if payload.worker_id is not None:
        worker = db.query(Worker).filter(Worker.id == payload.worker_id).first()
        if not worker:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Worker not found.")
        record.worker_id = worker.id

    if payload.vendor_id is not None:
        vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vendor not found.")
        record.vendor_id = vendor.id

    if payload.production_type_id is not None and payload.production_type_id != record.production_type_id:
        ptype = db.query(ProductionType).filter(ProductionType.id == payload.production_type_id).first()
        if not ptype:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Production type not found.")
        new_rate = _get_latest_rate(db, ptype.id)
        if new_rate is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No rate configured for '{ptype.production_name}'.",
            )
        record.production_type_id = ptype.id
        record.rate_per_piece = new_rate

    if payload.quantity is not None:
        record.quantity = payload.quantity

    if payload.notes is not None:
        record.notes = payload.notes.strip() or None

    record.total_price = _calc_total(record.quantity, record.rate_per_piece)
    db.commit()

    record = (
        db.query(ProductionRecord)
        .options(
            joinedload(ProductionRecord.worker),
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .filter(ProductionRecord.id == record.id)
        .one()
    )
    return _to_response(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production_record(
    record_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    record = db.query(ProductionRecord).filter(ProductionRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production record not found.")
    db.delete(record)
    db.commit()
    return None

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Vendor, User, ProductionRecord
from app.schemas.vendors import VendorCreate, VendorUpdate, VendorResponse
from app.auth.dependencies import require_admin
from app.utils.normalize import normalize_name

router = APIRouter(prefix="/api/vendors", tags=["Vendors"])


@router.get("", response_model=list[VendorResponse])
def list_vendors(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(Vendor)
    if active_only:
        query = query.filter(Vendor.status == "active")
    vendors = query.order_by(Vendor.vendor_name.asc()).all()

    agg = (
        db.query(
            ProductionRecord.vendor_id,
            func.coalesce(func.sum(ProductionRecord.quantity), 0).label("qty"),
            func.coalesce(func.sum(ProductionRecord.total_price), 0).label("val"),
            func.count(ProductionRecord.id).label("count"),
        )
        .group_by(ProductionRecord.vendor_id)
        .all()
    )
    stats = {
        r.vendor_id: {
            "qty": Decimal(str(r.qty)),
            "val": Decimal(str(r.val)),
            "count": r.count,
        }
        for r in agg
    }

    return [
        VendorResponse(
            id=v.id,
            vendor_name=v.vendor_name,
            normalized_name=v.normalized_name,
            status=v.status,
            total_quantity=stats.get(v.id, {}).get("qty", Decimal("0.00")),
            total_value=stats.get(v.id, {}).get("val", Decimal("0.00")),
            total_records=stats.get(v.id, {}).get("count", 0),
            created_at=v.created_at,
        )
        for v in vendors
    ]


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    norm = normalize_name(payload.vendor_name)
    if db.query(Vendor).filter(Vendor.normalized_name == norm).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vendor '{payload.vendor_name.strip()}' already exists.",
        )

    vendor = Vendor(vendor_name=payload.vendor_name.strip(), normalized_name=norm, status="active")
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return VendorResponse(
        id=vendor.id,
        vendor_name=vendor.vendor_name,
        normalized_name=vendor.normalized_name,
        status=vendor.status,
        created_at=vendor.created_at,
    )


@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    if payload.vendor_name is not None:
        norm = normalize_name(payload.vendor_name)
        existing = db.query(Vendor).filter(Vendor.normalized_name == norm, Vendor.id != vendor_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vendor '{existing.vendor_name}' already exists.",
            )
        vendor.vendor_name = payload.vendor_name.strip()
        vendor.normalized_name = norm

    if payload.status is not None:
        vendor.status = payload.status

    db.commit()
    db.refresh(vendor)
    return VendorResponse(
        id=vendor.id,
        vendor_name=vendor.vendor_name,
        normalized_name=vendor.normalized_name,
        status=vendor.status,
        created_at=vendor.created_at,
    )

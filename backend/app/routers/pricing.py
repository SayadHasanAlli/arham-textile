from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ProductionType, ProductionRate, User
from app.schemas.pricing import (
    ProductionTypeCreate,
    ProductionTypeUpdate,
    ProductionTypeResponse,
    RateUpdateRequest,
    RateHistoryItem,
)
from app.auth.dependencies import require_admin
from app.utils.normalize import normalize_name

router = APIRouter(prefix="/api/pricing", tags=["Production Pricing"])


def _to_response(pt: ProductionType) -> ProductionTypeResponse:
    latest = pt.rates[0] if pt.rates else None
    return ProductionTypeResponse(
        id=pt.id,
        production_name=pt.production_name,
        normalized_name=pt.normalized_name,
        status=pt.status,
        current_rate=latest.rate_per_piece if latest else None,
        rate_effective_from=latest.effective_from if latest else None,
        created_at=pt.created_at,
    )


@router.get("/types", response_model=list[ProductionTypeResponse])
def list_production_types(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(ProductionType)
    if active_only:
        query = query.filter(ProductionType.status == "active")
    types = query.order_by(ProductionType.production_name.asc()).all()
    return [_to_response(pt) for pt in types]


@router.post("/types", response_model=ProductionTypeResponse, status_code=status.HTTP_201_CREATED)
def create_production_type(
    payload: ProductionTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    norm = normalize_name(payload.production_name)
    if db.query(ProductionType).filter(ProductionType.normalized_name == norm).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Production type '{payload.production_name.strip()}' already exists.",
        )

    pt = ProductionType(
        production_name=payload.production_name.strip(),
        normalized_name=norm,
        status="active",
    )
    db.add(pt)
    db.flush()

    if payload.initial_rate is not None:
        db.add(
            ProductionRate(
                production_type_id=pt.id,
                rate_per_piece=payload.initial_rate,
                effective_from=datetime.now(timezone.utc),
            )
        )

    db.commit()
    db.refresh(pt)
    return _to_response(pt)


@router.put("/types/{type_id}", response_model=ProductionTypeResponse)
def update_production_type(
    type_id: int,
    payload: ProductionTypeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    pt = db.query(ProductionType).filter(ProductionType.id == type_id).first()
    if not pt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production type not found")

    if payload.production_name is not None:
        norm = normalize_name(payload.production_name)
        existing = (
            db.query(ProductionType)
            .filter(ProductionType.normalized_name == norm, ProductionType.id != type_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Production type '{existing.production_name}' already exists.",
            )
        pt.production_name = payload.production_name.strip()
        pt.normalized_name = norm

    if payload.status is not None:
        pt.status = payload.status

    db.commit()
    db.refresh(pt)
    return _to_response(pt)


@router.post("/types/{type_id}/rate", response_model=ProductionTypeResponse)
def update_rate(
    type_id: int,
    payload: RateUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Inserts a NEW versioned row into production_rates.
    Previously saved production_records keep their original snapshotted rate_per_piece & total_price.
    """
    pt = db.query(ProductionType).filter(ProductionType.id == type_id).first()
    if not pt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production type not found")

    db.add(
        ProductionRate(
            production_type_id=pt.id,
            rate_per_piece=payload.rate_per_piece,
            effective_from=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.refresh(pt)
    return _to_response(pt)


@router.get("/types/{type_id}/history", response_model=list[RateHistoryItem])
def get_rate_history(
    type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    pt = db.query(ProductionType).filter(ProductionType.id == type_id).first()
    if not pt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production type not found")
    return pt.rates

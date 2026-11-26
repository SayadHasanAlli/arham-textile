import re
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import ProductionRecord, User, Worker
from app.auth.dependencies import get_current_user, require_admin
from app.services.export_service import (
    resolve_period,
    build_csv,
    build_xlsx,
    build_pdf,
)

router = APIRouter(prefix="/api/exports", tags=["Export Reports"])

MEDIA_TYPES = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
}


def _safe_filename(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text.strip()).strip("_").lower()


def _generate_export_response(
    db: Session,
    period: str,
    fmt: str,
    worker_id: int | None = None,
) -> Response:
    period_label, start_date, end_date = resolve_period(period)

    worker_name = None
    if worker_id is not None:
        worker = db.query(Worker).filter(Worker.id == worker_id).first()
        if not worker:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
        worker_name = worker.full_name

    query = (
        db.query(ProductionRecord)
        .options(
            joinedload(ProductionRecord.worker),
            joinedload(ProductionRecord.vendor),
            joinedload(ProductionRecord.production_type),
        )
        .filter(
            ProductionRecord.production_date >= start_date,
            ProductionRecord.production_date <= end_date,
        )
    )
    if worker_id is not None:
        query = query.filter(ProductionRecord.worker_id == worker_id)

    records = query.order_by(ProductionRecord.production_date.desc(), ProductionRecord.id.desc()).all()

    title = f"Worker Production Report - {worker_name}" if worker_name else "All Production Records Report"

    if fmt == "csv":
        content = build_csv(records, title, period_label, start_date, end_date, worker_name)
    elif fmt == "xlsx":
        content = build_xlsx(records, title, period_label, start_date, end_date, worker_name)
    elif fmt == "pdf":
        content = build_pdf(records, title, period_label, start_date, end_date, worker_name)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format.")

    prefix = f"arham_{_safe_filename(worker_name)}" if worker_name else "arham_all_production"
    filename = f"{prefix}_{period}_{end_date.isoformat()}.{fmt}"

    return Response(
        content=content,
        media_type=MEDIA_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/all")
def export_all_records(
    period: Literal["1w", "2w", "30d", "3m"] = Query("30d"),
    format: Literal["xlsx", "csv", "pdf"] = Query("xlsx"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return _generate_export_response(db, period=period, fmt=format, worker_id=None)


@router.get("/me")
def export_my_records(
    period: Literal["1w", "2w", "30d", "3m"] = Query("30d"),
    format: Literal["xlsx", "csv", "pdf"] = Query("xlsx"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "worker" or not current_user.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This export endpoint is only for worker accounts.",
        )
    return _generate_export_response(db, period=period, fmt=format, worker_id=current_user.worker_id)


@router.get("/worker/{worker_id}")
def export_worker_records(
    worker_id: int,
    period: Literal["1w", "2w", "30d", "3m"] = Query("30d"),
    format: Literal["xlsx", "csv", "pdf"] = Query("xlsx"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Strict RBAC: Workers can NEVER export another worker's data
    if current_user.role == "worker" and current_user.worker_id != worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to export another worker's records.",
        )
    if current_user.role not in ("admin", "worker"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return _generate_export_response(db, period=period, fmt=format, worker_id=worker_id)

from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Payment, ProductionRecord, User, Worker
from app.auth.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/api/payments", tags=["Payments"])


class PaymentCreate(BaseModel):
    worker_id: int
    amount: Decimal = Field(..., gt=0)
    payment_date: date
    payment_mode: str = Field(..., pattern="^(Cash|UPI|Bank Transfer)$")
    reference_note: Optional[str] = None


@router.get("/balances")
def get_worker_balances(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    workers = db.query(Worker).order_by(Worker.full_name.asc()).all()

    earnings_map = dict(
        db.query(
            ProductionRecord.worker_id,
            func.coalesce(func.sum(ProductionRecord.total_price), 0),
        )
        .group_by(ProductionRecord.worker_id)
        .all()
    )
    paid_map = dict(
        db.query(
            Payment.worker_id,
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .group_by(Payment.worker_id)
        .all()
    )

    result = []
    for w in workers:
        earned = float(earnings_map.get(w.id, 0))
        paid = float(paid_map.get(w.id, 0))
        result.append(
            {
                "worker_id": w.id,
                "worker_name": w.full_name,
                "total_earnings": round(earned, 2),
                "total_paid": round(paid, 2),
                "pending_balance": round(earned - paid, 2),
            }
        )
    return result


@router.get("")
def list_payments(
    worker_id: Optional[int] = Query(None),
    payment_mode: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Payment, Worker.full_name).join(Worker, Payment.worker_id == Worker.id)

    if current_user.role != "admin":
        q = q.filter(Payment.worker_id == current_user.worker_id)
    elif worker_id:
        q = q.filter(Payment.worker_id == worker_id)

    if payment_mode:
        q = q.filter(Payment.payment_mode == payment_mode)
    if start_date:
        q = q.filter(Payment.payment_date >= start_date)
    if end_date:
        q = q.filter(Payment.payment_date <= end_date)

    rows = q.order_by(Payment.payment_date.desc(), Payment.id.desc()).all()
    return [
        {
            "id": p.id,
            "worker_id": p.worker_id,
            "worker_name": name,
            "amount": float(p.amount),
            "payment_date": p.payment_date.isoformat(),
            "payment_mode": p.payment_mode,
            "reference_note": p.reference_note,
        }
        for p, name in rows
    ]


@router.post("", status_code=201)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    worker = db.query(Worker).filter(Worker.id == payload.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    payment = Payment(
        worker_id=payload.worker_id,
        amount=payload.amount,
        payment_date=payload.payment_date,
        payment_mode=payload.payment_mode,
        reference_note=payload.reference_note.strip() if payload.reference_note else None,
        created_by=admin.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"id": payment.id, "message": "Payment recorded"}


@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
    return {"message": "Payment deleted"}
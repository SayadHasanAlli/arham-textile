from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Worker(Base):
    __tablename__ = "workers"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="ck_workers_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User | None"] = relationship("User", back_populates="worker", uselist=False)
    production_records: Mapped[list["ProductionRecord"]] = relationship("ProductionRecord", back_populates="worker")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'worker')", name="ck_users_role"),
        CheckConstraint(
            "(role = 'admin' AND worker_id IS NULL) OR (role = 'worker' AND worker_id IS NOT NULL)",
            name="ck_users_role_worker_link",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(60), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    worker_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("workers.id", ondelete="RESTRICT"), unique=True, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    worker: Mapped["Worker | None"] = relationship("Worker", back_populates="user")


class Vendor(Base):
    __tablename__ = "vendors"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="ck_vendors_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendor_name: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    production_records: Mapped[list["ProductionRecord"]] = relationship("ProductionRecord", back_populates="vendor")


class ProductionType(Base):
    __tablename__ = "production_types"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="ck_production_types_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    production_name: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rates: Mapped[list["ProductionRate"]] = relationship(
        "ProductionRate", back_populates="production_type", order_by="desc(ProductionRate.effective_from)"
    )
    production_records: Mapped[list["ProductionRecord"]] = relationship(
        "ProductionRecord", back_populates="production_type"
    )


class ProductionRate(Base):
    __tablename__ = "production_rates"
    __table_args__ = (
        CheckConstraint("rate_per_piece >= 0", name="ck_production_rates_non_negative"),
        Index("idx_production_rates_type_effective", "production_type_id", "effective_from"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    production_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_types.id", ondelete="RESTRICT"), nullable=False
    )
    rate_per_piece: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    production_type: Mapped["ProductionType"] = relationship("ProductionType", back_populates="rates")


class ProductionRecord(Base):
    __tablename__ = "production_records"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_production_records_qty_positive"),
        CheckConstraint("rate_per_piece >= 0", name="ck_production_records_rate_non_negative"),
        CheckConstraint("total_price >= 0", name="ck_production_records_total_non_negative"),
        Index("idx_records_date", "production_date"),
        Index("idx_records_worker_date", "worker_id", "production_date"),
        Index("idx_records_vendor", "vendor_id"),
        Index("idx_records_type", "production_type_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    production_date: Mapped[date] = mapped_column(Date, nullable=False)
    worker_id: Mapped[int] = mapped_column(Integer, ForeignKey("workers.id", ondelete="RESTRICT"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(Integer, ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False)
    production_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_types.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    rate_per_piece: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    worker: Mapped["Worker"] = relationship("Worker", back_populates="production_records")
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="production_records")
    production_type: Mapped["ProductionType"] = relationship("ProductionType", back_populates="production_records")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    worker_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_mode: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    worker: Mapped["Worker"] = relationship("Worker", foreign_keys=[worker_id])

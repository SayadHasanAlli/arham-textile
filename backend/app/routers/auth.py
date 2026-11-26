import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, ChangePasswordRequest, TokenResponse, UserResponse
from app.auth.security import verify_password, hash_password, create_access_token
from app.auth.dependencies import get_current_user
from app.utils.normalize import normalize_name

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Lightweight in-memory brute-force protection: max 15 failed attempts per IP per 5 min
_FAILED_LOGINS: dict[str, list[float]] = defaultdict(list)
_WINDOW_SECONDS = 300
_MAX_ATTEMPTS = 15


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    recent = [ts for ts in _FAILED_LOGINS[client_ip] if now - ts < _WINDOW_SECONDS]
    _FAILED_LOGINS[client_ip] = recent
    if len(recent) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 5 minutes and try again.",
        )


def _record_failed_login(client_ip: str) -> None:
    _FAILED_LOGINS[client_ip].append(time.time())


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    username_clean = normalize_name(payload.username)
    user = db.query(User).filter(User.username == username_clean).first()

    if not user or not verify_password(payload.password, user.password_hash):
        _record_failed_login(client_ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    if user.role == "worker" and user.worker and user.worker.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Worker account is deactivated")

    _FAILED_LOGINS.pop(client_ip, None)

    token = create_access_token({"sub": str(user.id), "role": user.role, "worker_id": user.worker_id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            role=user.role,
            worker_id=user.worker_id,
            worker_name=user.worker.full_name if user.worker else None,
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        worker_id=current_user.worker_id,
        worker_name=current_user.worker.full_name if current_user.worker else None,
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}

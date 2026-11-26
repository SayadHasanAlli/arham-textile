import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.config import settings
from app.routers import auth, workers, vendors, pricing, dashboard, production, exports

logger = logging.getLogger("arham_textile")

if settings.is_production and settings.SECRET_KEY == "change-this-secret-in-production":
    raise RuntimeError("SECRET_KEY must be set to a strong random value in production.")

app = FastAPI(
    title="Arham Textile Management System API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    first_err = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(loc) for loc in first_err.get("loc", []) if loc != "body")
    msg = first_err.get("msg", "Invalid input data.")
    detail = f"{field}: {msg}" if field else msg
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": detail})


@app.exception_handler(IntegrityError)
async def integrity_exception_handler(_: Request, exc: IntegrityError):
    logger.warning("Database integrity error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Operation conflicts with existing records or database constraints."},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(_: Request, exc: SQLAlchemyError):
    logger.error("Database error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred."},
    )


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(workers.router)
app.include_router(vendors.router)
app.include_router(pricing.router)
app.include_router(production.router)
app.include_router(exports.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Arham Textile Management System", "environment": settings.ENVIRONMENT}

"""Custom exceptions and error handling."""
from typing import Any, Dict, Optional
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, DBAPIError
from pydantic import ValidationError
import structlog

logger = structlog.get_logger(__name__)


class AppException(Exception):
    """Base application exception."""
    def __init__(
        self,
        message: str,
        code: str = "APP_ERROR",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(AppException):
    """Resource not found."""
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found: {identifier}",
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource": resource, "identifier": identifier},
        )


class ConflictError(AppException):
    """Resource conflict (duplicate, etc.)."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class ValidationError(AppException):
    """Business logic validation error."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class UnauthorizedError(AppException):
    """Authentication required."""
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenError(AppException):
    """Permission denied."""
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class InsufficientStockError(AppException):
    """Not enough stock for operation."""
    def __init__(self, medicine: str, batch: str, requested: float, available: float):
        super().__init__(
            message=f"Insufficient stock for {medicine} (batch {batch}): requested {requested}, available {available}",
            code="INSUFFICIENT_STOCK",
            status_code=status.HTTP_409_CONFLICT,
            details={
                "medicine": medicine,
                "batch": batch,
                "requested": requested,
                "available": available,
            },
        )


class ExpiredBatchError(AppException):
    """Attempted to use expired batch."""
    def __init__(self, medicine: str, batch: str, expiry_date: str):
        super().__init__(
            message=f"Batch {batch} of {medicine} is expired (expiry: {expiry_date})",
            code="EXPIRED_BATCH",
            status_code=status.HTTP_409_CONFLICT,
            details={
                "medicine": medicine,
                "batch": batch,
                "expiry_date": expiry_date,
            },
        )


class InvoicePostingError(AppException):
    """Error during invoice posting."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="INVOICE_POSTING_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


# Exception handlers
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions."""
    logger.warning(
        "application_exception",
        code=exc.code,
        message=exc.message,
        details=exc.details,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    logger.warning(
        "validation_error",
        errors=exc.errors(),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            }
        },
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Handle database integrity errors."""
    logger.error(
        "integrity_error",
        error=str(exc.orig),
        path=request.url.path,
    )
    
    # Parse common integrity errors
    error_msg = str(exc.orig).lower()
    if "unique" in error_msg or "duplicate" in error_msg:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "DUPLICATE_ENTRY",
                    "message": "A record with this value already exists",
                    "details": {"constraint": str(exc.orig)},
                }
            },
        )
    if "foreign key" in error_msg:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "FOREIGN_KEY_VIOLATION",
                    "message": "Referenced record does not exist",
                    "details": {"constraint": str(exc.orig)},
                }
            },
        )
    if "check" in error_msg:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "CONSTRAINT_VIOLATION",
                    "message": "Data violates a constraint",
                    "details": {"constraint": str(exc.orig)},
                }
            },
        )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "DATABASE_ERROR",
                "message": "A database error occurred",
                "details": {},
            }
        },
    )


async def dbapi_error_handler(request: Request, exc: DBAPIError) -> JSONResponse:
    """Handle generic database errors."""
    logger.error(
        "dbapi_error",
        error=str(exc),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "DATABASE_ERROR",
                "message": "A database error occurred",
                "details": {},
            }
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.exception(
        "unhandled_exception",
        error=str(exc),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )


def register_exception_handlers(app) -> None:
    """Register all exception handlers with FastAPI app."""
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(DBAPIError, dbapi_error_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
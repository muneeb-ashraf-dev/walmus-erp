"""Core module initialization."""
from app.core.config import settings, get_settings
from app.core.database import Base, engine, async_session_maker, get_db, get_db_context, init_db, close_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_token,
    TokenData,
)
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import (
    AppException,
    NotFoundError,
    ConflictError,
    ValidationError as AppValidationError,
    UnauthorizedError,
    ForbiddenError,
    InsufficientStockError,
    ExpiredBatchError,
    InvoicePostingError,
    register_exception_handlers,
)

__all__ = [
    # Config
    "settings",
    "get_settings",
    # Database
    "Base",
    "engine",
    "async_session_maker",
    "get_db",
    "get_db_context",
    "init_db",
    "close_db",
    # Security
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "verify_token",
    "TokenData",
    # Logging
    "setup_logging",
    "get_logger",
    # Exceptions
    "AppException",
    "NotFoundError",
    "ConflictError",
    "AppValidationError",
    "UnauthorizedError",
    "ForbiddenError",
    "InsufficientStockError",
    "ExpiredBatchError",
    "InvoicePostingError",
    "register_exception_handlers",
]
"""Security utilities: password hashing, JWT tokens."""
from datetime import datetime, timedelta, UTC
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.models import AppUser


# OAuth2 scheme for optional token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Password hashing - Argon2id
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class TokenData(BaseModel):
    """JWT token payload."""
    sub: str  # user id
    username: str
    exp: datetime
    type: str  # "access" or "refresh"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(
    subject: str,
    username: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode = {
        "sub": subject,
        "username": username,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(
    subject: str,
    username: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT refresh token."""
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    
    to_encode = {
        "sub": subject,
        "username": username,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        return TokenData(**payload)
    except JWTError:
        return None


def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
    """Verify a token and check its type."""
    token_data = decode_token(token)
    if token_data is None:
        return None
    if token_data.type != token_type:
        return None
    return token_data


async def get_current_user_db(db: AsyncSession, token: str) -> Optional[AppUser]:
    """Get current user from database using token."""
    token_data = verify_token(token, "access")
    if not token_data:
        return None
    
    result = await db.execute(select(AppUser).where(AppUser.id == token_data.sub))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    return user


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    """FastAPI dependency to get current user. In single-user mode, defaults to owner."""
    if token:
        user = await get_current_user_db(db, token)
        if user:
            return user

    # Default to first active user in database, or create default owner
    result = await db.execute(select(AppUser).order_by(AppUser.created_at))
    user = result.scalars().first()
    if not user:
        user = AppUser(
            username="owner",
            password_hash=get_password_hash("owner"),
            full_name="Business Owner",
            email="owner@walmus.local",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
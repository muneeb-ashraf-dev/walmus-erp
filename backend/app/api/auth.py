"""Authentication API endpoints."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    TokenData,
)
from app.models import AppUser, OwnerSettings
from app.schemas.auth import (
    Token,
    TokenRefresh,
    UserLogin,
    UserCreate,
    UserResponse,
    OwnerSetupRequest,
    OwnerSetupResponse,
)
from app.core.exceptions import UnauthorizedError, ConflictError, ValidationError as AppValidationError

router = APIRouter()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    """Get current authenticated user from access token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authorization header")
    
    token = auth_header.split(" ")[1]
    token_data = verify_token(token, "access")
    if not token_data:
        raise UnauthorizedError("Invalid or expired token")
    
    result = await db.execute(select(AppUser).where(AppUser.id == token_data.sub))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AppUser | None:
    """Get current user if authenticated, otherwise None."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    token_data = verify_token(token, "access")
    if not token_data:
        return None
    
    result = await db.execute(select(AppUser).where(AppUser.id == token_data.sub))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    
    return user


@router.post("/setup", response_model=OwnerSetupResponse, status_code=status.HTTP_201_CREATED)
async def setup_owner(
    data: OwnerSetupRequest,
    db: AsyncSession = Depends(get_db),
):
    """First-run owner setup: create owner settings and admin user."""
    # Check if already set up
    result = await db.execute(select(OwnerSettings))
    existing = result.scalar_one_or_none()
    if existing:
        raise ConflictError("Owner already set up")
    
    result = await db.execute(select(AppUser))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise ConflictError("User already exists")
    
    # Create owner settings
    owner_settings = OwnerSettings(
        business_name=data.business_name,
        business_address=data.business_address,
        phone=data.phone,
        email=data.email,
        tax_number=data.tax_number,
        currency=data.currency or "PKR",
        invoice_prefix=data.invoice_prefix or "INV",
        purchase_prefix=data.purchase_prefix or "PUR",
        financial_year_start_month=data.financial_year_start_month or 7,
        default_tax_rate=data.default_tax_rate or 0.0,
        opening_cash_balance=data.opening_cash_balance or 0.0,
        opening_bank_balance=data.opening_bank_balance or 0.0,
    )
    db.add(owner_settings)
    
    # Create admin user
    user = AppUser(
        username=data.username,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        email=data.email,
        is_active=True,
    )
    db.add(user)
    
    await db.commit()
    await db.refresh(owner_settings)
    await db.refresh(user)
    
    # Create tokens
    access_token = create_access_token(str(user.id), user.username)
    refresh_token = create_refresh_token(str(user.id), user.username)
    
    return OwnerSetupResponse(
        message="Owner setup completed successfully",
        user=UserResponse.model_validate(user),
        tokens=Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer"),
    )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """User login with username/password."""
    # Check if owner setup is complete
    result = await db.execute(select(OwnerSettings))
    owner_settings = result.scalar_one_or_none()
    if not owner_settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner setup not completed. Please run setup first.",
        )
    
    # Find user
    result = await db.execute(select(AppUser).where(AppUser.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        # Increment failed attempts
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                from datetime import datetime, UTC, timedelta
                user.locked_until = datetime.now(UTC) + timedelta(minutes=15)
            await db.commit()
        raise UnauthorizedError("Invalid username or password")
    
    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")
    
    if user.locked_until and user.locked_until > datetime.now(UTC):
        raise UnauthorizedError("Account temporarily locked due to failed attempts")
    
    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    from datetime import datetime, UTC
    user.last_login_at = datetime.now(UTC)
    await db.commit()
    
    # Create tokens
    access_token = create_access_token(str(user.id), user.username)
    refresh_token = create_refresh_token(str(user.id), user.username)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    data: TokenRefresh,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token."""
    token_data = verify_token(data.refresh_token, "refresh")
    if not token_data:
        raise UnauthorizedError("Invalid or expired refresh token")
    
    result = await db.execute(select(AppUser).where(AppUser.id == token_data.sub))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    
    access_token = create_access_token(str(user.id), user.username)
    new_refresh_token = create_refresh_token(str(user.id), user.username)
    
    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


@router.post("/logout")
async def logout(
    response: Response,
    current_user: AppUser = Depends(get_current_user),
):
    """User logout (client-side token removal)."""
    # In a stateless JWT system, logout is primarily client-side
    # Server-side would require a token blacklist (not implemented for simplicity)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: AppUser = Depends(get_current_user),
):
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.get("/owner-settings", response_model=OwnerSetupResponse)
async def get_owner_settings(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """Get owner settings."""
    result = await db.execute(select(OwnerSettings))
    settings = result.scalar_one_or_none()
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner settings not found",
        )
    
    return OwnerSetupResponse(
        message="Owner settings retrieved",
        user=UserResponse.model_validate(current_user),
        tokens=None,
    )
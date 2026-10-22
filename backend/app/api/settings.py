"""Settings API endpoints."""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, verify_password
from app.models import OwnerSettings, AppUser, ApplicationSetting
from app.schemas.settings import (
    OwnerSettingsResponse,
    OwnerSettingsUpdate,
    UserPasswordChange,
    UserProfileUpdate,
    AppSettingResponse,
    AppSettingUpdate,
)
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError, UnauthorizedError

router = APIRouter()


@router.get("/owner", response_model=OwnerSettingsResponse)
async def get_owner_settings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get owner/business settings."""
    result = await db.execute(select(OwnerSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        raise NotFoundError("Owner Settings", "not configured")
    return OwnerSettingsResponse.model_validate(settings)


@router.patch("/owner", response_model=OwnerSettingsResponse)
async def update_owner_settings(
    data: OwnerSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update owner/business settings."""
    result = await db.execute(select(OwnerSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        raise NotFoundError("Owner Settings", "not configured")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    
    await db.commit()
    await db.refresh(settings)
    return OwnerSettingsResponse.model_validate(settings)


@router.get("/profile", response_model=dict)
async def get_user_profile(
    current_user = Depends(get_current_user),
):
    """Get current user profile."""
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "last_login_at": current_user.last_login_at,
        "created_at": current_user.created_at,
    }


@router.patch("/profile", response_model=dict)
async def update_user_profile(
    data: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update current user profile."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.email is not None:
        current_user.email = data.email
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "last_login_at": current_user.last_login_at,
        "created_at": current_user.created_at,
    }


@router.post("/password")
@router.patch("/password")
async def change_password(
    data: UserPasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Change current user password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise UnauthorizedError("Current password is incorrect")
    
    if data.new_password != data.confirm_password:
        raise AppValidationError("New passwords do not match")
    
    current_user.password_hash = get_password_hash(data.new_password)
    current_user.failed_login_attempts = 0
    current_user.locked_until = None
    
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/app-settings", response_model=List[AppSettingResponse])
async def list_app_settings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List application settings."""
    result = await db.execute(select(ApplicationSetting))
    return [AppSettingResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/app-settings/{key}", response_model=AppSettingResponse)
async def get_app_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get application setting by key."""
    result = await db.execute(select(ApplicationSetting).where(ApplicationSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise NotFoundError("Application Setting", key)
    return AppSettingResponse.model_validate(setting)


@router.put("/app-settings/{key}", response_model=AppSettingResponse)
async def update_app_setting(
    key: str,
    data: AppSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update application setting."""
    result = await db.execute(select(ApplicationSetting).where(ApplicationSetting.key == key))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = data.value
        setting.description = data.description
        setting.updated_by = current_user.id
    else:
        setting = ApplicationSetting(
            key=key,
            value=data.value,
            description=data.description,
            updated_by=current_user.id,
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    return AppSettingResponse.model_validate(setting)
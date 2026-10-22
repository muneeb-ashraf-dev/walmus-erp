"""Authentication schemas."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Refresh token request."""
    refresh_token: str


class UserLogin(BaseModel):
    """User login request."""
    username: str
    password: str


class UserCreate(BaseModel):
    """User creation request."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None


class UserResponse(BaseModel):
    """User response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


class OwnerSetupRequest(BaseModel):
    """First-run owner setup request."""
    # Business info
    business_name: str = Field(..., min_length=1, max_length=200)
    business_address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    
    # Settings
    currency: str = Field(default="PKR", pattern="^[A-Z]{3}$")
    invoice_prefix: str = Field(default="INV", max_length=20)
    purchase_prefix: str = Field(default="PUR", max_length=20)
    financial_year_start_month: int = Field(default=7, ge=1, le=12)
    default_tax_rate: float = Field(default=0.0, ge=0, le=100)
    opening_cash_balance: float = Field(default=0.0, ge=0)
    opening_bank_balance: float = Field(default=0.0, ge=0)
    
    # Admin user
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=100)


class OwnerSetupResponse(BaseModel):
    """Owner setup response."""
    message: str
    user: UserResponse
    tokens: Optional[Token] = None
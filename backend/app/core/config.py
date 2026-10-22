"""Application configuration settings."""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = Field(..., alias="DATABASE_URL")
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="pharma_erp", alias="POSTGRES_DB")
    postgres_user: str = Field(default="pharma_user", alias="POSTGRES_USER")
    postgres_password: str = Field(default="secure_password", alias="POSTGRES_PASSWORD")
    
    # Backend
    backend_host: str = Field(default="127.0.0.1", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    
    # Security
    secret_key: str = Field(..., alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(default=480, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=30, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    
    # CORS
    cors_origins: List[str] = Field(
        default=["http://127.0.0.1:3000", "http://localhost:3000"],
        alias="CORS_ORIGINS"
    )
    
    # Frontend
    next_public_api_url: str = Field(default="http://127.0.0.1:8000", alias="NEXT_PUBLIC_API_URL")
    next_public_app_name: str = Field(default="Walmus Pharma ERP", alias="NEXT_PUBLIC_APP_NAME")
    
    # Backup
    backup_dir: str = Field(default="D:/pharma-erp-backups", alias="BACKUP_DIR")
    backup_retention_days: int = Field(default=30, alias="BACKUP_RETENTION_DAYS")
    
    # Application
    app_timezone: str = Field(default="Asia/Karachi", alias="APP_TIMEZONE")
    financial_year_start_month: int = Field(default=7, alias="FINANCIAL_YEAR_START_MONTH")
    default_currency: str = Field(default="PKR", alias="DEFAULT_CURRENCY")
    expiry_alert_days: str = Field(default="90,60,30,7", alias="EXPIRY_ALERT_DAYS")
    default_tax_rate: float = Field(default=0.0, alias="DEFAULT_TAX_RATE")
    
    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")
    
    @property
    def expiry_alert_days_list(self) -> List[int]:
        """Parse comma-separated expiry alert days."""
        return [int(x.strip()) for x in self.expiry_alert_days.split(",")]
    
    @property
    def current_financial_year(self) -> int:
        """Calculate current financial year based on start month."""
        from datetime import datetime
        import pytz
        
        tz = pytz.timezone(self.app_timezone)
        now = datetime.now(tz)
        if now.month >= self.financial_year_start_month:
            return now.year
        return now.year - 1
    
    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
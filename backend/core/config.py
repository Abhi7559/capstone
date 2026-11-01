import json
from typing import List, Union
from pydantic import Field, AliasChoices, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized typed configuration loaded from .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database & Redis
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres_db",
        description="Database connection URL",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        """Ensure connection string uses the asyncpg driver required by SQLAlchemy async engine."""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Security & Tokens
    TOKEN_SECRET_KEY: str = Field(
        default="development-secret-key-32-chars-long-teamhub",
        validation_alias="SECRET_KEY",
        description="Secret key used for token signing",
    )
    TOKEN_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=15,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
        description="Access token expiry duration in minutes",
    )
    TOKEN_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        validation_alias="REFRESH_TOKEN_EXPIRE_DAYS",
        description="Refresh token expiry duration in days",
    )

    # API Metadata & Environment
    PROJECT_NAME: str = "Team Hub API"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "Team Hub Workspace and Task Management API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_V1_PREFIX: str = "/task_management/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        validation_alias="CORS_ORIGINS",
        description="Allowed CORS origins",
    )

    @field_validator("BACKEND_CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Allow comma-separated strings or JSON arrays for CORS origins."""
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v_trimmed.split(",") if origin.strip()]
        return [str(item).strip() for item in v if str(item).strip()]

    # SMTP Email Configuration
    SMTP_HOST: str = Field(
        default="smtp.gmail.com",
        description="SMTP server host",
    )
    SMTP_PORT: int = Field(
        default=587,
        description="SMTP server port",
    )
    SMTP_USER: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_USER", "SMTP_USERNAME"),
        description="SMTP username or account email",
    )
    SMTP_PASSWORD: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_PASSWORD", "SMTP_PASS"),
        description="SMTP password or app password",
    )
    EMAILS_FROM_EMAIL: str = Field(
        default="abhishekbganeshwadi@gmail.com",
        validation_alias=AliasChoices("SMTP_FROM_EMAIL", "SMTP_FROM"),
        description="Sender email address for outgoing system emails",
    )
    EMAILS_FROM_NAME: str = Field(
        default="Team Hub",
        description="Sender display name",
    )
    FRONTEND_URL: str = Field(
        default="https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app",
        validation_alias=AliasChoices("FRONTEND_URL", "NEXT_PUBLIC_APP_URL"),
        description="Frontend base URL for invitation and activation links",
    )

    # Compatibility aliases
    @property
    def SECRET_KEY(self) -> str:
        return self.TOKEN_SECRET_KEY

    @property
    def ACCESS_TOKEN_EXPIRE_MINUTES(self) -> int:
        return self.TOKEN_ACCESS_TOKEN_EXPIRE_MINUTES

    @property
    def REFRESH_TOKEN_EXPIRE_DAYS(self) -> int:
        return self.TOKEN_REFRESH_TOKEN_EXPIRE_DAYS


# Single shared configuration object instantiated once at import time
settings = Settings()

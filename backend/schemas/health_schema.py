from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ServiceStatus(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )
    database: str
    redis: str


class HealthResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )
    status: str
    timestamp: datetime
    services: ServiceStatus

"""Dashboard API routes for role-tailored workspace metrics.

Implements:
- GET /dashboard/stats (API 21)
- Redis caching: key `kpi:dashboard:{role}:{user_id}`, TTL: 60 seconds
- Safe fallback to database on Redis miss/failure
"""

import json
from typing import Union
from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import logger
from database.redis import get_redis
from dependencies.auth import get_current_user
from dependencies.db import get_db
from models.user import User
from schemas.dashboard_schema import AdminDashboardData, MemberDashboardData
from services.dashboard_service import dashboard_service

router = APIRouter()


@router.get(
    "/stats",
    response_model=Union[AdminDashboardData, MemberDashboardData],
    status_code=status.HTTP_200_OK,
    summary="Get Dashboard Statistics",
    description="Retrieve role-tailored dashboard metrics and activities with Redis caching (TTL: 60s).",
    responses={
        200: {
            "description": "Dashboard statistics retrieved successfully.",
        },
        401: {
            "description": "Unauthorized: missing or invalid authentication token.",
        },
    },
)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> Union[AdminDashboardData, MemberDashboardData]:
    """
    Get role-specific dashboard metrics:
    - Admin callers receive global workspace metrics.
    - Member callers receive their own assigned tasks and projects.
    - Cached in Redis at `kpi:dashboard:{role}:{user_id}` for 60 seconds.
    """
    user_role = (current_user.role or "member").lower()
    cache_key = f"kpi:dashboard:{user_role}:{current_user.id}"

    # 1. Attempt reading from Redis cache
    if redis is not None:
        try:
            cached_raw = await redis.get(cache_key)
            if cached_raw:
                cached_data = json.loads(cached_raw)
                if user_role == "admin":
                    return AdminDashboardData.model_validate(cached_data)
                return MemberDashboardData.model_validate(cached_data)
        except Exception as exc:
            logger.warning("Redis read error for key '%s': %s", cache_key, exc)

    # 2. Cache miss or Redis error: calculate from database via service layer
    stats = await dashboard_service.get_dashboard_stats(db, current_user)

    # 3. Store serialized result in Redis cache (TTL: 60 seconds)
    if redis is not None:
        try:
            serialized_payload = stats.model_dump_json(by_alias=True)
            await redis.set(cache_key, serialized_payload, ex=60)
        except Exception as exc:
            logger.warning("Redis write error for key '%s': %s", cache_key, exc)

    return stats

"""Analytics API routes for Recharts task visual aggregations.

Implements:
- GET /analytics/data (API 22)
- Redis caching: key `kpi:analytics:{project_id_or_all}`, TTL: 300 seconds
- Safe fallback to database on Redis miss/failure
"""

import json
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import logger
from database.redis import get_redis
from dependencies.auth import get_current_user
from dependencies.db import get_db
from models.user import User
from schemas.analytics_schema import AnalyticsDataResponse
from services.analytics_service import analytics_service

router = APIRouter()


@router.get(
    "/data",
    response_model=AnalyticsDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Analytics Data",
    description="Retrieve task status distribution, assignee workloads, and completion trends for Recharts (TTL: 300s).",
    responses={
        200: {
            "description": "Analytics dataset retrieved successfully.",
        },
        401: {
            "description": "Unauthorized: missing or invalid authentication token.",
        },
        403: {
            "description": "Forbidden: user does not have permission to access this project's analytics.",
        },
        404: {
            "description": "Not Found: specified project does not exist.",
        },
    },
)
async def get_analytics_data(
    projectId: Optional[UUID] = Query(
        default=None,
        description="Optional project ID to filter analytics to a specific project.",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> AnalyticsDataResponse:
    """
    Get task analytics:
    - Status distribution (Pie Chart)
    - Tasks by assignee workload (Bar Chart)
    - 7-day completion trends (Line Chart)
    - Cached in Redis at `kpi:analytics:{project_id_or_all}` for 300 seconds.
    """
    user_role = (current_user.role or "member").lower()
    is_admin = user_role == "admin"

    # Build cache key:
    # When project_id is provided, the key is kpi:analytics:{project_id}.
    # When omitted, if caller is admin it's kpi:analytics:all; if member it distinguishes user_id to prevent data leakage.
    if projectId is not None:
        project_scope = str(projectId)
        cache_key = f"kpi:analytics:{project_scope}"
    else:
        project_scope = "all"
        cache_key = (
            f"kpi:analytics:all"
            if is_admin
            else f"kpi:analytics:member:{current_user.id}"
        )

    # 1. Attempt reading from Redis cache (only after verifying user is authenticated)
    if redis is not None:
        try:
            cached_raw = await redis.get(cache_key)
            if cached_raw:
                cached_data = json.loads(cached_raw)
                return AnalyticsDataResponse.model_validate(cached_data)
        except Exception as exc:
            logger.warning("Redis read error for analytics key '%s': %s", cache_key, exc)

    # 2. Cache miss or Redis error: calculate from database via service layer
    # (service enforces project permissions: raises 404 if project missing, 403 if member unauthorized)
    analytics = await analytics_service.get_analytics_data(
        db, current_user=current_user, project_id=projectId
    )

    # 3. Store serialized result in Redis cache (TTL: 300 seconds)
    if redis is not None:
        try:
            serialized_payload = analytics.model_dump_json(by_alias=True)
            await redis.set(cache_key, serialized_payload, ex=300)
        except Exception as exc:
            logger.warning("Redis write error for analytics key '%s': %s", cache_key, exc)

    return analytics

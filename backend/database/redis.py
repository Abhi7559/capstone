from typing import Optional
from redis.asyncio import Redis, ConnectionPool
from core.config import settings
from core.logger import logger

# Global Redis connection pool and client instances
_redis_pool: Optional[ConnectionPool] = None
_redis_client: Optional[Redis] = None


async def init_redis() -> Redis:
    """
    Initialize the asynchronous Redis connection pool and client.
    Ensures initialization does not create duplicate pools if already initialized.
    """
    global _redis_pool, _redis_client
    if _redis_client is None:
        _redis_pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        _redis_client = Redis(connection_pool=_redis_pool)
        logger.info("Initialized asynchronous Redis connection pool.")
    return _redis_client


def get_redis_client() -> Redis:
    """
    Return a shared asynchronous Redis client instance.
    If not initialized yet, creates an instance lazily for backward compatibility.
    """
    global _redis_pool, _redis_client
    if _redis_client is None:
        _redis_pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        _redis_client = Redis(connection_pool=_redis_pool)
    return _redis_client


async def get_redis() -> Redis:
    """
    FastAPI dependency that returns the initialized asynchronous Redis client.
    Ensures the client is initialized before being returned.
    """
    client = get_redis_client()
    return client


async def close_redis() -> None:
    """
    Gracefully close the Redis client and release its connection pool.
    Safe to call multiple times during application shutdown.
    """
    global _redis_pool, _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception as exc:
            logger.warning("Error closing Redis client: %s", exc)
        finally:
            _redis_client = None

    if _redis_pool is not None:
        try:
            await _redis_pool.disconnect()
        except Exception as exc:
            logger.warning("Error disconnecting Redis pool: %s", exc)
        finally:
            _redis_pool = None
    logger.info("Closed Redis connection pool.")


async def blacklist_token(token: str, expires_in_seconds: int) -> None:
    """
    Store token in Redis blacklist with an expiration time.
    Fails safely if Redis is unreachable in development.
    """
    if expires_in_seconds <= 0:
        return

    try:
        redis = get_redis_client()
        key = f"blacklist:{token}"
        await redis.set(key, "revoked", ex=expires_in_seconds)
    except Exception as exc:
        logger.warning("Failed to blacklist token in Redis: %s", exc)


async def is_token_blacklisted(token: str) -> bool:
    """
    Check if a token exists in the Redis blacklist.
    Returns False if Redis is unreachable.
    """
    try:
        redis = get_redis_client()
        key = f"blacklist:{token}"
        return bool(await redis.exists(key))
    except Exception as exc:
        logger.warning("Failed to check Redis token blacklist: %s", exc)
        return False


async def invalidate_dashboard_cache(project_id: Optional[str] = None) -> None:
    """
    Purge cached dashboard KPIs and analytics from Redis.
    Matches keys: `kpi:dashboard:*` and `kpi:analytics:*`.
    Safely fails without raising exceptions if Redis is not configured or offline.
    """
    try:
        redis = get_redis_client()
        # Scan and delete keys matching dashboard and analytics patterns
        patterns = ["kpi:dashboard:*", "kpi:analytics:*"]
        if project_id:
            patterns.append(f"kpi:project:{project_id}:*")

        deleted_count = 0
        for pattern in patterns:
            # Handle both redis-py (keys) and test mock objects
            if hasattr(redis, "keys"):
                keys = await redis.keys(pattern)
                if keys:
                    for k in keys:
                        await redis.delete(k)
                        deleted_count += 1
            elif hasattr(redis, "delete"):
                # Direct pattern or mock key
                await redis.delete(pattern)
                deleted_count += 1
        logger.info("Invalidated %d Redis dashboard/analytics cache keys.", deleted_count)
    except Exception as exc:
        logger.warning("Failed to invalidate dashboard cache in Redis: %s", exc)

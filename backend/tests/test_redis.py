import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import database.redis as redis_module


@pytest.mark.asyncio
async def test_init_redis_creates_pool_and_client():
    """Verify init_redis initializes a ConnectionPool and Redis client without duplicates."""
    # Ensure fresh state
    await redis_module.close_redis()

    with patch("database.redis.ConnectionPool.from_url") as mock_from_url:
        mock_pool = MagicMock()
        mock_from_url.return_value = mock_pool

        with patch("database.redis.Redis") as mock_redis_cls:
            mock_client = MagicMock()
            mock_redis_cls.return_value = mock_client

            # 1. First call initializes pool and client
            client1 = await redis_module.init_redis()
            assert client1 is mock_client
            mock_from_url.assert_called_once()
            mock_redis_cls.assert_called_once_with(connection_pool=mock_pool)

            # 2. Repeated initialization reuses existing pool/client without duplicating
            client2 = await redis_module.init_redis()
            assert client2 is client1
            assert mock_from_url.call_count == 1
            assert mock_redis_cls.call_count == 1

    # Cleanup
    await redis_module.close_redis()


@pytest.mark.asyncio
async def test_get_redis_dependency():
    """Verify get_redis returns the initialized client."""
    await redis_module.close_redis()

    with patch("database.redis.ConnectionPool.from_url") as mock_from_url:
        mock_pool = MagicMock()
        mock_from_url.return_value = mock_pool

        with patch("database.redis.Redis") as mock_redis_cls:
            mock_client = MagicMock()
            mock_redis_cls.return_value = mock_client

            client = await redis_module.get_redis()
            assert client is mock_client

    # Cleanup
    await redis_module.close_redis()


@pytest.mark.asyncio
async def test_close_redis_cleans_up():
    """Verify close_redis closes client and pool cleanly."""
    mock_client = MagicMock()
    mock_client.aclose = AsyncMock()
    mock_pool = MagicMock()
    mock_pool.disconnect = AsyncMock()

    redis_module._redis_client = mock_client
    redis_module._redis_pool = mock_pool

    await redis_module.close_redis()

    mock_client.aclose.assert_awaited_once()
    mock_pool.disconnect.assert_awaited_once()
    assert redis_module._redis_client is None
    assert redis_module._redis_pool is None

    # Safe to call again when already closed
    await redis_module.close_redis()
    assert redis_module._redis_client is None
    assert redis_module._redis_pool is None


@pytest.mark.asyncio
async def test_lifespan_redis_integration():
    """Verify FastAPI lifespan triggers init_redis and close_redis."""
    from main import lifespan
    from fastapi import FastAPI

    app = FastAPI()

    with patch("database.redis.init_redis", new_callable=AsyncMock) as mock_init:
        with patch("database.redis.close_redis", new_callable=AsyncMock) as mock_close:
            async with lifespan(app):
                mock_init.assert_awaited_once()
                assert mock_close.await_count == 0

            mock_close.assert_awaited_once()

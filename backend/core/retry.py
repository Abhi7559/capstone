import asyncio
import functools
from typing import Any, Callable, Tuple, Type
from core.logger import logger


def retry_with_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Tuple[Type[BaseException], ...] = (Exception,),
) -> Callable:
    """
    Decorator that retries an async function with exponential backoff.
    
    Parameters:
    - max_retries: Total number of attempts allowed before giving up.
    - initial_delay: Seconds to wait after the first failure.
    - backoff_factor: Multiplier applied to the delay after each failed attempt.
    - exceptions: Tuple of exception classes that trigger a retry.
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            delay = initial_delay
            for attempt in range(1, max_retries + 1):
                try:
                    result = await func(*args, **kwargs)
                    # If function returns a boolean indicating success and returned False, retry as well
                    if isinstance(result, bool) and not result and attempt < max_retries:
                        logger.warning(
                            "[Retry %d/%d] %s returned False. Retrying in %.2fs...",
                            attempt,
                            max_retries,
                            func.__name__,
                            delay,
                        )
                        await asyncio.sleep(delay)
                        delay *= backoff_factor
                        continue
                    return result
                except exceptions as exc:
                    if attempt == max_retries:
                        logger.error(
                            "[Retry Failed] %s failed after %d attempts: %s",
                            func.__name__,
                            max_retries,
                            exc,
                        )
                        raise
                    logger.warning(
                        "[Retry %d/%d] %s raised %s: %s. Retrying in %.2fs...",
                        attempt,
                        max_retries,
                        func.__name__,
                        type(exc).__name__,
                        exc,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    delay *= backoff_factor
            return False

        return wrapper

    return decorator


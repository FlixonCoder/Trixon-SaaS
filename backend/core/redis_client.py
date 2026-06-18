"""
Trixon Backend — Redis Client

Initializes Redis connection and RQ queue for background job processing.
Gracefully handles missing Redis — logs a warning instead of crashing.
"""

import logging

import redis
import sys
import signal

# Windows compatibility patch for RQ (which expects Unix signals)
if sys.platform == "win32":
    signal.SIGUSR1 = getattr(signal, "SIGUSR1", 10)
    signal.SIGUSR2 = getattr(signal, "SIGUSR2", 12)
    signal.SIGRTMIN = getattr(signal, "SIGRTMIN", 27)
    signal.SIGALRM = getattr(signal, "SIGALRM", 14)

from rq import Queue

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_redis_client: redis.Redis | None = None
_task_queue: Queue | None = None


def get_redis() -> redis.Redis | None:
    """
    Returns the Redis client singleton.
    Returns None if Redis is unavailable (local dev without docker-compose).
    """
    global _redis_client

    if _redis_client is not None:
        return _redis_client

    settings = get_settings()

    try:
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        # Verify connectivity
        _redis_client.ping()
        logger.info("Redis client connected successfully.")
        return _redis_client
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(
            f"Redis is not available ({e}). "
            "Background jobs will not work. "
            "Run 'docker-compose up redis' to start a local Redis instance."
        )
        _redis_client = None
        return None
    except Exception as e:
        logger.error(f"Unexpected error connecting to Redis: {e}")
        _redis_client = None
        return None


def get_task_queue() -> Queue | None:
    """
    Returns the RQ task queue for enqueuing background jobs.
    Returns None if Redis is unavailable.
    """
    global _task_queue

    if _task_queue is not None:
        return _task_queue

    redis_conn = get_redis()
    if redis_conn is None:
        return None

    _task_queue = Queue("default", connection=redis_conn)
    logger.info("RQ task queue initialized on 'default' queue.")
    return _task_queue


async def check_redis_health() -> bool:
    """Checks if Redis is reachable."""
    try:
        client = get_redis()
        if client is None:
            return False
        client.ping()
        return True
    except Exception:
        return False

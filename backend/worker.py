"""
Trixon Backend — RQ Worker Entry Point

Starts an RQ worker process that listens on the 'default' queue
for background jobs (codebase analysis, report generation, etc.).

Usage:
    python -m backend.worker

Requires Redis to be running. For local development:
    docker-compose up redis
"""

import logging
import sys
import signal

# Windows compatibility patch for RQ (which expects Unix signals)
if sys.platform == "win32":
    signal.SIGUSR1 = getattr(signal, "SIGUSR1", 10)
    signal.SIGUSR2 = getattr(signal, "SIGUSR2", 12)
    signal.SIGRTMIN = getattr(signal, "SIGRTMIN", 27)
    signal.SIGALRM = getattr(signal, "SIGALRM", 14)

from redis import Redis
from rq import Worker, SimpleWorker

# Use SimpleWorker on Windows since os.fork() is not available
if sys.platform == "win32":
    WorkerClass = SimpleWorker
    
    class WindowsDeathPenalty:
        def __init__(self, timeout, exception, **kwargs):
            pass
        def __enter__(self):
            pass
        def __exit__(self, type, value, traceback):
            pass
else:
    WorkerClass = Worker

from backend.core.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def start_worker():
    """Start the RQ worker process."""
    settings = get_settings()

    logger.info(f"Starting Trixon RQ Worker (connecting to {settings.redis_url})")

    try:
        redis_conn = Redis.from_url(
            settings.redis_url,
            decode_responses=False,  # RQ needs bytes
            socket_connect_timeout=10,
        )
        redis_conn.ping()
        logger.info("✓ Connected to Redis")
    except Exception as e:
        logger.error(f"✗ Cannot connect to Redis: {e}")
        logger.error("Make sure Redis is running. For local dev: docker-compose up redis")
        sys.exit(1)

    queues = ["default"]
    worker = WorkerClass(queues, connection=redis_conn)
    
    if sys.platform == "win32":
        worker.death_penalty_class = WindowsDeathPenalty

    logger.info(f"✓ Worker listening on queues: {queues}")
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    start_worker()

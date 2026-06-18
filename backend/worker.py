"""
Trixon Backend — RQ Worker

NOT CURRENTLY USED. Kept for future horizontal scaling.
See trixon-cleanup-audit-prompt.md for context.
"""

import logging

logger = logging.getLogger(__name__)

def start_worker():
    logger.warning("Worker process is deprecated. Analysis jobs now run in-process via FastAPI BackgroundTasks.")

if __name__ == "__main__":
    start_worker()

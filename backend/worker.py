"""
DEPRECATED — analysis jobs now run via FastAPI BackgroundTasks in main.py.
This file is no longer used for background job processing.
"""

import logging

logger = logging.getLogger(__name__)

def start_worker():
    logger.warning("Worker process is deprecated. Analysis jobs now run in-process via FastAPI BackgroundTasks.")

if __name__ == "__main__":
    start_worker()

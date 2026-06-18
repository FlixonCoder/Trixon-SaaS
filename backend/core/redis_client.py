"""
DEPRECATED — Redis and RQ are no longer used.
This module is kept temporarily to avoid breaking any stray imports,
but all functions return None.
"""

def get_redis():
    return None

def get_task_queue():
    return None

async def check_redis_health() -> bool:
    return False

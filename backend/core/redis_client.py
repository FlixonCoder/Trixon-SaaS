"""
Trixon Backend — Redis Client

NOT CURRENTLY USED. Kept for future horizontal scaling and rate-limiting.
See trixon-cleanup-audit-prompt.md for context.
"""

def get_redis():
    return None

def get_task_queue():
    return None

async def check_redis_health() -> bool:
    return False

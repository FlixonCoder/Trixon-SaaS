import pytest
from unittest.mock import MagicMock, AsyncMock

@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    # Provide default behaviors if needed for tests
    return mock

@pytest.fixture
def mock_redis():
    mock = MagicMock()
    return mock

@pytest.fixture
def mock_get_current_user():
    return {
        "id": "12345678-1234-1234-1234-123456789012",
        "email": "test@example.com",
        "role": "authenticated"
    }

@pytest.fixture
def client(mock_supabase, mock_redis, mock_get_current_user):
    from fastapi.testclient import TestClient
    from backend.main import app
    from backend.core.auth import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_get_current_user

    # Mock the internal singletons
    import backend.core.supabase_client as sc
    import backend.core.redis_client as rc
    
    original_supabase = sc._supabase_client
    original_check_supabase = sc.check_supabase_health
    original_check_redis = rc.check_redis_health

    sc._supabase_client = mock_supabase
    sc.check_supabase_health = AsyncMock(return_value=True)
    rc.check_redis_health = AsyncMock(return_value=True)

    with TestClient(app) as test_client:
        yield test_client

    # Restore overrides
    app.dependency_overrides.clear()
    sc._supabase_client = original_supabase
    sc.check_supabase_health = original_check_supabase
    rc.check_redis_health = original_check_redis

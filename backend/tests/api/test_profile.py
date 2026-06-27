from fastapi.testclient import TestClient
from unittest.mock import MagicMock

def test_get_profile(client: TestClient, mock_supabase):
    mock_execute = MagicMock()
    mock_execute.data = {
        "id": "12345678-1234-1234-1234-123456789012",
        "full_name": "Test User",
        "company_name": "Test Co",
        "role": "founder",
        "primary_goal": "understand codebase",
        "plan": "free",
        "created_at": "2023-01-01T00:00:00Z"
    }
    # profile.py uses maybe_single()
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_execute
    
    response = client.get("/api/v1/profile")
    assert response.status_code == 200
    assert response.json()["full_name"] == "Test User"

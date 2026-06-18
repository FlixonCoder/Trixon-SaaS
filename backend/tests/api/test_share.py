from fastapi.testclient import TestClient
from unittest.mock import MagicMock

def test_get_share_invalid_token(client: TestClient, mock_supabase):
    # Public endpoint, no auth required
    mock_execute = MagicMock()
    mock_execute.data = None
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_execute
    
    response = client.get("/api/v1/share/invalid-token")
    assert response.status_code == 404

def test_share_report_unauthorized(client: TestClient):
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.post("/api/v1/reports/rep-123/share", json={"enabled": True})
    assert response.status_code == 401

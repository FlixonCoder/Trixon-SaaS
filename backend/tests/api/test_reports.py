from fastapi.testclient import TestClient
from unittest.mock import MagicMock

def test_get_report_not_found(client: TestClient, mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
    
    response = client.get("/api/v1/analyses/analysis-123/reports/security")
    # Will be 404 because analysis check fails
    assert response.status_code == 404

def test_simplify_report(client: TestClient, mock_supabase):
    # This endpoint is in api/reports.py
    # Not yet created the test, but we can hit it to check auth
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.post("/api/v1/reports/rep-123/simplify", json={"text": "Complex tech debt"})
    assert response.status_code == 401

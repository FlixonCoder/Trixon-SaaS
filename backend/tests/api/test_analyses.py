from fastapi.testclient import TestClient
from unittest.mock import MagicMock

def test_get_analysis_not_found(client: TestClient, mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
    
    response = client.get("/api/v1/analyses/analysis-123")
    assert response.status_code == 404
    assert response.json()["detail"] == "Analysis not found"

def test_get_analysis_success(client: TestClient, mock_supabase):
    # This is a bit brittle, but tests the success path
    mock_execute = MagicMock()
    mock_execute.data = {
        "id": "analysis-123",
        "project_id": "proj-123",
        "status": "complete",
        "created_at": "2023-01-01",
    }
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_execute
    
    response = client.get("/api/v1/analyses/analysis-123")
    assert response.status_code == 200
    assert response.json()["status"] == "complete"

def test_list_reports(client: TestClient, mock_supabase):
    # In endpoints, there's often multiple supabase calls (one to verify ownership, one to get data)
    # Testing that directly with mock_supabase requires more advanced side_effect mocking, 
    # but let's test authorization failure for now.
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.get("/api/v1/analyses/analysis-123/reports")
    assert response.status_code == 401

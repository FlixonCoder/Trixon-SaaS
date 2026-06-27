from fastapi.testclient import TestClient
from unittest.mock import MagicMock

def test_get_analysis_not_found(client: TestClient, mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
    
    response = client.get("/api/v1/analyses/analysis-123")
    assert response.status_code == 404
    assert response.json()["detail"] == "Analysis not found"

def test_get_analysis_success(client: TestClient, mock_supabase):
    def table_mock(table_name):
        mock_chain = MagicMock()
        if table_name == "analyses":
            mock_execute = MagicMock()
            mock_execute.data = {
                "id": "analysis-123",
                "project_id": "proj-123",
                "status": "complete",
                "created_at": "2023-01-01",
            }
            mock_chain.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_execute
        elif table_name == "projects":
            mock_execute = MagicMock()
            mock_execute.data = {
                "user_id": "12345678-1234-1234-1234-123456789012"
            }
            mock_chain.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_execute
        return mock_chain

    mock_supabase.table.side_effect = table_mock
    
    response = client.get("/api/v1/analyses/analysis-123")
    assert response.status_code == 200
    assert response.json()["status"] == "complete"

def test_list_reports(client: TestClient, mock_supabase):
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.get("/api/v1/analyses/analysis-123/reports")
    assert response.status_code == 401

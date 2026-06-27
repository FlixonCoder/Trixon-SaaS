from fastapi.testclient import TestClient

def test_health_check_ok(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["supabase"] is True

from fastapi.testclient import TestClient

def test_connect_github_unauthorized(client: TestClient):
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.post("/api/v1/vcs/github/connect", json={"code": "123"})
    assert response.status_code == 401

def test_disconnect_vcs_unauthorized(client: TestClient):
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.delete("/api/v1/vcs/123")
    assert response.status_code == 401

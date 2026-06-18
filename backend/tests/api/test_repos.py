from fastapi.testclient import TestClient

def test_list_github_repos_unauthorized(client: TestClient):
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.get("/api/v1/github/repos")
    assert response.status_code == 401

def test_list_gitlab_repos_unauthorized(client: TestClient):
    from backend.main import app
    app.dependency_overrides.clear()
    
    response = client.get("/api/v1/gitlab/repos")
    assert response.status_code == 401

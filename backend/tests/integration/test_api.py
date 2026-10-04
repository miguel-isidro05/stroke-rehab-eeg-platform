from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_health_endpoint_reports_ready_state() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_process_endpoint_requires_both_files() -> None:
    response = client.post("/process")

    assert response.status_code == 422

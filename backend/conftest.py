import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture(scope="module")
def test_client():
    """
    Creates an isolated in-memory HTTP client instance hooked 
    straight into our FastAPI gateway app for rapid test execution.
    """
    with TestClient(app) as client:
        yield client

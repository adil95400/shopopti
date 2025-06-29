import sys
import pathlib
import os
import pytest
import httpx
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
import importlib.util

connect_path = pathlib.Path(__file__).resolve().parents[1] / "api" / "connect.py"
spec = importlib.util.spec_from_file_location("connect", connect_path)
connect = importlib.util.module_from_spec(spec)
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "key")
spec.loader.exec_module(connect)  # type: ignore

validate_ebay = connect.validate_ebay
validate_prestashop = connect.validate_prestashop
validate_cdiscount_pro = connect.validate_cdiscount_pro

class MockAsyncClient:
    def __init__(self, response: httpx.Response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def get(self, *a, **k):
        return self._response

    async def post(self, *a, **k):
        return self._response

@pytest.mark.asyncio
async def test_validate_ebay(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: MockAsyncClient(httpx.Response(200)))
    valid, error = await validate_ebay({"auth_token": "token"})
    assert valid and error is None

@pytest.mark.asyncio
async def test_validate_prestashop(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: MockAsyncClient(httpx.Response(200)))
    valid, error = await validate_prestashop({"store_url": "https://shop.example.com", "api_key": "key"})
    assert valid and error is None

@pytest.mark.asyncio
async def test_validate_cdiscount(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: MockAsyncClient(httpx.Response(200)))
    valid, error = await validate_cdiscount_pro({"api_key": "key"})
    assert valid and error is None

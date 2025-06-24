import asyncio
import unittest
from unittest.mock import AsyncMock, patch
import importlib.util
from pathlib import Path
import os
from unittest.mock import MagicMock

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "key")

with patch("supabase.create_client", return_value=MagicMock()):
    connect_spec = importlib.util.spec_from_file_location(
        "connect",
        Path(__file__).resolve().parents[1] / "api" / "connect.py",
    )
    connect = importlib.util.module_from_spec(connect_spec)
    connect_spec.loader.exec_module(connect)

validate_ebay = connect.validate_ebay
validate_prestashop = connect.validate_prestashop
validate_cdiscount_pro = connect.validate_cdiscount_pro

class ValidatorTests(unittest.TestCase):
    def test_validate_ebay_missing(self):
        valid, err = asyncio.run(validate_ebay({}))
        self.assertFalse(valid)
        self.assertIsNotNone(err)

    def test_validate_ebay_success(self):
        valid, err = asyncio.run(validate_ebay({
            "auth_token": "t",
            "app_id": "a",
            "cert_id": "c",
            "dev_id": "d"
        }))
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_validate_prestashop_success(self):
        async def mock_get(*args, **kwargs):
            class Resp:
                status_code = 200
            return Resp()
        with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=mock_get)):
            valid, err = asyncio.run(validate_prestashop({"store_url": "http://x", "api_key": "k"}))
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_validate_cdiscount_pro_missing(self):
        valid, err = asyncio.run(validate_cdiscount_pro({}))
        self.assertFalse(valid)
        self.assertIsNotNone(err)

if __name__ == "__main__":
    unittest.main()

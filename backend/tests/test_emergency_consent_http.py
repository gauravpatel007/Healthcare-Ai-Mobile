"""HTTP boundary checks; never uses a database or sends a notification."""
import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@127.0.0.1:1/test"
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.database import get_db
from app.dependencies import get_current_user_id
from app.exceptions import register_exception_handlers
from app.routers.emergency import router
from app.routers import emergency_consent
from app.schemas.emergency import SOSAlertResponse


class ConsentHttpTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router, prefix="/api/v1")
        register_exception_handlers(self.app)
        self.app.dependency_overrides[get_db] = lambda: object()
        self.client = TestClient(self.app)

    def test_accept_invite_and_inbox_require_login(self):
        for method, path, body in [
            ("POST", "/invitations/accept", {"token": "a" * 43, "consent": True}),
            ("POST", "/contacts/contact/invitation", {}),
            ("POST", "/accepted-contacts/contact/revoke", {}),
            ("GET", "/accepted-contacts", None),
            ("GET", "/received-alerts", None),
        ]:
            response = self.client.request(method, "/api/v1/emergency" + path, json=body)
            self.assertEqual(response.status_code, 401, response.text)

    def test_preview_has_no_mutating_get_route(self):
        response = self.client.get("/api/v1/emergency/invitations/accept?token=" + "a" * 43)
        self.assertEqual(response.status_code, 405)

    def test_invalid_token_body_is_rejected_before_database_access(self):
        self.assertEqual(self.client.post("/api/v1/emergency/invitations/preview", json={"token": "short"}).status_code, 422)

    def test_sos_route_uses_consented_dispatch(self):
        self.app.dependency_overrides[get_current_user_id] = lambda: "sender"
        with patch("app.routers.emergency.dispatch_consented_sos", new_callable=AsyncMock) as dispatch:
            dispatch.return_value = SOSAlertResponse(success=False, message="No accepted contacts", actions=[])
            result = self.client.post("/api/v1/emergency/sos", json={"is_silent": True})
            self.assertEqual(result.status_code, 200)
            self.assertFalse(result.json()["success"])
            self.assertEqual(dispatch.call_args.args[1], "sender")


if __name__ == "__main__":
    unittest.main()

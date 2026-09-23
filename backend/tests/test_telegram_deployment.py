"""Exercise the deployment migration against old and empty databases."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, inspect, text


class DeploymentMigrationTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).resolve().parents[2] / "alembic/versions/8d7a091fbc23_telegram_verification.py"
        spec = importlib.util.spec_from_file_location("telegram_revision", path)
        self.revision = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.revision)
        self.engine = create_engine("sqlite:///:memory:")
        self.addCleanup(self.engine.dispose)

    def test_existing_installation_gets_columns_and_session_table(self):
        with self.engine.begin() as connection:
            connection.execute(text("CREATE TABLE emergency_contacts (id VARCHAR(36) PRIMARY KEY)"))
            connection.execute(text("INSERT INTO emergency_contacts VALUES ('existing')"))
            with patch.object(self.revision.op, "get_bind", return_value=connection):
                self.revision.upgrade()
                self.revision.upgrade()
            self.assertTrue(inspect(connection).has_table("telegram_verification_sessions"))
            row = connection.execute(text(
                "SELECT id, verification_status, telegram_chat_id FROM emergency_contacts"
            )).one()
            self.assertEqual(tuple(row), ("existing", "pending", None))

    def test_empty_installation_defers_tables_to_application_startup(self):
        with self.engine.begin() as connection:
            with patch.object(self.revision.op, "get_bind", return_value=connection):
                self.revision.upgrade()
            self.assertFalse(inspect(connection).has_table("emergency_contacts"))

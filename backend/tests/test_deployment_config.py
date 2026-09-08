import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.config import Settings, ROOT_DIR


class DeploymentTests(unittest.TestCase):
    def test_environment_precedence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'root.env'
            backend = Path(folder) / 'backend.env'
            root.write_text('TWILIO_AUTH_TOKEN=root\n')
            backend.write_text('TWILIO_AUTH_TOKEN=backend\n')
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(Settings(_env_file=(root, backend)).TWILIO_AUTH_TOKEN, 'backend')
                with patch.dict(os.environ, {'TWILIO_AUTH_TOKEN': 'process'}):
                    self.assertEqual(Settings(_env_file=(root, backend)).TWILIO_AUTH_TOKEN, 'process')

    def test_migration_handles_fresh_existing_and_already_migrated_databases(self):
        path = ROOT_DIR / 'alembic/versions/5a81ec3787d2_add_webauthn_credentials_column.py'
        spec = importlib.util.spec_from_file_location('migration_under_test', path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        engine = sa.create_engine('sqlite:///:memory:')
        with engine.begin() as connection:
            with patch.object(migration, 'op', Operations(MigrationContext.configure(connection))):
                migration.upgrade()
                connection.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
                migration.upgrade()
                migration.upgrade()
                columns = sa.inspect(connection).get_columns('users')
                self.assertEqual(sum(c['name'] == 'webauthn_credentials' for c in columns), 1)
        engine.dispose()

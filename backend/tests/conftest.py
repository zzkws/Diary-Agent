from pathlib import Path
import shutil
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine

from backend.app import main
from backend.app.core import db
from backend.app.core.config import settings
from backend.app.services.checkin import checkin_store


@pytest.fixture()
def client():
    workspace_root = Path(__file__).resolve().parents[2]
    artifact_root = workspace_root / "backend" / "test_artifacts" / uuid4().hex
    database_path = artifact_root / "test-diary.db"
    export_root = artifact_root / "exports"
    artifact_root.mkdir(parents=True, exist_ok=True)
    test_engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
    )

    original_db_engine = db.engine
    original_main_engine = main.engine
    original_export_root = settings.export_root

    db.engine = test_engine
    main.engine = test_engine
    settings.export_root = export_root
    checkin_store._sessions.clear()

    try:
        with TestClient(main.app) as test_client:
            yield test_client, export_root
    finally:
        checkin_store._sessions.clear()
        settings.export_root = original_export_root
        main.engine = original_main_engine
        db.engine = original_db_engine
        test_engine.dispose()
        shutil.rmtree(artifact_root, ignore_errors=True)

import sqlite3

from sqlalchemy import create_engine, inspect

from app.core.session_service import SessionService
from app.db.migrations import upgrade_schema
from sqlalchemy.orm import sessionmaker

OLD_SCHEMA = """
CREATE TABLE sessions (id VARCHAR PRIMARY KEY, created_at DATETIME);
CREATE TABLE turns (
    id VARCHAR PRIMARY KEY, session_id VARCHAR NOT NULL, user_message TEXT NOT NULL,
    model_response TEXT NOT NULL, serving_condition VARCHAR NOT NULL, model_version VARCHAR NOT NULL,
    decoding_config JSON NOT NULL, prompt_tokens INTEGER, output_tokens INTEGER, created_at DATETIME
);
INSERT INTO sessions VALUES ('old-1', '2026-10-01 10:00:00');
INSERT INTO turns VALUES ('t1', 'old-1', 'What is the vadi of Yaman?', 'Ga.', 'baseline', 'mock-0.0',
                          '{}', 5, 1, '2026-10-01 10:05:00');
"""


def make_old_db(tmp_path):
    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.executescript(OLD_SCHEMA)
    conn.commit()
    conn.close()
    return create_engine(f"sqlite:///{path}")


def test_adds_missing_columns_and_backfills_activity_time(tmp_path):
    engine = make_old_db(tmp_path)

    applied = upgrade_schema(engine)

    assert applied == [
        "sessions.title",
        "sessions.updated_at",
        "sessions.pinned",
        "sessions.archived_at",
        "sessions.share_token",
        "sessions.shared_at",
        "turns.feedback",
        "turns.feedback_at",
    ]
    assert {"title", "updated_at", "pinned"} <= {c["name"] for c in inspect(engine).get_columns("sessions")}
    with engine.connect() as conn:
        row = conn.exec_driver_sql("SELECT updated_at FROM sessions").fetchone()
    assert str(row[0]).startswith("2026-10-01 10:05")  # newest turn, not creation time


def test_is_idempotent(tmp_path):
    engine = make_old_db(tmp_path)
    upgrade_schema(engine)
    assert upgrade_schema(engine) == []


def test_titles_are_backfilled_from_the_first_message(tmp_path):
    engine = make_old_db(tmp_path)
    upgrade_schema(engine)

    with sessionmaker(bind=engine)() as db:
        assert SessionService(db).backfill_titles() == 1
        assert SessionService(db).get("old-1").title == "What is the vadi of Yaman?"


def test_does_nothing_on_a_fresh_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'empty.db'}")
    assert upgrade_schema(engine) == []


def test_existing_conversations_start_unpinned(tmp_path):
    engine = make_old_db(tmp_path)
    upgrade_schema(engine)
    with engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT pinned FROM sessions").fetchone()[0] in (0, False)

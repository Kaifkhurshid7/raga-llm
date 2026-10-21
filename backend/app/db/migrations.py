"""Idempotent schema upgrades for databases created by earlier versions.

`Base.metadata.create_all` creates missing tables but never alters existing ones, so a
database from before `sessions.title`, `sessions.updated_at` or `sessions.pinned` existed would fail every
session query with a server error. This adds the missing columns on startup. A migration
tool such as Alembic is the long-term answer; this keeps existing databases working until then.
"""
import logging
from typing import List

from sqlalchemy import DateTime, inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


# Columns added after the first release: (table, column, DDL type; `{dt}` is the datetime type).
_LATER_COLUMNS = [
    ("sessions", "archived_at", "{dt}"),
    ("sessions", "share_token", "VARCHAR"),
    ("sessions", "shared_at", "{dt}"),
    ("turns", "feedback", "VARCHAR"),
    ("turns", "feedback_at", "{dt}"),
]


def upgrade_schema(engine: Engine) -> List[str]:
    """Add columns the models expect but the database lacks. Returns what was changed."""
    inspector = inspect(engine)
    if not inspector.has_table("sessions"):
        return []

    existing = {c["name"] for c in inspector.get_columns("sessions")}
    datetime_type = DateTime().compile(dialect=engine.dialect)
    applied: List[str] = []

    with engine.begin() as conn:
        if "title" not in existing:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN title VARCHAR"))
            applied.append("sessions.title")
        if "updated_at" not in existing:
            conn.execute(text(f"ALTER TABLE sessions ADD COLUMN updated_at {datetime_type}"))
            applied.append("sessions.updated_at")
        if "pinned" not in existing:
            default = "0" if engine.dialect.name == "sqlite" else "FALSE"
            conn.execute(text(f"ALTER TABLE sessions ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT {default}"))
            applied.append("sessions.pinned")

        for table, column, ddl in _LATER_COLUMNS:
            if not inspector.has_table(table):
                continue
            have = {c["name"] for c in inspector.get_columns(table)}
            if column not in have:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl.format(dt=datetime_type)}"))
                applied.append(f"{table}.{column}")
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_sessions_share_token ON sessions (share_token)")
        )

        # Old rows: last activity is the newest turn, or the creation time.
        conn.execute(
            text(
                "UPDATE sessions SET updated_at = COALESCE("
                "(SELECT MAX(turns.created_at) FROM turns WHERE turns.session_id = sessions.id), "
                "sessions.created_at) WHERE updated_at IS NULL"
            )
        )

    if applied:
        logger.warning("Upgraded database schema: added %s", ", ".join(applied))
    return applied

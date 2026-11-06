import os
import sqlite3
import json
from datetime import datetime, timezone
from contextlib import contextmanager
from backend.config import settings


def get_db_connection() -> sqlite3.Connection:
    """Create an SQLite database connection with row factory enabled."""
    db_path = settings.sqlite_db_path
    parent_dir = os.path.dirname(db_path)
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db():
    """Context manager for safe database transactions."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database tables for RecallOps."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Incidents table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                machine_id TEXT NOT NULL,
                equipment_type TEXT NOT NULL,
                symptoms TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL,
                reported_observations TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'REPORTED',
                is_demo INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

        # Investigations table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS investigations (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                diagnosis_hypothesis TEXT NOT NULL,
                confidence REAL NOT NULL,
                recommended_diagnostic_steps TEXT NOT NULL,
                relevant_historical_incidents TEXT NOT NULL,
                supporting_evidence TEXT NOT NULL,
                unsuccessful_previous_repairs TEXT NOT NULL,
                safety_warnings TEXT NOT NULL,
                raw_model_output TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            );
            """
        )

        # Repairs table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS repairs (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                technician_id TEXT NOT NULL,
                action_taken TEXT NOT NULL,
                parts_replaced TEXT,
                notes TEXT,
                performed_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            );
            """
        )

        # Outcome verifications table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS outcome_verifications (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                verified_by TEXT NOT NULL,
                outcome_status TEXT NOT NULL,
                inspection_notes TEXT NOT NULL,
                follow_up_metrics TEXT,
                hindsight_retained INTEGER NOT NULL DEFAULT 0,
                hindsight_document_id TEXT,
                verified_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            );
            """
        )

        conn.commit()


# Ensure tables are created upon initialization
init_db()

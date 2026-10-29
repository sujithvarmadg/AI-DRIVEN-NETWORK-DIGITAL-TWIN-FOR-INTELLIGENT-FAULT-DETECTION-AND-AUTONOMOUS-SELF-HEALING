"""
Database — SQLite-based event and fault history storage.

Stores fault events, recovery actions, and detection results
for the event history log and analytics.
"""

import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Optional


DB_PATH = os.path.join(os.path.dirname(__file__), "network_twin.db")


class Database:
    """SQLite database for persisting fault events and recovery history."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_tables()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tables(self):
        """Create tables if they don't exist."""
        conn = self._get_conn()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS fault_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    fault_type TEXT,
                    component TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    action TEXT NOT NULL,
                    result TEXT NOT NULL,
                    details TEXT DEFAULT '{}'
                );

                CREATE TABLE IF NOT EXISTS recovery_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_id TEXT UNIQUE,
                    timestamp TEXT NOT NULL,
                    fault_type TEXT NOT NULL,
                    affected_component TEXT NOT NULL,
                    recovery_strategy TEXT NOT NULL,
                    alternate_path TEXT,
                    previous_path TEXT,
                    recovery_time REAL,
                    status TEXT NOT NULL,
                    before_metrics TEXT DEFAULT '{}',
                    after_metrics TEXT DEFAULT '{}',
                    explanation TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS detection_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    anomaly_detected INTEGER NOT NULL,
                    anomaly_score REAL,
                    confidence REAL,
                    fault_type TEXT,
                    affected_component TEXT,
                    severity TEXT,
                    feature_contributions TEXT DEFAULT '{}',
                    explanation TEXT DEFAULT '[]'
                );

                CREATE TABLE IF NOT EXISTS device_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_id TEXT UNIQUE,
                    timestamp TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    device_name TEXT NOT NULL,
                    action TEXT NOT NULL,
                    target_component TEXT,
                    previous_state TEXT NOT NULL,
                    new_state TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    details TEXT DEFAULT '{}'
                );
            """)
            conn.commit()
        finally:
            conn.close()

    # ──────────────────────────────────────
    # Fault Events
    # ──────────────────────────────────────

    def add_fault_event(self, event: dict):
        """Insert a fault event record."""
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO fault_events
                   (event_id, timestamp, event_type, fault_type, component, severity, action, result, details)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    event.get("event_id", ""),
                    event.get("timestamp", datetime.now().isoformat()),
                    event.get("event_type", ""),
                    event.get("fault_type", ""),
                    event.get("component", ""),
                    event.get("severity", ""),
                    event.get("action", ""),
                    event.get("result", ""),
                    json.dumps(event.get("details", {}), default=str),
                )
            )
            conn.commit()
        finally:
            conn.close()

    def get_fault_events(self, limit: int = 100) -> List[dict]:
        """Retrieve recent fault events."""
        conn = self._get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM fault_events ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ──────────────────────────────────────
    # Recovery Actions
    # ──────────────────────────────────────

    def add_recovery_action(self, action: dict):
        """Insert a recovery action record."""
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO recovery_actions
                   (action_id, timestamp, fault_type, affected_component, recovery_strategy,
                    alternate_path, previous_path, recovery_time, status,
                    before_metrics, after_metrics, explanation)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    action.get("action_id", ""),
                    action.get("timestamp", datetime.now().isoformat()),
                    action.get("fault_type", ""),
                    action.get("affected_component", ""),
                    action.get("recovery_strategy", ""),
                    json.dumps(action.get("alternate_path", []), default=str),
                    json.dumps(action.get("previous_path", []), default=str),
                    action.get("recovery_time_seconds", 0),
                    action.get("status", ""),
                    json.dumps(action.get("before_metrics", {}), default=str),
                    json.dumps(action.get("after_metrics", {}), default=str),
                    action.get("explanation", ""),
                )
            )
            conn.commit()
        finally:
            conn.close()

    # ──────────────────────────────────────
    # Detection Results
    # ──────────────────────────────────────

    def add_detection_result(self, result: dict):
        """Insert an AI detection result record."""
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT INTO detection_results
                   (timestamp, anomaly_detected, anomaly_score, confidence,
                    fault_type, affected_component, severity,
                    feature_contributions, explanation)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result.get("timestamp", datetime.now().isoformat()),
                    1 if result.get("anomaly_detected") else 0,
                    result.get("anomaly_score", 0),
                    result.get("confidence", 0),
                    result.get("fault_type", ""),
                    result.get("affected_component", ""),
                    result.get("severity", ""),
                    json.dumps(result.get("feature_contributions", {}), default=str),
                    json.dumps(result.get("explanation", []), default=str),
                )
            )
            conn.commit()
        finally:
            conn.close()

    # ──────────────────────────────────────
    # Device Actions History
    # ──────────────────────────────────────

    def add_device_action(self, action: dict):
        """Insert a device control action record."""
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO device_actions
                   (action_id, timestamp, device_id, device_name, action,
                    target_component, previous_state, new_state, outcome, details)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    action.get("action_id", ""),
                    action.get("timestamp", datetime.now().isoformat()),
                    action.get("device_id", ""),
                    action.get("device_name", ""),
                    action.get("action", ""),
                    action.get("target_component", ""),
                    action.get("previous_state", ""),
                    action.get("new_state", ""),
                    action.get("outcome", "SUCCESS"),
                    json.dumps(action.get("details", {}), default=str),
                )
            )
            conn.commit()
        finally:
            conn.close()

    def get_device_actions(self, device_id: Optional[str] = None, limit: int = 100) -> List[dict]:
        """Retrieve recent device control actions, optionally filtered by device."""
        conn = self._get_conn()
        try:
            if device_id:
                rows = conn.execute(
                    "SELECT * FROM device_actions WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?",
                    (device_id, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM device_actions ORDER BY timestamp DESC LIMIT ?",
                    (limit,)
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ──────────────────────────────────────
    # Utilities
    # ──────────────────────────────────────

    def get_all_events(self, limit: int = 200) -> List[dict]:
        """Get combined event history (fault events + recoveries)."""
        events = self.get_fault_events(limit)
        return events

    def clear_all(self):
        """Clear all stored data."""
        conn = self._get_conn()
        try:
            conn.executescript("""
                DELETE FROM fault_events;
                DELETE FROM recovery_actions;
                DELETE FROM detection_results;
                DELETE FROM device_actions;
            """)
            conn.commit()
        finally:
            conn.close()

    def get_stats(self) -> dict:
        """Get summary statistics."""
        conn = self._get_conn()
        try:
            faults = conn.execute("SELECT COUNT(*) as cnt FROM fault_events").fetchone()
            recoveries = conn.execute(
                "SELECT COUNT(*) as cnt FROM recovery_actions WHERE status='success'"
            ).fetchone()
            return {
                "total_faults": faults["cnt"],
                "total_recoveries": recoveries["cnt"],
            }
        finally:
            conn.close()

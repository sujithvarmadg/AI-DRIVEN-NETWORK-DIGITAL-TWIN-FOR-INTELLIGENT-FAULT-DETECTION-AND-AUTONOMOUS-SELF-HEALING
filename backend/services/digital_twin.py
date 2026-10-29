"""
Digital Twin — the virtual mirror of the simulated physical network.

Maintains a synchronized copy of the network state, calculates health scores,
tracks metric history for time-series charts, and coordinates between the
simulator, AI detector, and self-healing engine.
"""

import time
from datetime import datetime
from typing import Dict, List, Optional
from collections import deque
from models.network import (
    NetworkDevice, NetworkLink, NetworkHealth, NetworkTopology,
    DeviceStatus, LinkStatus, DeviceMetrics,
)


class DigitalTwin:
    """
    Virtual representation of the network.
    Continuously synchronizes with the NetworkSimulator and provides
    health scoring, metric history, and topology snapshots.
    """

    # How many data points to keep in metric history (for charts)
    MAX_HISTORY = 120  # ~2 minutes at 1-second ticks

    def __init__(self):
        self.devices: Dict[str, NetworkDevice] = {}
        self.links: Dict[str, NetworkLink] = {}
        self.health: NetworkHealth = NetworkHealth()
        self.fault_count: int = 0
        self.recovery_count: int = 0

        # Time-series history for dashboard charts
        self.metric_history: deque = deque(maxlen=self.MAX_HISTORY)
        self.last_marker: Optional[str] = None
        self.last_marker_label: Optional[str] = None
        self.last_before_metrics: Optional[dict] = None
        self.last_after_metrics: Optional[dict] = None

    # ──────────────────────────────────────
    # Synchronization
    # ──────────────────────────────────────

    def sync(self, devices: List[NetworkDevice], links: List[NetworkLink]):
        """
        Synchronize the Digital Twin with the latest simulator state.
        Recalculate health and append to metric history.
        """
        self.devices = {d.id: d for d in devices}
        self.links = {l.id: l for l in links}
        self._calculate_health()
        self._record_history()

    def set_event_marker(self, marker: str, label: str):
        """Set a marker for the next history entry (e.g., 'fault_injected', 'ai_healed')."""
        self.last_marker = marker
        self.last_marker_label = label

    def record_incident_before(self, metrics: dict):
        self.last_before_metrics = {k: round(v, 2) for k, v in metrics.items()}

    def record_incident_after(self, metrics: dict):
        self.last_after_metrics = {k: round(v, 2) for k, v in metrics.items()}

    def get_before_after_comparison(self) -> dict:
        has_real = bool(self.last_before_metrics and self.last_after_metrics)
        before = self.last_before_metrics or {
            "latency": 184.2,
            "packet_loss": 26.8,
            "throughput": 21.5,
            "cpu_usage": 89.4,
            "health_score": 38.0,
        }
        after = self.last_after_metrics or {
            "latency": 21.2,
            "packet_loss": 0.35,
            "throughput": 95.2,
            "cpu_usage": 32.0,
            "health_score": 96.5,
        }

        b_lat = max(1.0, before.get("latency", 184.2))
        a_lat = max(1.0, after.get("latency", 21.2))
        b_loss = max(0.1, before.get("packet_loss", 26.8))
        a_loss = max(0.01, after.get("packet_loss", 0.35))
        b_tp = max(1.0, before.get("throughput", 21.5))
        a_tp = max(1.0, after.get("throughput", 95.2))
        b_cpu = max(1.0, before.get("cpu_usage", 89.4))
        a_cpu = max(1.0, after.get("cpu_usage", 32.0))

        return {
            "has_comparison": has_real,
            "before": before,
            "after": after,
            "improvement": {
                "latency_reduction_pct": round(max(0, (b_lat - a_lat) / b_lat * 100), 1),
                "loss_reduction_pct": round(max(0, (b_loss - a_loss) / b_loss * 100), 1),
                "throughput_boost_pct": round(max(0, (a_tp - b_tp) / b_tp * 100), 1),
                "cpu_reduction_pct": round(max(0, (b_cpu - a_cpu) / b_cpu * 100), 1),
                "health_boost": round(after.get("health_score", 96.5) - before.get("health_score", 38.0), 1),
            }
        }

    def _calculate_health(self):
        """Compute the overall network health score (0–100)."""
        active_devices = [d for d in self.devices.values() if d.status != DeviceStatus.FAILED]
        failed_devices = [d for d in self.devices.values() if d.status == DeviceStatus.FAILED]
        active_links = [l for l in self.links.values() if l.status != LinkStatus.FAILED]
        failed_links = [l for l in self.links.values() if l.status == LinkStatus.FAILED]

        total_devices = len(self.devices)
        total_links = len(self.links)

        # Availability component (40% weight)
        device_avail = len(active_devices) / max(1, total_devices)
        link_avail = len(active_links) / max(1, total_links)
        availability = (device_avail * 0.6 + link_avail * 0.4) * 100

        # Performance component (60% weight) — average of device metrics
        if active_devices:
            avg_pl = sum(d.metrics.packet_loss for d in active_devices) / len(active_devices)
            avg_lat = sum(d.metrics.latency for d in active_devices) / len(active_devices)
            avg_tp = sum(d.metrics.throughput for d in active_devices) / len(active_devices)
            avg_cpu = sum(d.metrics.cpu_usage for d in active_devices) / len(active_devices)

            pl_score = max(0, 100 - avg_pl * 8)
            lat_score = max(0, 100 - max(0, avg_lat - 30) * 1.5)
            tp_score = min(100, avg_tp * 1.1)
            cpu_score = max(0, 100 - max(0, avg_cpu - 60) * 2.5)
            performance = (pl_score + lat_score + tp_score + cpu_score) / 4
        else:
            performance = 0
            avg_pl = 100
            avg_lat = 9999
            avg_tp = 0

        health_score = availability * 0.4 + performance * 0.6
        health_score = max(0, min(100, health_score))

        # Label
        if health_score >= 90:
            label = "Excellent"
        elif health_score >= 75:
            label = "Good"
        elif health_score >= 50:
            label = "Warning"
        elif health_score >= 25:
            label = "Poor"
        else:
            label = "Critical"

        self.health = NetworkHealth(
            health_score=round(health_score, 1),
            health_label=label,
            active_devices=len(active_devices),
            failed_devices=len(failed_devices),
            active_links=len(active_links),
            failed_links=len(failed_links),
            avg_packet_loss=round(avg_pl, 2) if active_devices else 100,
            avg_latency=round(avg_lat, 2) if active_devices else 9999,
            avg_throughput=round(avg_tp, 2) if active_devices else 0,
            fault_count=self.fault_count,
            recovery_count=self.recovery_count,
        )

    def _record_history(self):
        """Append current aggregated metrics to the time-series history."""
        active = [d for d in self.devices.values() if d.status != DeviceStatus.FAILED]
        if not active:
            return
        n = len(active)
        
        has_fault = any(
            d.status in (DeviceStatus.FAILED, DeviceStatus.CRITICAL) for d in self.devices.values()
        ) or any(
            l.status in (LinkStatus.FAILED, LinkStatus.DEGRADED) for l in self.links.values()
        )
        phase = "degraded" if has_fault else "healthy"

        marker = self.last_marker
        marker_label = self.last_marker_label
        # Reset one-shot marker
        self.last_marker = None
        self.last_marker_label = None

        self.metric_history.append({
            "timestamp": datetime.now().isoformat(),
            "latency": round(sum(d.metrics.latency for d in active) / n, 2),
            "packet_loss": round(sum(d.metrics.packet_loss for d in active) / n, 2),
            "throughput": round(sum(d.metrics.throughput for d in active) / n, 2),
            "cpu_usage": round(sum(d.metrics.cpu_usage for d in active) / n, 2),
            "memory_usage": round(sum(d.metrics.memory_usage for d in active) / n, 2),
            "traffic_load": round(sum(d.metrics.traffic_load for d in active) / n, 2),
            "health_score": self.health.health_score,
            "phase": phase,
            "marker": marker,
            "marker_label": marker_label,
        })

    # ──────────────────────────────────────
    # Queries
    # ──────────────────────────────────────

    def get_topology(self) -> dict:
        """Return full topology snapshot for the frontend."""
        return {
            "devices": [d.model_dump() for d in self.devices.values()],
            "links": [l.model_dump() for l in self.links.values()],
            "health": self.health.model_dump(),
            "timestamp": datetime.now().isoformat(),
        }

    def get_health(self) -> dict:
        return self.health.model_dump()

    def get_metrics_history(self) -> List[dict]:
        return list(self.metric_history)

    def get_device_metrics(self, device_id: str) -> Optional[dict]:
        dev = self.devices.get(device_id)
        if dev:
            return dev.metrics.model_dump()
        return None

    def increment_fault_count(self):
        self.fault_count += 1
        self.health.fault_count = self.fault_count

    def increment_recovery_count(self):
        self.recovery_count += 1
        self.health.recovery_count = self.recovery_count

    def reset_counters(self):
        self.fault_count = 0
        self.recovery_count = 0
        self.metric_history.clear()
        self.last_before_metrics = None
        self.last_after_metrics = None
        self.last_marker = None
        self.last_marker_label = None


"""
Fault Detector Service — orchestrates AI-based anomaly detection.

Wraps the ML AnomalyDetector and provides network-level fault detection
by aggregating metrics across devices and links.
"""

from typing import Dict, List, Optional
from datetime import datetime
from models.network import (
    AIDetectionResult, FaultType, Severity, DeviceStatus, LinkStatus,
    NetworkDevice, NetworkLink
)
from ml.anomaly_detection import AnomalyDetector


class FaultDetector:
    """
    Coordinates fault detection across the entire network.
    Uses the trained ML models to analyze aggregated and per-device metrics.
    """

    def __init__(self):
        self.detector = AnomalyDetector()
        self.last_result: Optional[AIDetectionResult] = None
        self.detection_history: List[AIDetectionResult] = []

    def analyze_network(
        self,
        devices: Dict[str, NetworkDevice],
        links: Dict[str, NetworkLink]
    ) -> AIDetectionResult:
        """
        Analyze the full network for anomalies.
        
        Strategy:
        1. Check for hard failures (devices/links marked FAILED).
        2. Aggregate metrics from all active devices.
        3. Feed aggregated metrics to the ML models.
        4. Identify affected component based on which device/link is most degraded.
        """
        # ── Step 1: Detect hard failures ──
        failed_devices = [
            d for d in devices.values()
            if d.status == DeviceStatus.FAILED
            or getattr(d, 'is_powered_on', True) is False
            or getattr(d, 'operational_status', '') == "FAILED"
        ]
        failed_links = [
            l for l in links.values()
            if l.status == LinkStatus.FAILED
            or l.packet_loss >= 90.0
            or l.latency >= 9000.0
        ]

        if failed_devices:
            names = ", ".join(d.name for d in failed_devices)
            primary_dev = failed_devices[0]
            # Determine fault type from device type
            if primary_dev.device_type.value == "router":
                ft = FaultType.ROUTER_FAILURE
            elif primary_dev.device_type.value == "server":
                ft = FaultType.SERVER_FAILURE
            else:
                ft = FaultType.ROUTER_FAILURE

            result = AIDetectionResult(
                anomaly_detected=True,
                anomaly_score=0.98,
                confidence=0.988,
                fault_type=ft,
                affected_component=names,
                severity=Severity.CRITICAL,
                feature_contributions={
                    "latency": 9999, "packet_loss": 100, "throughput": 0,
                    "cpu_usage": 0, "memory_usage": 0, "jitter": 0,
                    "error_rate": 100, "traffic_load": 0,
                },
                explanation=[
                    f"{names} completely unresponsive in network digital twin.",
                    "All connected physical links have severed and dropped transit packets.",
                    "Autonomous rerouting required to bypass failed hardware.",
                ],
            )
            self.last_result = result
            self.detection_history.append(result)
            return result

        if failed_links and not failed_devices:
            link_names = ", ".join(f"{l.source} ➔ {l.target}" for l in failed_links)
            primary_link = failed_links[0]
            result = AIDetectionResult(
                anomaly_detected=True,
                anomaly_score=0.965,
                confidence=0.985,
                fault_type=FaultType.LINK_FAILURE,
                affected_component=link_names or primary_link.id,
                severity=Severity.CRITICAL,
                feature_contributions={
                    "latency": primary_link.latency, "packet_loss": primary_link.packet_loss,
                    "throughput": 0, "cpu_usage": 0, "memory_usage": 0,
                    "jitter": 0, "error_rate": 100, "traffic_load": 0,
                },
                explanation=[
                    f"Link severed: {link_names}.",
                    f"Packet loss on link: {primary_link.packet_loss}%. Transit path broken.",
                    "Autonomous rerouting required via dynamic composite Dijkstra.",
                ],
            )
            self.last_result = result
            self.detection_history.append(result)
            return result

        # ── Step 2: Check per-component metrics for localized anomalies ──
        active = [d for d in devices.values() if d.status != DeviceStatus.FAILED]
        if not active:
            return AIDetectionResult(anomaly_detected=False, anomaly_score=0)

        worst_result = None
        highest_score = 0.0

        for d in active:
            dev_metrics = {
                "latency": d.metrics.latency,
                "packet_loss": d.metrics.packet_loss,
                "throughput": d.metrics.throughput,
                "cpu_usage": d.metrics.cpu_usage,
                "memory_usage": d.metrics.memory_usage,
                "jitter": d.metrics.jitter,
                "error_rate": d.metrics.error_rate,
                "traffic_load": d.metrics.traffic_load,
            }
            res = self.detector.detect(dev_metrics)
            if res.anomaly_detected and (worst_result is None or res.anomaly_score > highest_score):
                highest_score = res.anomaly_score
                res.affected_component = d.name
                worst_result = res

        for l in links.values():
            if l.status == LinkStatus.DEGRADED or l.packet_loss > 10 or l.latency > 70:
                link_metrics = {
                    "latency": l.latency,
                    "packet_loss": l.packet_loss,
                    "throughput": 35.0,
                    "cpu_usage": 40.0,
                    "memory_usage": 40.0,
                    "jitter": 15.0,
                    "error_rate": l.packet_loss / 2.0,
                    "traffic_load": l.utilization,
                }
                res = self.detector.detect(link_metrics)
                if res.anomaly_detected and (worst_result is None or res.anomaly_score > highest_score):
                    highest_score = res.anomaly_score
                    res.affected_component = l.id
                    worst_result = res

        if worst_result:
            self.last_result = worst_result
            self.detection_history.append(worst_result)
            return worst_result

        # ── Step 3: Fallback to aggregate metrics ──
        n = len(active)
        aggregated = {
            "latency": sum(d.metrics.latency for d in active) / n,
            "packet_loss": sum(d.metrics.packet_loss for d in active) / n,
            "throughput": sum(d.metrics.throughput for d in active) / n,
            "cpu_usage": sum(d.metrics.cpu_usage for d in active) / n,
            "memory_usage": sum(d.metrics.memory_usage for d in active) / n,
            "jitter": sum(d.metrics.jitter for d in active) / n,
            "error_rate": sum(d.metrics.error_rate for d in active) / n,
            "traffic_load": sum(d.metrics.traffic_load for d in active) / n,
        }

        result = self.detector.detect(aggregated)
        if result.anomaly_detected and result.fault_type:
            worst = self._find_worst_component(devices, links, result.fault_type)
            result.affected_component = worst

        self.last_result = result
        if result.anomaly_detected:
            self.detection_history.append(result)

        return result

    def _find_worst_component(
        self,
        devices: Dict[str, NetworkDevice],
        links: Dict[str, NetworkLink],
        fault_type: FaultType
    ) -> str:
        """Identify which component is most affected based on fault type."""
        if fault_type in (FaultType.LINK_FAILURE, FaultType.PACKET_LOSS):
            # Find link with worst packet loss
            worst_link = max(
                links.values(),
                key=lambda l: l.packet_loss,
                default=None
            )
            return worst_link.id if worst_link else "unknown"

        elif fault_type == FaultType.HIGH_LATENCY:
            worst = max(
                devices.values(),
                key=lambda d: d.metrics.latency if d.status != DeviceStatus.FAILED else 0,
                default=None
            )
            return worst.name if worst else "unknown"

        elif fault_type == FaultType.CONGESTION:
            worst = max(
                devices.values(),
                key=lambda d: d.metrics.traffic_load if d.status != DeviceStatus.FAILED else 0,
                default=None
            )
            return worst.name if worst else "unknown"

        elif fault_type in (FaultType.ROUTER_FAILURE, FaultType.SERVER_FAILURE):
            failed = [d for d in devices.values() if d.status == DeviceStatus.FAILED]
            return failed[0].name if failed else "unknown"

        return "unknown"

    def get_last_result(self) -> Optional[AIDetectionResult]:
        return self.last_result

    def get_detection_history(self) -> List[dict]:
        return [r.model_dump() for r in self.detection_history[-50:]]

    def clear_history(self):
        self.detection_history.clear()
        self.last_result = None

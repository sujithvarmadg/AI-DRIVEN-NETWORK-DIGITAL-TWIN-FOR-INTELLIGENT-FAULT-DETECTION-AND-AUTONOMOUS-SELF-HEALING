"""
Network and Fault data models for the Digital Twin system.
Defines the structure of network devices, links, metrics, and fault events.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from enum import Enum
from datetime import datetime
import uuid


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class DeviceType(str, Enum):
    ROUTER = "router"
    SWITCH = "switch"
    SERVER = "server"
    CLIENT = "client"


class DeviceStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    FAILED = "failed"
    RECOVERING = "recovering"


class LinkStatus(str, Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"
    FAILED = "failed"
    RECOVERING = "recovering"


class FaultType(str, Enum):
    LINK_FAILURE = "link_failure"
    ROUTER_FAILURE = "router_failure"
    HIGH_LATENCY = "high_latency"
    PACKET_LOSS = "packet_loss"
    CONGESTION = "congestion"
    SERVER_FAILURE = "server_failure"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RecoveryStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"


# ──────────────────────────────────────────────
# Device & Link Models
# ──────────────────────────────────────────────

class DeviceMetrics(BaseModel):
    """Real-time metrics for a single network device."""
    cpu_usage: float = Field(default=30.0, ge=0, le=100, description="CPU utilization %")
    memory_usage: float = Field(default=40.0, ge=0, le=100, description="Memory utilization %")
    packet_loss: float = Field(default=0.5, ge=0, le=100, description="Packet loss %")
    latency: float = Field(default=20.0, ge=0, description="Latency in ms")
    throughput: float = Field(default=85.0, ge=0, description="Throughput in Mbps")
    jitter: float = Field(default=2.0, ge=0, description="Jitter in ms")
    error_rate: float = Field(default=0.1, ge=0, le=100, description="Error rate %")
    traffic_load: float = Field(default=40.0, ge=0, le=100, description="Traffic load %")


class PortStatus(str, Enum):
    UP = "up"
    DOWN = "down"


class DevicePort(BaseModel):
    """Represents a network port or interface on a device."""
    port_id: str
    name: str
    link_id: str
    connected_device_id: str
    connected_device_name: str
    status: PortStatus = PortStatus.UP
    speed_mbps: float = 1000.0
    mac_address: Optional[str] = None


class NetworkDevice(BaseModel):
    """Represents a network device in the Digital Twin."""
    id: str
    name: str
    device_type: DeviceType
    ip_address: str
    status: DeviceStatus = DeviceStatus.HEALTHY
    operational_status: str = "ACTIVE"  # ACTIVE, DEGRADED, FAILED
    is_powered_on: bool = True
    ports: List[DevicePort] = Field(default_factory=list)
    metrics: DeviceMetrics = Field(default_factory=DeviceMetrics)
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})
    last_updated: datetime = Field(default_factory=datetime.now)


class NetworkLink(BaseModel):
    """Represents a link between two network devices."""
    id: str
    source: str  # Device ID
    target: str  # Device ID
    status: LinkStatus = LinkStatus.ACTIVE
    bandwidth: float = 100.0  # Mbps
    latency: float = 5.0  # ms
    packet_loss: float = 0.1  # %
    utilization: float = 30.0  # %
    cost: float = 1.0  # Routing cost
    last_updated: datetime = Field(default_factory=datetime.now)


# ──────────────────────────────────────────────
# Network State & Health
# ──────────────────────────────────────────────

class NetworkHealth(BaseModel):
    """Overall network health summary."""
    health_score: float = 96.0
    health_label: str = "Excellent"
    active_devices: int = 0
    failed_devices: int = 0
    active_links: int = 0
    failed_links: int = 0
    avg_packet_loss: float = 0.0
    avg_latency: float = 0.0
    avg_throughput: float = 0.0
    fault_count: int = 0
    recovery_count: int = 0


class NetworkTopology(BaseModel):
    """Complete network topology snapshot."""
    devices: List[NetworkDevice]
    links: List[NetworkLink]
    health: NetworkHealth
    timestamp: datetime = Field(default_factory=datetime.now)


# ──────────────────────────────────────────────
# Fault & Recovery Models
# ──────────────────────────────────────────────

class FaultInjectionRequest(BaseModel):
    """Request to inject a single fault into the simulation."""
    fault_type: FaultType
    target_id: Optional[str] = None  # Device or link ID
    auto_heal: bool = False  # If False, stays degraded until AI is triggered


class BatchFaultItem(BaseModel):
    """Single item in a multi-fault batch injection."""
    fault_type: FaultType
    target_id: Optional[str] = None


class BatchFaultInjectionRequest(BaseModel):
    """Request to inject multiple faults simultaneously."""
    faults: List[BatchFaultItem]
    auto_heal: bool = False


class HealingTriggerRequest(BaseModel):
    """Request to trigger self-healing with a chosen algorithm/strategy."""
    strategy: Optional[str] = "auto"  # auto, dijkstra_weighted, bfs_hop_count, traffic_shaping, server_failover


class AIDetectionResult(BaseModel):
    """Result from AI anomaly detection and fault classification."""
    anomaly_detected: bool = False
    anomaly_score: float = 0.0
    confidence: float = 0.0
    fault_type: Optional[FaultType] = None
    affected_component: Optional[str] = None
    severity: Optional[Severity] = None
    feature_contributions: Dict[str, float] = Field(default_factory=dict)
    explanation: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.now)


class RecoveryAction(BaseModel):
    """Describes a recovery action taken by the self-healing engine."""
    action_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    fault_type: FaultType
    affected_component: str
    recovery_strategy: str
    alternate_path: Optional[List[str]] = None
    previous_path: Optional[List[str]] = None
    recovery_time_seconds: float = 0.0
    status: RecoveryStatus = RecoveryStatus.IN_PROGRESS
    before_metrics: Dict[str, float] = Field(default_factory=dict)
    after_metrics: Dict[str, float] = Field(default_factory=dict)
    explanation: str = ""
    algorithm_summary: Optional[Dict] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class FaultEvent(BaseModel):
    """A recorded fault event for history/logging."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: datetime = Field(default_factory=datetime.now)
    event_type: str
    fault_type: Optional[FaultType] = None
    component: str
    severity: Severity
    action: str
    result: str
    details: Dict = Field(default_factory=dict)


class SelfHealingStatus(BaseModel):
    """Current status of the self-healing engine pipeline."""
    stage: str = "idle"  # idle, fault_detected, detecting, analyzing, finding_path, applying, testing, completed, failed
    fault_detected: bool = False
    fault_type: Optional[FaultType] = None
    affected_component: Optional[str] = None
    recovery_action: Optional[RecoveryAction] = None
    steps_completed: List[str] = Field(default_factory=list)
    steps_remaining: List[str] = Field(default_factory=list)
    available_strategies: Optional[List[Dict]] = None
    algorithm_summary: Optional[Dict] = None


# ──────────────────────────────────────────────
# Interactive Device Control & Routing Models
# ──────────────────────────────────────────────

class RoutingTableEntry(BaseModel):
    """Entry in a router's dynamic routing table."""
    destination_id: str
    destination_name: str
    destination_ip: str
    next_hop_id: Optional[str] = None
    next_hop_name: Optional[str] = None
    next_hop_ip: Optional[str] = None
    interface: Optional[str] = None
    path_cost: Optional[float] = None
    hops: int = 0
    status: str = "ACTIVE"  # "ACTIVE", "DIRECT", "UNREACHABLE"
    path: List[str] = Field(default_factory=list)


class DeviceActionLog(BaseModel):
    """Log record of manual/interactive device operations."""
    id: Optional[int] = None
    action_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: datetime = Field(default_factory=datetime.now)
    device_id: str
    device_name: str
    action: str  # "enable_port", "disable_port", "shutdown_router", "restart_router", "stop_server", "restart_server"
    target_component: Optional[str] = None
    previous_state: str
    new_state: str
    outcome: str = "SUCCESS"  # "SUCCESS", "FAILED", "REJECTED"
    details: Dict = Field(default_factory=dict)


class SwitchPortControlRequest(BaseModel):
    """Request to enable or disable an individual switch port."""
    port_id: str
    action: str  # "enable" or "disable"


class DevicePowerRequest(BaseModel):
    """Request to shut down, restart, stop, or start a device."""
    action: str  # "shutdown", "restart", "stop", "start"


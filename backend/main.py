"""
Main FastAPI Application — AI-Driven Network Digital Twin

Provides REST APIs and WebSocket for real-time network monitoring,
fault injection, AI detection, and autonomous self-healing.
"""

import asyncio
import json
import uuid
import sys
from datetime import datetime
from typing import List, Optional
from contextlib import asynccontextmanager

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models.network import (
    FaultType, FaultInjectionRequest, BatchFaultInjectionRequest, HealingTriggerRequest, AIDetectionResult,
    RecoveryAction, FaultEvent, Severity, SelfHealingStatus, DevicePort, PortStatus,
    DeviceActionLog, SwitchPortControlRequest, DevicePowerRequest, DeviceType, DeviceStatus, LinkStatus,
)
from services.network_simulator import NetworkSimulator
from services.digital_twin import DigitalTwin
from services.fault_detector import FaultDetector
from services.self_healing import SelfHealingEngine
from services.routing import RoutingEngine
from database.database import Database


# ──────────────────────────────────────────────
# Application State (initialized on startup)
# ──────────────────────────────────────────────

simulator: NetworkSimulator = None
digital_twin: DigitalTwin = None
fault_detector: FaultDetector = None
routing_engine: RoutingEngine = None
healing_engine: SelfHealingEngine = None
database: Database = None

# WebSocket clients for real-time updates
ws_clients: List[WebSocket] = []

# Background simulation task
simulation_task: Optional[asyncio.Task] = None


# ──────────────────────────────────────────────
# Lifespan — startup & shutdown
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all services on startup, clean up on shutdown."""
    global simulator, digital_twin, fault_detector, routing_engine, healing_engine, database, simulation_task

    print("[START] Starting AI Network Digital Twin...")

    # Initialize services
    database = Database()
    simulator = NetworkSimulator()
    digital_twin = DigitalTwin()
    routing_engine = RoutingEngine()
    fault_detector = FaultDetector()
    healing_engine = SelfHealingEngine(simulator, routing_engine)

    # Initial sync
    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())

    print("[OK] All services initialized")
    print("[OK] ML models loaded")
    print("[OK] Network simulation ready")

    # Start background simulation loop
    simulation_task = asyncio.create_task(simulation_loop())

    yield

    # Shutdown
    if simulation_task:
        simulation_task.cancel()
    print("[STOP] Shutting down...")


app = FastAPI(
    title="AI Network Digital Twin",
    description="AI-Driven Network Digital Twin for Intelligent Fault Detection and Autonomous Self-Healing",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Background Simulation Loop
# ──────────────────────────────────────────────

async def simulation_loop():
    """
    Runs every 1.5 seconds:
    1. Update simulated metrics (natural fluctuation + active faults).
    2. Sync Digital Twin.
    3. Broadcast state to all WebSocket clients.
    """
    while True:
        try:
            simulator.update_metrics()
            digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())

            # Continuously analyze network for anomalies
            fault_detector.analyze_network(simulator.devices, simulator.links)

            # Broadcast to WebSocket clients
            state = build_full_state()
            await broadcast_state(state)

            await asyncio.sleep(1.5)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Simulation error: {e}")
            await asyncio.sleep(2)


def build_full_state() -> dict:
    """Build the complete state payload for WebSocket broadcast."""
    return {
        "topology": digital_twin.get_topology(),
        "health": digital_twin.get_health(),
        "metrics_history": digital_twin.get_metrics_history()[-60:],
        "ai_status": fault_detector.get_last_result().model_dump() if fault_detector.get_last_result() else None,
        "healing_status": healing_engine.get_status(),
        "comparison": digital_twin.get_before_after_comparison(),
        "timestamp": datetime.now().isoformat(),
    }



async def broadcast_state(state: dict):
    """Send state to all connected WebSocket clients."""
    if not ws_clients:
        return
    message = json.dumps(state, default=str)
    disconnected = []
    for ws in ws_clients:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        ws_clients.remove(ws)


# ──────────────────────────────────────────────
# WebSocket Endpoint
# ──────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """Real-time WebSocket connection for live dashboard updates."""
    if len(ws_clients) >= 20:
        await ws.close(code=1008, reason="Connection limit reached")
        return

    await ws.accept()
    ws_clients.append(ws)
    print(f"[WS] WebSocket client connected ({len(ws_clients)} total)")

    try:
        # Send initial state immediately
        state = build_full_state()
        await ws.send_text(json.dumps(state, default=str))

        # Keep connection alive — listen for any incoming messages
        while True:
            data = await ws.receive_text()
            # Client can send ping/pong or commands
            if data == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if ws in ws_clients:
            ws_clients.remove(ws)
        print(f"[WS] WebSocket client disconnected ({len(ws_clients)} remaining)")


# ──────────────────────────────────────────────
# REST API — Network
# ──────────────────────────────────────────────

@app.get("/api/network/topology")
async def get_topology():
    """Get the current network topology (devices, links, health)."""
    return digital_twin.get_topology()


@app.get("/api/network/metrics")
async def get_metrics():
    """Get aggregated network metrics."""
    return simulator.get_aggregated_metrics()


@app.get("/api/network/health")
async def get_health():
    """Get the overall network health score and summary."""
    return digital_twin.get_health()


@app.get("/api/network/metrics/history")
async def get_metrics_history():
    """Get time-series metric history for charts."""
    return digital_twin.get_metrics_history()


@app.get("/api/network/device/{device_id}")
async def get_device(device_id: str):
    """Get metrics for a specific device."""
    metrics = digital_twin.get_device_metrics(device_id)
    if metrics is None:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")
    return metrics


@app.get("/api/network/device/{device_id}/details")
async def get_device_details(device_id: str):
    """
    Get comprehensive device details:
    Metadata, operational status, metrics, interfaces/ports, connected links,
    and routing table (if router).
    """
    dev = simulator.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    connected_links = [
        l.model_dump() for l in simulator.links.values()
        if l.source == device_id or l.target == device_id
    ]

    routing_table = []
    if dev.device_type == DeviceType.ROUTER:
        routing_table = routing_engine.compute_routing_table(
            device_id, simulator.devices, list(simulator.links.values())
        )

    recent_actions = database.get_device_actions(device_id=device_id, limit=20)

    return {
        "device": dev.model_dump(),
        "ports": [p.model_dump() for p in dev.ports],
        "connected_links": connected_links,
        "routing_table": routing_table,
        "recent_actions": recent_actions,
    }


@app.get("/api/network/device/{device_id}/ports")
async def get_device_ports(device_id: str):
    """Retrieve connected ports and interfaces for a device."""
    dev = simulator.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")
    return [p.model_dump() for p in dev.ports]


@app.get("/api/network/device/{device_id}/routing-table")
async def get_device_routing_table(device_id: str):
    """Retrieve dynamic Dijkstra-computed routing table for a router."""
    dev = simulator.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")
    if dev.device_type != DeviceType.ROUTER:
        raise HTTPException(status_code=400, detail=f"Device '{device_id}' is a {dev.device_type.value}, not a router.")

    return routing_engine.compute_routing_table(
        device_id, simulator.devices, list(simulator.links.values())
    )


@app.post("/api/network/device/{device_id}/port/control")
async def control_switch_port(device_id: str, request: SwitchPortControlRequest):
    """
    Enable or disable an individual switch port.
    Disabling a port sets the associated link to FAILED and drops traffic.
    """
    dev = simulator.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    action_norm = request.action.lower()
    if action_norm not in ("enable", "disable"):
        raise HTTPException(status_code=400, detail="Action must be 'enable' or 'disable'")

    # Validate port exists on device
    target_port = next((p for p in dev.ports if p.port_id == request.port_id), None)
    if not target_port:
        raise HTTPException(status_code=404, detail=f"Port '{request.port_id}' not found on device '{device_id}'")

    enable = (action_norm == "enable")
    prev_state = target_port.status.value

    try:
        result = simulator.set_port_status(device_id, request.port_id, enable=enable)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Sync digital twin to update health and metrics history
    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())

    # Log action in SQLite database
    action_log = {
        "action_id": str(uuid.uuid4())[:8],
        "timestamp": datetime.now().isoformat(),
        "device_id": device_id,
        "device_name": dev.name,
        "action": f"port_{action_norm}",
        "target_component": target_port.name,
        "previous_state": f"Port {prev_state.upper()}",
        "new_state": f"Port {result['new_status'].upper()}",
        "outcome": "SUCCESS",
        "details": result,
    }
    database.add_device_action(action_log)

    # Run AI detection on the updated network state
    fault_detector.analyze_network(simulator.devices, simulator.links)

    # Broadcast updated network topology and health
    state = build_full_state()
    await broadcast_state(state)

    return {
        "status": "success",
        "message": f"Port '{target_port.name}' {'enabled' if enable else 'disabled'} successfully",
        "result": result,
        "device": dev.model_dump(),
        "topology": digital_twin.get_topology(),
        "health": digital_twin.get_health(),
    }


@app.post("/api/network/device/{device_id}/power")
async def control_device_power(device_id: str, request: DevicePowerRequest):
    """
    Control power state of a network device:
    - Router: 'shutdown' or 'restart'
    - Server: 'stop' or 'restart' / 'start'
    - Switch: 'shutdown' or 'restart'
    
    A shut-down router or stopped server is excluded from Dijkstra routes.
    """
    dev = simulator.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    action_norm = request.action.lower()
    dtype = dev.device_type

    # Validate action against device type
    if dtype == DeviceType.ROUTER and action_norm not in ("shutdown", "restart"):
        raise HTTPException(status_code=400, detail=f"Invalid action '{action_norm}' for router. Allowed: shutdown, restart")
    elif dtype == DeviceType.SERVER and action_norm not in ("stop", "restart", "start"):
        raise HTTPException(status_code=400, detail=f"Invalid action '{action_norm}' for server. Allowed: stop, restart, start")
    elif dtype == DeviceType.SWITCH and action_norm not in ("shutdown", "restart"):
        raise HTTPException(status_code=400, detail=f"Invalid action '{action_norm}' for switch. Allowed: shutdown, restart")

    prev_state = dev.operational_status

    try:
        result = simulator.set_device_power(device_id, action_norm)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Sync digital twin
    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())

    # Log action to SQLite
    action_log = {
        "action_id": str(uuid.uuid4())[:8],
        "timestamp": datetime.now().isoformat(),
        "device_id": device_id,
        "device_name": dev.name,
        "action": f"device_{action_norm}",
        "target_component": dev.name,
        "previous_state": prev_state,
        "new_state": result["operational_status"],
        "outcome": "SUCCESS",
        "details": result,
    }
    database.add_device_action(action_log)

    # Run AI detection on the updated network state
    fault_detector.analyze_network(simulator.devices, simulator.links)

    # Broadcast updated network topology and health
    state = build_full_state()
    await broadcast_state(state)

    return {
        "status": "success",
        "message": f"Device '{dev.name}' {action_norm} executed successfully",
        "result": result,
        "device": dev.model_dump(),
        "topology": digital_twin.get_topology(),
        "health": digital_twin.get_health(),
    }


@app.get("/api/network/device-actions")
async def get_device_actions(device_id: Optional[str] = None, limit: int = 100):
    """Retrieve history of manual device actions (port toggles, power controls)."""
    return database.get_device_actions(device_id=device_id, limit=limit)


# ──────────────────────────────────────────────
# ──────────────────────────────────────────────
# REST API — Fault Injection
# ──────────────────────────────────────────────

@app.post("/api/fault/inject")
async def inject_fault(request: FaultInjectionRequest):
    """
    Inject a fault into the simulated network.
    
    This modifies the actual simulation state and triggers AI anomaly detection.
    If auto_heal is True, initiates immediate self-healing.
    If auto_heal is False, leaves network in degraded state until AI is triggered.
    """
    # 1. Inject fault into simulator
    fault_result = simulator.inject_fault(request.fault_type, request.target_id)

    # 2. Record event marker & sync digital twin to capture degraded state
    ft_title = request.fault_type.value.replace("_", " ").title()
    digital_twin.set_event_marker("fault_injected", f"Attack: {ft_title}")
    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())
    digital_twin.increment_fault_count()

    # 3. Run AI detection
    detection = fault_detector.analyze_network(
        simulator.devices, simulator.links
    )

    # Record current metrics as before-intervention baseline
    deg_metrics = simulator.get_aggregated_metrics()
    deg_metrics["health_score"] = digital_twin.get_health().get("health_score", 45)
    digital_twin.record_incident_before(deg_metrics)

    recovery = None
    if request.auto_heal:
        # 4. Immediate self-healing if auto-heal enabled
        recovery = healing_engine.heal(detection)
        digital_twin.set_event_marker("ai_healed", "AI Autonomous Optimization")
        digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())
        if recovery and recovery.status.value == "success":
            digital_twin.increment_recovery_count()
            after_m = simulator.get_aggregated_metrics()
            after_m["health_score"] = digital_twin.get_health().get("health_score", 95)
            digital_twin.record_incident_after(after_m)
    else:
        # Network stays degraded! Set status to fault_detected with pipeline steps
        healing_engine.status = SelfHealingStatus(
            stage="fault_detected",
            fault_detected=True,
            fault_type=detection.fault_type or request.fault_type,
            affected_component=detection.affected_component or fault_result.get("affected", ["unknown"])[0],
            steps_completed=["Fault Detected"],
            steps_remaining=[
                "Analyzing Network", "Finding Alternate Path",
                "Applying Recovery", "Testing Connectivity", "Recovery Complete"
            ],
            available_strategies=healing_engine.status.available_strategies,
            algorithm_summary=healing_engine.last_algorithm_summary,
        )

    # 5. Record to database
    event = FaultEvent(
        event_id=str(uuid.uuid4())[:8],
        timestamp=datetime.now(),
        event_type=request.fault_type.value.replace("_", " ").title(),
        fault_type=request.fault_type,
        component=detection.affected_component or fault_result.get("affected", ["unknown"])[0],
        severity=detection.severity or Severity.HIGH,
        action=recovery.recovery_strategy if recovery else "Awaiting AI Healing Execution",
        result=recovery.status.value if recovery else "attack_active",
        details={
            "detection": detection.model_dump(),
            "recovery": recovery.model_dump() if recovery else None,
            "fault_info": {k: str(v) for k, v in fault_result.items()},
        }
    )
    database.add_fault_event(event.model_dump())

    if recovery:
        database.add_recovery_action(recovery.model_dump())
    database.add_detection_result(detection.model_dump())

    # 6. Broadcast updated state
    state = build_full_state()
    await broadcast_state(state)

    return {
        "fault": {k: str(v) for k, v in fault_result.items()},
        "detection": detection.model_dump(),
        "recovery": recovery.model_dump() if recovery else None,
        "health": digital_twin.get_health(),
        "topology": digital_twin.get_topology(),
        "comparison": digital_twin.get_before_after_comparison(),
    }


@app.post("/api/fault/inject-batch")
async def inject_batch_faults(request: BatchFaultInjectionRequest):
    """
    Inject multiple faults into the simulated network simultaneously.
    """
    results = []
    affected_components = []
    fault_names = []

    for f in request.faults:
        fault_result = simulator.inject_fault(f.fault_type, f.target_id)
        results.append(fault_result)
        ft_title = f.fault_type.value.replace("_", " ").title()
        fault_names.append(ft_title)
        if fault_result.get("affected"):
            affected_components.extend(fault_result["affected"])
        digital_twin.increment_fault_count()
        digital_twin.set_event_marker("fault_injected", f"Fault: {ft_title}")

    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())

    detection = fault_detector.analyze_network(
        simulator.devices, simulator.links
    )

    if not detection.anomaly_detected and request.faults:
        detection.anomaly_detected = True
        detection.fault_type = request.faults[0].fault_type
        unique_aff = list(dict.fromkeys(affected_components))
        detection.affected_component = ", ".join(unique_aff[:3]) or "Multi-Target"

    deg_metrics = simulator.get_aggregated_metrics()
    deg_metrics["health_score"] = digital_twin.get_health().get("health_score", 45)
    digital_twin.record_incident_before(deg_metrics)

    unique_aff = list(dict.fromkeys(affected_components))
    healing_engine.status = SelfHealingStatus(
        stage="fault_detected",
        fault_detected=True,
        fault_type=detection.fault_type or request.faults[0].fault_type,
        affected_component=", ".join(unique_aff[:3]) or "Multi-Target",
        steps_completed=["Multiple Faults Injected", "Faults Detected"],
        steps_remaining=[
            "Analyzing Network", "Finding Alternate Path",
            "Applying Recovery", "Testing Connectivity", "Recovery Complete"
        ],
        available_strategies=healing_engine.status.available_strategies,
        algorithm_summary=healing_engine.last_algorithm_summary,
    )

    event = FaultEvent(
        event_id=str(uuid.uuid4())[:8],
        timestamp=datetime.now(),
        event_type=f"Multi-Fault ({len(request.faults)} faults)",
        fault_type=request.faults[0].fault_type if request.faults else FaultType.LINK_FAILURE,
        component=", ".join(unique_aff[:3]) or "Multi-Target",
        severity=detection.severity or Severity.HIGH,
        action="Awaiting AI Healing Execution",
        result="faults_active",
        details={
            "detection": detection.model_dump(),
            "fault_count": len(request.faults),
            "fault_names": fault_names,
        }
    )
    database.add_fault_event(event.model_dump())
    database.add_detection_result(detection.model_dump())

    state = build_full_state()
    await broadcast_state(state)

    return {
        "status": "success",
        "fault_count": len(request.faults),
        "fault_results": results,
        "detection": detection.model_dump(),
        "topology": digital_twin.get_topology(),
        "health": digital_twin.get_health(),
        "comparison": digital_twin.get_before_after_comparison(),
    }


# ──────────────────────────────────────────────
# REST API — AI Detection
# ──────────────────────────────────────────────

@app.post("/api/ai/detect")
async def run_detection():
    """Run AI anomaly detection on the current network state."""
    detection = fault_detector.analyze_network(
        simulator.devices, simulator.links
    )
    if detection.anomaly_detected:
        database.add_detection_result(detection.model_dump())
    return detection.model_dump()


@app.get("/api/ai/status")
async def get_ai_status():
    """Get the latest AI detection result."""
    result = fault_detector.get_last_result()
    return result.model_dump() if result else {"anomaly_detected": False, "anomaly_score": 0}


@app.get("/api/ai/history")
async def get_detection_history():
    """Get history of AI detection results."""
    return fault_detector.get_detection_history()


# ──────────────────────────────────────────────
# REST API — Self-Healing
# ──────────────────────────────────────────────

@app.post("/api/self-heal")
async def trigger_healing(request: Optional[HealingTriggerRequest] = None):
    """Trigger the AI self-healing optimization process with optional chosen strategy."""
    strategy = request.strategy if request and request.strategy else "auto"

    detection = fault_detector.analyze_network(
        simulator.devices, simulator.links
    )

    # If active fault exists in simulator, ensure detection reflects it
    if simulator.active_faults and not detection.anomaly_detected:
        detection.anomaly_detected = True
        first_fault = list(simulator.active_faults.values())[0]
        detection.fault_type = first_fault.get("fault_type")
        detection.affected_component = first_fault.get("target")

    if not detection.anomaly_detected and not simulator.active_faults:
        return {"message": "No anomaly detected — network is healthy", "status": "idle"}

    # Run healing engine with strategy
    recovery = healing_engine.heal(detection, strategy=strategy)
    
    # Sync digital twin after recovery
    strat_label = recovery.recovery_strategy if recovery else "AI Dynamic Optimization"
    digital_twin.set_event_marker("ai_healed", f"AI Optimized: {strat_label}")
    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())

    if recovery and recovery.status.value == "success":
        digital_twin.increment_recovery_count()
        after_m = simulator.get_aggregated_metrics()
        after_m["health_score"] = digital_twin.get_health().get("health_score", 95)
        digital_twin.record_incident_after(after_m)
        database.add_recovery_action(recovery.model_dump())

    state = build_full_state()
    await broadcast_state(state)

    return {
        "status": "success" if recovery else "idle",
        "recovery": recovery.model_dump() if recovery else None,
        "healing_status": healing_engine.get_status().model_dump() if healing_engine else None,
        "health": digital_twin.get_health(),
        "topology": digital_twin.get_topology(),
        "comparison": digital_twin.get_before_after_comparison(),
    }


@app.get("/api/network/comparison")
async def get_comparison():
    """Get before/after telemetry and performance improvement."""
    return digital_twin.get_before_after_comparison()


@app.get("/api/self-heal/strategies")
async def get_strategies():
    """Get list of available healing algorithms and mathematical specifications."""
    from services.self_healing import AVAILABLE_STRATEGIES
    return AVAILABLE_STRATEGIES


@app.get("/api/self-heal/status")
async def get_healing_status():
    """Get the current self-healing engine status."""
    return healing_engine.get_status()


@app.get("/api/self-heal/history")
async def get_healing_history():
    """Get history of recovery actions."""
    return healing_engine.get_recovery_history()



# ──────────────────────────────────────────────
# REST API — Event History
# ──────────────────────────────────────────────

@app.get("/api/events")
async def get_events():
    """Get the full event history log."""
    return database.get_all_events()


@app.get("/api/fault/history")
async def get_fault_history():
    """Get fault event history."""
    return database.get_fault_events()


# ──────────────────────────────────────────────
# REST API — Routing
# ──────────────────────────────────────────────

@app.get("/api/routing/path")
async def get_route(source: str = "client1", target: str = "server1"):
    """Calculate the shortest path between two devices, excluding failed devices."""
    links = list(simulator.links.values())
    failed_devs = {
        did for did, d in simulator.devices.items()
        if d.status == DeviceStatus.FAILED or not getattr(d, 'is_powered_on', True)
    }
    result = routing_engine.find_path(links, source, target, failed_devices=failed_devs)
    if result is None:
        return {"path": None, "cost": None, "message": "No path found"}
    path, cost = result
    details = routing_engine.get_path_details(links, path)
    return details


@app.get("/api/routing/alternate")
async def get_alternate_routes(source: str = "client1", target: str = "server1"):
    """Find alternate routes between two devices, excluding failed devices."""
    links = list(simulator.links.values())
    failed_devs = {
        did for did, d in simulator.devices.items()
        if d.status == DeviceStatus.FAILED or not getattr(d, 'is_powered_on', True)
    }
    paths = routing_engine.find_alternate_paths(links, source, target, failed_devices=failed_devs)
    return [
        routing_engine.get_path_details(links, p[0])
        for p in paths
    ]


# ──────────────────────────────────────────────
# REST API — Reset
# ──────────────────────────────────────────────

@app.post("/api/network/reset")
async def reset_network():
    """Reset the entire network to initial healthy state."""
    simulator.reset_network()
    digital_twin.reset_counters()
    digital_twin.sync(simulator.get_all_devices(), simulator.get_all_links())
    fault_detector.clear_history()
    healing_engine.clear_history()
    database.clear_all()

    state = build_full_state()
    await broadcast_state(state)

    return {"message": "Network reset to healthy state", "health": digital_twin.get_health()}


# ──────────────────────────────────────────────
# Health Check
# ──────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "AI Network Digital Twin",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "topology": "/api/network/topology",
            "metrics": "/api/network/metrics",
            "health": "/api/network/health",
            "inject_fault": "/api/fault/inject",
            "ai_detect": "/api/ai/detect",
            "self_heal": "/api/self-heal",
            "events": "/api/events",
            "reset": "/api/network/reset",
            "device_details": "/api/network/device/{device_id}/details",
            "device_ports": "/api/network/device/{device_id}/ports",
            "device_routing_table": "/api/network/device/{device_id}/routing-table",
            "port_control": "/api/network/device/{device_id}/port/control",
            "device_power": "/api/network/device/{device_id}/power",
            "device_actions": "/api/network/device-actions",
            "websocket": "/ws",
            "live_interfaces": "/api/live/interfaces",
            "live_stats": "/api/live/stats/{interface_name}",
        }
    }


# ──────────────────────────────────────────────
# LIVE NETWORK MONITORING ENDPOINTS
# Uses psutil for real network interface stats
# ──────────────────────────────────────────────

try:
    import psutil as _psutil
    _PSUTIL_AVAILABLE = True
except ImportError:
    _PSUTIL_AVAILABLE = False

import time as _time
# Store previous counters for delta calculations
_prev_counters: dict = {}
_prev_time: dict = {}


@app.get("/api/live/interfaces")
async def get_live_interfaces():
    """Return all available network interfaces with their addresses and status."""
    if not _PSUTIL_AVAILABLE:
        return {"interfaces": [], "error": "psutil not available"}

    try:
        addrs = _psutil.net_if_addrs()
        stats = _psutil.net_if_stats()
        counters = _psutil.net_io_counters(pernic=True)

        result = []
        for name, addr_list in addrs.items():
            iface_stat = stats.get(name)
            iface_counters = counters.get(name)

            # Collect IP addresses
            ipv4 = None
            ipv6 = None
            mac = None
            for addr in addr_list:
                import socket
                if addr.family == socket.AF_INET:
                    ipv4 = addr.address
                elif addr.family == socket.AF_INET6:
                    ipv6 = addr.address
                elif addr.family == _psutil.AF_LINK if hasattr(_psutil, 'AF_LINK') else -1:
                    mac = addr.address

            is_up = iface_stat.isup if iface_stat else False
            speed = iface_stat.speed if iface_stat else 0
            mtu = iface_stat.mtu if iface_stat else 1500

            bytes_sent = iface_counters.bytes_sent if iface_counters else 0
            bytes_recv = iface_counters.bytes_recv if iface_counters else 0
            pkts_sent = iface_counters.packets_sent if iface_counters else 0
            pkts_recv = iface_counters.packets_recv if iface_counters else 0
            errin = iface_counters.errin if iface_counters else 0
            errout = iface_counters.errout if iface_counters else 0
            dropin = iface_counters.dropin if iface_counters else 0
            dropout = iface_counters.dropout if iface_counters else 0

            result.append({
                "name": name,
                "is_up": is_up,
                "speed_mbps": speed,
                "mtu": mtu,
                "ipv4": ipv4,
                "ipv6": ipv6,
                "mac": mac,
                "bytes_sent": bytes_sent,
                "bytes_recv": bytes_recv,
                "packets_sent": pkts_sent,
                "packets_recv": pkts_recv,
                "errors_in": errin,
                "errors_out": errout,
                "drop_in": dropin,
                "drop_out": dropout,
            })

        return {"interfaces": result, "timestamp": datetime.utcnow().isoformat() + "Z"}
    except Exception as e:
        return {"interfaces": [], "error": str(e)}


@app.get("/api/live/stats/{interface_name:path}")
async def get_live_interface_stats(interface_name: str):
    """
    Return real-time throughput (bytes/s, packets/s) for a specific interface.
    Calculates delta from the previous call to compute rate.
    """
    if not _PSUTIL_AVAILABLE:
        return {"error": "psutil not available"}

    try:
        counters = _psutil.net_io_counters(pernic=True)
        now = _time.time()

        if interface_name not in counters:
            available = list(counters.keys())
            raise HTTPException(status_code=404, detail=f"Interface '{interface_name}' not found. Available: {available}")

        c = counters[interface_name]

        # Calculate rates using deltas
        prev = _prev_counters.get(interface_name)
        prev_t = _prev_time.get(interface_name)

        bytes_recv_rate = 0.0
        bytes_sent_rate = 0.0
        pkts_recv_rate = 0.0
        pkts_sent_rate = 0.0

        if prev and prev_t:
            dt = now - prev_t
            if dt > 0:
                bytes_recv_rate = max(0.0, (c.bytes_recv - prev["bytes_recv"]) / dt)
                bytes_sent_rate = max(0.0, (c.bytes_sent - prev["bytes_sent"]) / dt)
                pkts_recv_rate = max(0.0, (c.packets_recv - prev["packets_recv"]) / dt)
                pkts_sent_rate = max(0.0, (c.packets_sent - prev["packets_sent"]) / dt)

        # Store current as previous
        _prev_counters[interface_name] = {
            "bytes_recv": c.bytes_recv,
            "bytes_sent": c.bytes_sent,
            "packets_recv": c.packets_recv,
            "packets_sent": c.packets_sent,
        }
        _prev_time[interface_name] = now

        # Interface stats for additional info
        iface_stats = _psutil.net_if_stats().get(interface_name)

        return {
            "interface": interface_name,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "is_up": iface_stats.isup if iface_stats else False,
            "speed_mbps": iface_stats.speed if iface_stats else 0,
            # Cumulative totals
            "bytes_sent_total": c.bytes_sent,
            "bytes_recv_total": c.bytes_recv,
            "packets_sent_total": c.packets_sent,
            "packets_recv_total": c.packets_recv,
            "errors_in": c.errin,
            "errors_out": c.errout,
            "drop_in": c.dropin,
            "drop_out": c.dropout,
            # Real-time rates (per second)
            "bytes_recv_rate": round(bytes_recv_rate, 2),
            "bytes_sent_rate": round(bytes_sent_rate, 2),
            "kbps_recv": round(bytes_recv_rate * 8 / 1000, 2),
            "kbps_sent": round(bytes_sent_rate * 8 / 1000, 2),
            "packets_recv_rate": round(pkts_recv_rate, 2),
            "packets_sent_rate": round(pkts_sent_rate, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

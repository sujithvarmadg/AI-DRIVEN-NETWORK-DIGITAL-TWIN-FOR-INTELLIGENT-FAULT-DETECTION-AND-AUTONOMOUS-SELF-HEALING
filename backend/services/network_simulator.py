"""
Network Simulator — generates realistic simulated telemetry for the Digital Twin.

Maintains the ground-truth state of the simulated network (devices, links, metrics).
Produces naturally-fluctuating metrics around configurable baselines.
Fault injection modifies the underlying state so that metrics genuinely degrade.
"""

import random
import math
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set
from models.network import (
    NetworkDevice, NetworkLink, DeviceMetrics, DevicePort, PortStatus,
    DeviceType, DeviceStatus, LinkStatus, FaultType
)


class NetworkSimulator:
    """
    Simulates a computer network with routers, switches, servers, and clients.
    Generates realistic telemetry that fluctuates around baselines.
    Supports interactive port toggling, power shutdown, and router restarts.
    """

    def __init__(self):
        self.devices: Dict[str, NetworkDevice] = {}
        self.links: Dict[str, NetworkLink] = {}
        self.active_faults: Dict[str, dict] = {}  # fault_id -> fault info
        self.disabled_ports: Dict[str, Set[str]] = {}  # dev_id -> set of port_ids
        self.manual_shutdowns: Set[str] = set()  # dev_ids manually powered off/shut down
        self.tick_count: int = 0
        self._initialize_network()

    # ──────────────────────────────────────
    # Network Initialization
    # ──────────────────────────────────────

    def _initialize_network(self):
        """Build the default network topology and configure physical device ports."""
        # Define devices with positions for topology layout
        device_defs = [
            ("client1", "Client PC-1", DeviceType.CLIENT, "192.168.1.10", {"x": 50, "y": 200}),
            ("client2", "Client PC-2", DeviceType.CLIENT, "192.168.1.11", {"x": 50, "y": 400}),
            ("switch1", "Switch S1", DeviceType.SWITCH, "192.168.1.1", {"x": 250, "y": 200}),
            ("switch2", "Switch S2", DeviceType.SWITCH, "192.168.2.1", {"x": 250, "y": 400}),
            ("router1", "Router R1", DeviceType.ROUTER, "10.0.0.1", {"x": 450, "y": 150}),
            ("router2", "Router R2", DeviceType.ROUTER, "10.0.0.2", {"x": 650, "y": 300}),
            ("router3", "Router R3", DeviceType.ROUTER, "10.0.0.3", {"x": 450, "y": 450}),
            ("server1", "Server S1", DeviceType.SERVER, "172.16.0.10", {"x": 850, "y": 200}),
            ("server2", "Server S2", DeviceType.SERVER, "172.16.0.11", {"x": 850, "y": 400}),
        ]

        for dev_id, name, dtype, ip, pos in device_defs:
            self.devices[dev_id] = NetworkDevice(
                id=dev_id, name=name, device_type=dtype,
                ip_address=ip, position=pos,
                status=DeviceStatus.HEALTHY,
                operational_status="ACTIVE",
                is_powered_on=True,
                metrics=self._baseline_metrics(dtype),
            )

        # Define links (edges) — each link connects two devices
        link_defs = [
            ("client1", "switch1", 100, 2, 0.1),
            ("client2", "switch2", 100, 2, 0.1),
            ("switch1", "router1", 1000, 3, 0.1),
            ("switch2", "router3", 1000, 3, 0.1),
            ("router1", "router2", 1000, 5, 0.2),
            ("router1", "router3", 1000, 7, 0.2),
            ("router2", "router3", 1000, 6, 0.2),
            ("router2", "server1", 1000, 3, 0.1),
            ("router2", "server2", 1000, 3, 0.1),
            ("router3", "server2", 1000, 4, 0.1),
        ]

        for src, tgt, bw, lat, pl in link_defs:
            link_id = f"{src}-{tgt}"
            self.links[link_id] = NetworkLink(
                id=link_id, source=src, target=tgt,
                bandwidth=bw, latency=lat, packet_loss=pl,
                utilization=random.uniform(20, 45),
                cost=1.0 + lat / 10.0,
            )

        # Initialize physical ports and interfaces on each device
        port_assignments = {
            "switch1": [
                DevicePort(port_id="port-1", name="Port 1 (Fa0/1)", link_id="client1-switch1",
                           connected_device_id="client1", connected_device_name="Client PC-1",
                           status=PortStatus.UP, speed_mbps=100.0, mac_address="00:1A:2B:3C:4D:01"),
                DevicePort(port_id="port-2", name="Port 2 (Gi0/1)", link_id="switch1-router1",
                           connected_device_id="router1", connected_device_name="Router R1",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:4D:02"),
            ],
            "switch2": [
                DevicePort(port_id="port-1", name="Port 1 (Fa0/1)", link_id="client2-switch2",
                           connected_device_id="client2", connected_device_name="Client PC-2",
                           status=PortStatus.UP, speed_mbps=100.0, mac_address="00:1A:2B:3C:4D:03"),
                DevicePort(port_id="port-2", name="Port 2 (Gi0/1)", link_id="switch2-router3",
                           connected_device_id="router3", connected_device_name="Router R3",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:4D:04"),
            ],
            "router1": [
                DevicePort(port_id="gi0-0", name="GigabitEthernet0/0 (LAN)", link_id="switch1-router1",
                           connected_device_id="switch1", connected_device_name="Switch S1",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:01"),
                DevicePort(port_id="gi0-1", name="GigabitEthernet0/1 (WAN)", link_id="router1-router2",
                           connected_device_id="router2", connected_device_name="Router R2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:02"),
                DevicePort(port_id="gi0-2", name="GigabitEthernet0/2 (WAN)", link_id="router1-router3",
                           connected_device_id="router3", connected_device_name="Router R3",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:03"),
            ],
            "router2": [
                DevicePort(port_id="gi0-0", name="GigabitEthernet0/0 (WAN)", link_id="router1-router2",
                           connected_device_id="router1", connected_device_name="Router R1",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:04"),
                DevicePort(port_id="gi0-1", name="GigabitEthernet0/1 (WAN)", link_id="router2-router3",
                           connected_device_id="router3", connected_device_name="Router R3",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:05"),
                DevicePort(port_id="gi0-2", name="GigabitEthernet0/2 (DC-LAN1)", link_id="router2-server1",
                           connected_device_id="server1", connected_device_name="Server S1",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:06"),
                DevicePort(port_id="gi0-3", name="GigabitEthernet0/3 (DC-LAN2)", link_id="router2-server2",
                           connected_device_id="server2", connected_device_name="Server S2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:07"),
            ],
            "router3": [
                DevicePort(port_id="gi0-0", name="GigabitEthernet0/0 (LAN)", link_id="switch2-router3",
                           connected_device_id="switch2", connected_device_name="Switch S2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:08"),
                DevicePort(port_id="gi0-1", name="GigabitEthernet0/1 (WAN)", link_id="router1-router3",
                           connected_device_id="router1", connected_device_name="Router R1",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:09"),
                DevicePort(port_id="gi0-2", name="GigabitEthernet0/2 (WAN)", link_id="router2-router3",
                           connected_device_id="router2", connected_device_name="Router R2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:0A"),
                DevicePort(port_id="gi0-3", name="GigabitEthernet0/3 (DC-LAN2)", link_id="router3-server2",
                           connected_device_id="server2", connected_device_name="Server S2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:5E:0B"),
            ],
            "server1": [
                DevicePort(port_id="eth0", name="eth0 (Uplink R2)", link_id="router2-server1",
                           connected_device_id="router2", connected_device_name="Router R2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:6F:01"),
            ],
            "server2": [
                DevicePort(port_id="eth0", name="eth0 (Uplink R2)", link_id="router2-server2",
                           connected_device_id="router2", connected_device_name="Router R2",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:6F:02"),
                DevicePort(port_id="eth1", name="eth1 (Uplink R3)", link_id="router3-server2",
                           connected_device_id="router3", connected_device_name="Router R3",
                           status=PortStatus.UP, speed_mbps=1000.0, mac_address="00:1A:2B:3C:6F:03"),
            ],
            "client1": [
                DevicePort(port_id="eth0", name="eth0 (FastEthernet)", link_id="client1-switch1",
                           connected_device_id="switch1", connected_device_name="Switch S1",
                           status=PortStatus.UP, speed_mbps=100.0, mac_address="00:1A:2B:3C:7A:01"),
            ],
            "client2": [
                DevicePort(port_id="eth0", name="eth0 (FastEthernet)", link_id="client2-switch2",
                           connected_device_id="switch2", connected_device_name="Switch S2",
                           status=PortStatus.UP, speed_mbps=100.0, mac_address="00:1A:2B:3C:7A:02"),
            ],
        }

        for did, ports in port_assignments.items():
            if did in self.devices:
                self.devices[did].ports = ports

    def _baseline_metrics(self, dtype: DeviceType) -> DeviceMetrics:
        """Return reasonable baseline metrics depending on device type."""
        if dtype == DeviceType.SERVER:
            return DeviceMetrics(
                cpu_usage=random.uniform(25, 50),
                memory_usage=random.uniform(35, 55),
                packet_loss=random.uniform(0, 0.5),
                latency=random.uniform(5, 15),
                throughput=random.uniform(80, 100),
                jitter=random.uniform(0.5, 3),
                error_rate=random.uniform(0, 0.2),
                traffic_load=random.uniform(30, 55),
            )
        elif dtype == DeviceType.ROUTER:
            return DeviceMetrics(
                cpu_usage=random.uniform(20, 45),
                memory_usage=random.uniform(25, 45),
                packet_loss=random.uniform(0, 1),
                latency=random.uniform(10, 25),
                throughput=random.uniform(75, 95),
                jitter=random.uniform(1, 4),
                error_rate=random.uniform(0, 0.3),
                traffic_load=random.uniform(25, 50),
            )
        elif dtype == DeviceType.SWITCH:
            return DeviceMetrics(
                cpu_usage=random.uniform(10, 30),
                memory_usage=random.uniform(15, 35),
                packet_loss=random.uniform(0, 0.3),
                latency=random.uniform(1, 5),
                throughput=random.uniform(85, 100),
                jitter=random.uniform(0.2, 1.5),
                error_rate=random.uniform(0, 0.1),
                traffic_load=random.uniform(20, 40),
            )
        else:  # CLIENT
            return DeviceMetrics(
                cpu_usage=random.uniform(15, 40),
                memory_usage=random.uniform(30, 50),
                packet_loss=random.uniform(0, 1),
                latency=random.uniform(15, 30),
                throughput=random.uniform(70, 95),
                jitter=random.uniform(1, 5),
                error_rate=random.uniform(0, 0.2),
                traffic_load=random.uniform(15, 35),
            )

    # ──────────────────────────────────────
    # Metric Update (Natural Fluctuation)
    # ──────────────────────────────────────

    def _jitter_value(self, current: float, low: float, high: float, volatility: float = 0.05) -> float:
        """Apply small random walk bounded within [low, high]."""
        delta = (high - low) * volatility * random.gauss(0, 1)
        new_val = current + delta
        return max(low, min(high, new_val))

    def update_metrics(self):
        """
        Advance one simulation tick — update every device and link metric
        with natural fluctuation. Active faults and manual overrides warp the metrics.
        """
        self.tick_count += 1
        now = datetime.now()

        for dev_id, dev in self.devices.items():
            if dev.status == DeviceStatus.FAILED or not getattr(dev, 'is_powered_on', True) or dev_id in self.manual_shutdowns:
                dev.status = DeviceStatus.FAILED
                dev.operational_status = "FAILED"
                dev.metrics.cpu_usage = 0.0
                dev.metrics.memory_usage = 0.0
                dev.metrics.throughput = 0.0
                dev.metrics.packet_loss = 100.0
                dev.metrics.latency = 9999.0
                dev.metrics.traffic_load = 0.0
                dev.last_updated = now
                continue

            m = dev.metrics
            # Natural fluctuation around baselines
            m.cpu_usage = self._jitter_value(m.cpu_usage, 10, 65)
            m.memory_usage = self._jitter_value(m.memory_usage, 15, 60)
            m.packet_loss = self._jitter_value(m.packet_loss, 0, 2, 0.03)
            m.latency = self._jitter_value(m.latency, 5, 35)
            m.throughput = self._jitter_value(m.throughput, 70, 100)
            m.jitter = self._jitter_value(m.jitter, 0.2, 5)
            m.error_rate = self._jitter_value(m.error_rate, 0, 0.5, 0.02)
            m.traffic_load = self._jitter_value(m.traffic_load, 15, 55)
            dev.last_updated = now

            # Update device status based on metrics
            self._update_device_status(dev)

        for link_id, link in self.links.items():
            if link.status == LinkStatus.FAILED:
                continue
            link.utilization = self._jitter_value(link.utilization, 15, 50)
            link.latency = self._jitter_value(link.latency, 1, 10)
            link.packet_loss = self._jitter_value(link.packet_loss, 0, 0.5, 0.02)
            link.cost = 1.0 + link.latency / 10.0 + link.packet_loss * 2 + link.utilization / 100.0
            link.last_updated = now

        # Apply active faults and manual control states
        self._apply_active_faults()

    def _update_device_status(self, dev: NetworkDevice):
        """Derive device status and operational status from its current metrics."""
        m = dev.metrics
        if dev.status == DeviceStatus.FAILED or not getattr(dev, 'is_powered_on', True) or dev.id in self.manual_shutdowns:
            dev.status = DeviceStatus.FAILED
            dev.operational_status = "FAILED"
            return
        score = self._device_health_score(m)
        if score >= 85:
            dev.status = DeviceStatus.HEALTHY
            dev.operational_status = "ACTIVE"
        elif score >= 60:
            dev.status = DeviceStatus.WARNING
            dev.operational_status = "DEGRADED"
        else:
            dev.status = DeviceStatus.CRITICAL
            dev.operational_status = "DEGRADED"

    def _device_health_score(self, m: DeviceMetrics) -> float:
        """Calculate a 0-100 health score for a device."""
        scores = [
            max(0, 100 - m.packet_loss * 10),
            max(0, 100 - max(0, m.latency - 30) * 2),
            min(100, m.throughput),
            max(0, 100 - max(0, m.cpu_usage - 60) * 3),
            max(0, 100 - max(0, m.memory_usage - 70) * 3),
        ]
        return sum(scores) / len(scores)

    # ──────────────────────────────────────
    # Fault Injection
    # ──────────────────────────────────────

    def inject_fault(self, fault_type: FaultType, target_id: Optional[str] = None) -> dict:
        """
        Inject a fault into the simulated network.
        Returns a dict describing what was injected.
        """
        fault_id = f"fault_{self.tick_count}_{fault_type.value}"
        result = {"fault_id": fault_id, "fault_type": fault_type, "target": target_id, "affected": []}

        if fault_type == FaultType.LINK_FAILURE:
            link_id = target_id or "router1-router2"
            if link_id in self.links:
                self.links[link_id].status = LinkStatus.FAILED
                self.links[link_id].packet_loss = 100.0
                self.links[link_id].latency = 9999
                self.links[link_id].utilization = 0
                result["affected"] = [link_id]
                # Also degrade metrics on connected devices
                for did in [self.links[link_id].source, self.links[link_id].target]:
                    if did in self.devices:
                        self.devices[did].metrics.packet_loss = random.uniform(20, 35)
                        self.devices[did].metrics.latency = random.uniform(150, 250)
                        self.devices[did].metrics.throughput = random.uniform(15, 35)

        elif fault_type == FaultType.ROUTER_FAILURE:
            router_id = target_id or "router2"
            if router_id in self.devices:
                self.devices[router_id].status = DeviceStatus.FAILED
                self.devices[router_id].metrics.cpu_usage = 0
                self.devices[router_id].metrics.memory_usage = 0
                self.devices[router_id].metrics.throughput = 0
                self.devices[router_id].metrics.packet_loss = 100
                self.devices[router_id].metrics.latency = 9999
                result["affected"] = [router_id]
                # Fail all connected links
                for lid, link in self.links.items():
                    if link.source == router_id or link.target == router_id:
                        link.status = LinkStatus.FAILED
                        link.packet_loss = 100
                        link.latency = 9999
                        result["affected"].append(lid)

        elif fault_type == FaultType.HIGH_LATENCY:
            target = target_id or "router2"
            if target in self.devices:
                self.devices[target].metrics.latency = random.uniform(160, 260)
                self.devices[target].metrics.jitter = random.uniform(30, 60)
                self.devices[target].metrics.throughput = random.uniform(25, 50)
                result["affected"] = [target]
                # Degrade connected links
                for lid, link in self.links.items():
                    if link.source == target or link.target == target:
                        link.latency = random.uniform(120, 200)
                        link.status = LinkStatus.DEGRADED
                        result["affected"].append(lid)

        elif fault_type == FaultType.PACKET_LOSS:
            target = target_id or "router1-router2"
            if target in self.links:
                self.links[target].packet_loss = random.uniform(22, 38)
                self.links[target].status = LinkStatus.DEGRADED
                result["affected"] = [target]
                for did in [self.links[target].source, self.links[target].target]:
                    if did in self.devices:
                        self.devices[did].metrics.packet_loss = random.uniform(20, 35)
                        self.devices[did].metrics.throughput = random.uniform(30, 50)
                        self.devices[did].metrics.error_rate = random.uniform(5, 12)
                        result["affected"].append(did)

        elif fault_type == FaultType.CONGESTION:
            target = target_id or "router2"
            if target in self.devices:
                self.devices[target].metrics.cpu_usage = random.uniform(85, 98)
                self.devices[target].metrics.memory_usage = random.uniform(80, 95)
                self.devices[target].metrics.latency = random.uniform(100, 200)
                self.devices[target].metrics.packet_loss = random.uniform(10, 25)
                self.devices[target].metrics.throughput = random.uniform(20, 40)
                self.devices[target].metrics.traffic_load = random.uniform(85, 99)
                result["affected"] = [target]
                for lid, link in self.links.items():
                    if link.source == target or link.target == target:
                        link.utilization = random.uniform(85, 99)
                        link.latency = random.uniform(50, 120)
                        link.packet_loss = random.uniform(8, 18)
                        link.status = LinkStatus.DEGRADED
                        result["affected"].append(lid)

        elif fault_type == FaultType.SERVER_FAILURE:
            server_id = target_id or "server1"
            if server_id in self.devices:
                self.devices[server_id].status = DeviceStatus.FAILED
                self.devices[server_id].metrics.cpu_usage = 0
                self.devices[server_id].metrics.memory_usage = 0
                self.devices[server_id].metrics.throughput = 0
                self.devices[server_id].metrics.packet_loss = 100
                self.devices[server_id].metrics.latency = 9999
                result["affected"] = [server_id]
                for lid, link in self.links.items():
                    if link.source == server_id or link.target == server_id:
                        link.status = LinkStatus.FAILED
                        link.packet_loss = 100
                        result["affected"].append(lid)

        self.active_faults[fault_id] = result
        return result

    def _apply_active_faults(self):
        """Keep faulty components and manually disabled elements in degraded state each tick."""
        # Enforce manual device shutdowns
        for dev_id in self.manual_shutdowns:
            dev = self.devices.get(dev_id)
            if dev:
                dev.is_powered_on = False
                dev.status = DeviceStatus.FAILED
                dev.operational_status = "FAILED"
                dev.metrics.throughput = 0.0
                dev.metrics.cpu_usage = 0.0
                dev.metrics.memory_usage = 0.0
                dev.metrics.packet_loss = 100.0
                dev.metrics.latency = 9999.0
                dev.metrics.traffic_load = 0.0
                for p in dev.ports:
                    p.status = PortStatus.DOWN
                    link = self.links.get(p.link_id)
                    if link:
                        link.status = LinkStatus.FAILED
                        link.packet_loss = 100.0
                        link.latency = 9999.0

        # Enforce manually disabled ports
        for dev_id, port_ids in self.disabled_ports.items():
            dev = self.devices.get(dev_id)
            if dev:
                for p in dev.ports:
                    if p.port_id in port_ids:
                        p.status = PortStatus.DOWN
                        link = self.links.get(p.link_id)
                        if link:
                            link.status = LinkStatus.FAILED
                            link.packet_loss = 100.0
                            link.latency = 9999.0

        # Enforce active faults
        for fid, fault_info in list(self.active_faults.items()):
            for comp_id in fault_info.get("affected", []):
                if comp_id in self.links and self.links[comp_id].status == LinkStatus.FAILED:
                    self.links[comp_id].packet_loss = 100.0
                    self.links[comp_id].latency = 9999.0
                if comp_id in self.devices and self.devices[comp_id].status == DeviceStatus.FAILED:
                    self.devices[comp_id].metrics.throughput = 0.0
                    self.devices[comp_id].metrics.packet_loss = 100.0
                    self.devices[comp_id].operational_status = "FAILED"

    # ──────────────────────────────────────
    # Interactive Device & Port Controls
    # ──────────────────────────────────────

    def set_port_status(self, device_id: str, port_id: str, enable: bool) -> dict:
        """
        Enable or disable an individual switch port or device interface.
        Disabling a port sets the associated network link to FAILED and prevents traffic.
        """
        dev = self.devices.get(device_id)
        if not dev:
            raise ValueError(f"Device '{device_id}' does not exist.")

        target_port = None
        for p in dev.ports:
            if p.port_id == port_id:
                target_port = p
                break

        if not target_port:
            raise ValueError(f"Port '{port_id}' not found on device '{device_id}'.")

        prev_status = target_port.status.value
        link_id = target_port.link_id
        link = self.links.get(link_id)

        if not enable:
            # Disable port
            target_port.status = PortStatus.DOWN
            self.disabled_ports.setdefault(device_id, set()).add(port_id)
            if link:
                link.status = LinkStatus.FAILED
                link.packet_loss = 100.0
                link.latency = 9999.0
                link.utilization = 0.0

            # Reflect physical link-down on peer port
            peer_dev = self.devices.get(target_port.connected_device_id)
            if peer_dev:
                for pp in peer_dev.ports:
                    if pp.link_id == link_id:
                        pp.status = PortStatus.DOWN

            new_status = PortStatus.DOWN.value
        else:
            # Enable port
            target_port.status = PortStatus.UP
            if device_id in self.disabled_ports:
                self.disabled_ports[device_id].discard(port_id)

            # Check if peer device is powered on and peer port is not independently disabled
            peer_dev = self.devices.get(target_port.connected_device_id)
            peer_disabled = False
            if peer_dev and target_port.connected_device_id in self.disabled_ports:
                for pp in peer_dev.ports:
                    if pp.link_id == link_id and pp.port_id in self.disabled_ports[target_port.connected_device_id]:
                        peer_disabled = True
                        break

            if peer_dev and getattr(peer_dev, 'is_powered_on', True) and peer_dev.status != DeviceStatus.FAILED and not peer_disabled:
                if link:
                    self.recover_link(link_id)
                for pp in peer_dev.ports:
                    if pp.link_id == link_id:
                        pp.status = PortStatus.UP
            new_status = PortStatus.UP.value

        self._update_device_status(dev)
        return {
            "device_id": device_id,
            "port_id": port_id,
            "port_name": target_port.name,
            "link_id": link_id,
            "previous_status": prev_status,
            "new_status": new_status,
            "link_status": link.status.value if link else "none",
        }

    def set_device_power(self, device_id: str, action: str) -> dict:
        """
        Perform power control on a network device:
        - 'shutdown' (routers, switches)
        - 'restart' (routers, switches, servers)
        - 'stop' (servers)
        - 'start' (servers)
        """
        dev = self.devices.get(device_id)
        if not dev:
            raise ValueError(f"Device '{device_id}' does not exist.")

        prev_state = "ACTIVE" if (dev.status != DeviceStatus.FAILED and getattr(dev, 'is_powered_on', True)) else "FAILED"

        if action in ("shutdown", "stop"):
            if not getattr(dev, 'is_powered_on', True) or dev.status == DeviceStatus.FAILED:
                raise ValueError(f"Device '{device_id}' is already powered off or shut down.")

            dev.is_powered_on = False
            dev.status = DeviceStatus.FAILED
            dev.operational_status = "FAILED"
            dev.metrics.cpu_usage = 0.0
            dev.metrics.memory_usage = 0.0
            dev.metrics.throughput = 0.0
            dev.metrics.packet_loss = 100.0
            dev.metrics.latency = 9999.0
            dev.metrics.traffic_load = 0.0

            # Drop all ports and connected links
            for p in dev.ports:
                p.status = PortStatus.DOWN
                link = self.links.get(p.link_id)
                if link:
                    link.status = LinkStatus.FAILED
                    link.packet_loss = 100.0
                    link.latency = 9999.0
                    link.utilization = 0.0
                # Reflect on peer port
                peer_dev = self.devices.get(p.connected_device_id)
                if peer_dev:
                    for pp in peer_dev.ports:
                        if pp.link_id == p.link_id:
                            pp.status = PortStatus.DOWN

            self.manual_shutdowns.add(device_id)
            new_state = "FAILED"

        elif action in ("restart", "start"):
            # Restore device to healthy active state
            dev.is_powered_on = True
            dev.status = DeviceStatus.HEALTHY
            dev.operational_status = "ACTIVE"
            dev.metrics = self._baseline_metrics(dev.device_type)
            self.manual_shutdowns.discard(device_id)

            # Restore ports, checking if peer is healthy and port not manually disabled
            for p in dev.ports:
                is_disabled = (device_id in self.disabled_ports and p.port_id in self.disabled_ports[device_id])
                if not is_disabled:
                    p.status = PortStatus.UP
                    link = self.links.get(p.link_id)
                    peer_dev = self.devices.get(p.connected_device_id)
                    peer_ok = peer_dev and getattr(peer_dev, 'is_powered_on', True) and peer_dev.status != DeviceStatus.FAILED and p.connected_device_id not in self.manual_shutdowns
                    peer_port_disabled = False
                    if peer_dev and p.connected_device_id in self.disabled_ports:
                        for pp in peer_dev.ports:
                            if pp.link_id == p.link_id and pp.port_id in self.disabled_ports[p.connected_device_id]:
                                peer_port_disabled = True
                                break

                    if peer_ok and not peer_port_disabled and link:
                        self.recover_link(p.link_id)
                        for pp in peer_dev.ports:
                            if pp.link_id == p.link_id:
                                pp.status = PortStatus.UP
                    elif link:
                        link.status = LinkStatus.FAILED

            self._update_device_status(dev)
            new_state = "ACTIVE"
        else:
            raise ValueError(f"Unknown power action '{action}'. Supported: shutdown, restart, stop, start.")

        return {
            "device_id": device_id,
            "device_name": dev.name,
            "action": action,
            "previous_state": prev_state,
            "new_state": new_state,
            "operational_status": dev.operational_status,
        }

    # ──────────────────────────────────────
    # Recovery Actions
    # ──────────────────────────────────────

    def recover_link(self, link_id: str):
        """Restore a failed link to active state."""
        if link_id in self.links:
            link = self.links[link_id]
            link.status = LinkStatus.ACTIVE
            link.packet_loss = random.uniform(0.1, 1.5)
            link.latency = random.uniform(3, 10)
            link.utilization = random.uniform(20, 45)
            link.cost = 1.0 + link.latency / 10.0

    def recover_device(self, device_id: str):
        """Restore a failed device to healthy state."""
        if device_id in self.devices:
            dev = self.devices[device_id]
            dev.status = DeviceStatus.RECOVERING
            dev.is_powered_on = True
            dev.operational_status = "ACTIVE"
            dev.metrics = self._baseline_metrics(dev.device_type)
            self.manual_shutdowns.discard(device_id)

            # Restore ports not manually disabled
            for p in dev.ports:
                if not (device_id in self.disabled_ports and p.port_id in self.disabled_ports[device_id]):
                    p.status = PortStatus.UP

            # Recover connected links where peer is healthy and port is enabled
            for lid, link in self.links.items():
                if (link.source == device_id or link.target == device_id) and link.status == LinkStatus.FAILED:
                    peer_id = link.target if link.source == device_id else link.source
                    peer_dev = self.devices.get(peer_id)
                    peer_ok = peer_dev and getattr(peer_dev, 'is_powered_on', True) and peer_dev.status != DeviceStatus.FAILED and peer_id not in self.manual_shutdowns
                    this_port_down = device_id in self.disabled_ports and any(p.link_id == lid and p.port_id in self.disabled_ports[device_id] for p in dev.ports)
                    peer_port_down = peer_dev and peer_id in self.disabled_ports and any(p.link_id == lid and p.port_id in self.disabled_ports[peer_id] for p in peer_dev.ports)
                    if peer_ok and not this_port_down and not peer_port_down:
                        self.recover_link(lid)
                        if peer_dev:
                            for pp in peer_dev.ports:
                                if pp.link_id == lid:
                                    pp.status = PortStatus.UP

            dev.status = DeviceStatus.HEALTHY

    def reroute_traffic(self, failed_component: str, new_path: List[str]):
        """Simulate traffic rerouting — boost metrics on alternate path links."""
        for i in range(len(new_path) - 1):
            lid1 = f"{new_path[i]}-{new_path[i+1]}"
            lid2 = f"{new_path[i+1]}-{new_path[i]}"
            lid = lid1 if lid1 in self.links else lid2 if lid2 in self.links else None
            if lid:
                link = self.links[lid]
                link.utilization = min(90, link.utilization + random.uniform(10, 25))
                link.cost = 1.0 + link.latency / 10.0 + link.utilization / 100.0

    def normalize_affected_devices(self, affected_ids: List[str]):
        """Gradually bring affected devices back to normal metrics."""
        for did in affected_ids:
            if did in self.devices and self.devices[did].status != DeviceStatus.FAILED and did not in self.manual_shutdowns:
                dev = self.devices[did]
                m = dev.metrics
                # Gradually normalize
                m.packet_loss = max(0.5, m.packet_loss * 0.3) + random.uniform(0, 1)
                m.latency = max(10, m.latency * 0.2) + random.uniform(5, 15)
                m.throughput = min(100, m.throughput * 1.5 + random.uniform(10, 30))
                m.cpu_usage = max(20, m.cpu_usage * 0.5) + random.uniform(5, 15)
                m.memory_usage = max(20, m.memory_usage * 0.5) + random.uniform(5, 15)
                m.jitter = max(1, m.jitter * 0.3) + random.uniform(0.5, 2)
                dev.status = DeviceStatus.HEALTHY
                dev.operational_status = "ACTIVE"

    def clear_fault(self, fault_id: str):
        """Remove a tracked fault."""
        self.active_faults.pop(fault_id, None)

    def reset_network(self):
        """Reset the entire network to initial healthy state."""
        self.devices.clear()
        self.links.clear()
        self.active_faults.clear()
        self.disabled_ports.clear()
        self.manual_shutdowns.clear()
        self.tick_count = 0
        self._initialize_network()

    # ──────────────────────────────────────
    # State Retrieval
    # ──────────────────────────────────────

    def get_all_devices(self) -> List[NetworkDevice]:
        return list(self.devices.values())

    def get_all_links(self) -> List[NetworkLink]:
        return list(self.links.values())

    def get_device(self, device_id: str) -> Optional[NetworkDevice]:
        return self.devices.get(device_id)

    def get_link(self, link_id: str) -> Optional[NetworkLink]:
        return self.links.get(link_id)

    def get_aggregated_metrics(self) -> Dict[str, float]:
        """Return aggregated metrics across all active devices."""
        active = [d for d in self.devices.values() if d.status != DeviceStatus.FAILED]
        if not active:
            return {"latency": 9999, "packet_loss": 100, "throughput": 0,
                    "cpu_usage": 0, "memory_usage": 0, "jitter": 0,
                    "error_rate": 0, "traffic_load": 0}
        n = len(active)
        return {
            "latency": sum(d.metrics.latency for d in active) / n,
            "packet_loss": sum(d.metrics.packet_loss for d in active) / n,
            "throughput": sum(d.metrics.throughput for d in active) / n,
            "cpu_usage": sum(d.metrics.cpu_usage for d in active) / n,
            "memory_usage": sum(d.metrics.memory_usage for d in active) / n,
            "jitter": sum(d.metrics.jitter for d in active) / n,
            "error_rate": sum(d.metrics.error_rate for d in active) / n,
            "traffic_load": sum(d.metrics.traffic_load for d in active) / n,
        }

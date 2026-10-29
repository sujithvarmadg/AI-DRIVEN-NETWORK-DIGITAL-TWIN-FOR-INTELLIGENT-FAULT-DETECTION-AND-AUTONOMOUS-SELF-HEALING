"""
Unit test script for Interactive Network Device Control.
Directly tests simulator, routing engine, and database without needing a running server.
"""

from services.network_simulator import NetworkSimulator
from services.routing import RoutingEngine
from database.database import Database
from models.network import DeviceType, DeviceStatus, LinkStatus, PortStatus


def test_interactive_device_control():
    print("=" * 60)
    print("TESTING INTERACTIVE NETWORK DEVICE CONTROL (UNIT TESTS)")
    print("=" * 60)

    db = Database()
    sim = NetworkSimulator()
    routing = RoutingEngine()

    # ── 1. Device and Port Initialization ──
    print("\n[1] Checking device and port initialization...")
    devices = sim.get_all_devices()
    links = sim.get_all_links()
    assert len(devices) == 9, f"Expected 9 devices, got {len(devices)}"
    assert len(links) == 10, f"Expected 10 links, got {len(links)}"

    switch1 = sim.get_device("switch1")
    assert switch1 is not None
    assert len(switch1.ports) == 2, f"Expected 2 ports on switch1, got {len(switch1.ports)}"
    assert switch1.operational_status == "ACTIVE"
    print("  -> Switch S1 ports:", [p.name for p in switch1.ports])

    router1 = sim.get_device("router1")
    assert router1 is not None
    assert len(router1.ports) == 3, f"Expected 3 interfaces on router1, got {len(router1.ports)}"
    assert router1.operational_status == "ACTIVE"
    print("  -> Router R1 interfaces:", [p.name for p in router1.ports])

    server1 = sim.get_device("server1")
    assert server1 is not None
    assert len(server1.ports) == 1
    assert server1.operational_status == "ACTIVE"
    print("  -> Server S1 interfaces:", [p.name for p in server1.ports])
    print("  -> PASSED: Initialization valid.")

    # ── 2. Switch Port Controls & Routing Impact ──
    print("\n[2] Testing switch port disable & re-enable...")
    # Initial path client1 -> server1
    path_init = routing.find_path(list(sim.links.values()), "client1", "server1")
    assert path_init is not None, "Initial path client1 -> server1 should exist"
    print(f"  -> Baseline path: {path_init[0]} (cost: {path_init[1]:.2f})")

    # Disable switch1 port-2 (connected to router1 via switch1-router1)
    res_disable = sim.set_port_status("switch1", "port-2", enable=False)
    assert res_disable["new_status"] == "down"
    link_sr1 = sim.get_link("switch1-router1")
    assert link_sr1.status == LinkStatus.FAILED
    assert link_sr1.packet_loss == 100.0

    # Route client1 -> server1 MUST NOT traverse disabled port
    path_after_disable = routing.find_path(list(sim.links.values()), "client1", "server1")
    assert path_after_disable is None, f"Expected no path, got {path_after_disable}"
    print("  -> After disabling switch1 port-2: client1 -> server1 is UNREACHABLE (PASSED)")

    # Re-enable switch1 port-2
    res_enable = sim.set_port_status("switch1", "port-2", enable=True)
    assert res_enable["new_status"] == "up"
    assert link_sr1.status == LinkStatus.ACTIVE

    # Route should be restored
    path_restored = routing.find_path(list(sim.links.values()), "client1", "server1")
    assert path_restored is not None
    print(f"  -> After re-enabling port-2: Restored path {path_restored[0]} (cost: {path_restored[1]:.2f}) (PASSED)")

    # ── 3. Router Controls & Routing Table ──
    print("\n[3] Testing router controls & routing table...")
    rt_table = routing.compute_routing_table("router1", sim.devices, list(sim.links.values()))
    assert len(rt_table) == 8, f"Expected 8 routes from router1, got {len(rt_table)}"
    server1_entry = next(e for e in rt_table if e["destination_id"] == "server1")
    assert server1_entry["status"] in ("ACTIVE", "DIRECT")
    assert server1_entry["next_hop_id"] == "router2"
    print(f"  -> Router R1 to Server S1 route: next_hop={server1_entry['next_hop_id']}, if={server1_entry['interface']}, cost={server1_entry['path_cost']}")

    # Shut down router2
    print("  -> Shutting down router2...")
    sim.set_device_power("router2", "shutdown")
    router2 = sim.get_device("router2")
    assert router2.status == DeviceStatus.FAILED
    assert router2.operational_status == "FAILED"
    assert router2.is_powered_on is False

    # Check that router1 cannot route through router2
    failed_devs = {did for did, d in sim.devices.items() if d.status == DeviceStatus.FAILED}
    path_thru_r2 = routing.find_path(list(sim.links.values()), "router1", "server1", failed_devices=failed_devs)
    assert path_thru_r2 is None, f"Expected router2 to be bypassed or unreachable, got {path_thru_r2}"
    print("  -> Shut-down router2 cannot be used as an intermediate node! (PASSED)")

    # Router2 routing table when shut down
    rt_table_r2 = routing.compute_routing_table("router2", sim.devices, list(sim.links.values()))
    assert all(e["status"] == "UNREACHABLE" for e in rt_table_r2)
    print("  -> All routes on shut-down router2 are UNREACHABLE (PASSED)")

    # Restart router2
    print("  -> Restarting router2...")
    sim.set_device_power("router2", "restart")
    assert router2.status == DeviceStatus.HEALTHY
    assert router2.operational_status == "ACTIVE"
    assert router2.is_powered_on is True

    failed_devs_restored = {did for did, d in sim.devices.items() if d.status == DeviceStatus.FAILED}
    path_restored_r2 = routing.find_path(list(sim.links.values()), "router1", "server1", failed_devices=failed_devs_restored)
    assert path_restored_r2 is not None
    print(f"  -> After router2 restart: Path restored: {path_restored_r2[0]} (PASSED)")

    # ── 4. Server Controls ──
    print("\n[4] Testing server stop & restart...")
    sim.set_device_power("server1", "stop")
    assert server1.status == DeviceStatus.FAILED
    assert server1.operational_status == "FAILED"

    failed_devs_srv = {did for did, d in sim.devices.items() if d.status == DeviceStatus.FAILED}
    path_to_stopped_server = routing.find_path(list(sim.links.values()), "client1", "server1", failed_devices=failed_devs_srv)
    assert path_to_stopped_server is None
    print("  -> Stopped server1 is UNREACHABLE as a destination (PASSED)")

    # Restart server1
    sim.set_device_power("server1", "restart")
    assert server1.status == DeviceStatus.HEALTHY
    assert server1.operational_status == "ACTIVE"
    failed_devs_srv_ok = {did for did, d in sim.devices.items() if d.status == DeviceStatus.FAILED}
    path_to_active_server = routing.find_path(list(sim.links.values()), "client1", "server1", failed_devices=failed_devs_srv_ok)
    assert path_to_active_server is not None
    print(f"  -> Restarted server1 is reachable again: {path_to_active_server[0]} (PASSED)")

    # ── 5. Database Action Logging ──
    print("\n[5] Testing database action logging...")
    db.add_device_action({
        "action_id": "test_act1",
        "device_id": "router1",
        "device_name": "Router R1",
        "action": "device_shutdown",
        "target_component": "Router R1",
        "previous_state": "ACTIVE",
        "new_state": "FAILED",
        "outcome": "SUCCESS",
        "details": {"test": True}
    })
    actions = db.get_device_actions("router1")
    assert len(actions) >= 1
    assert actions[0]["action"] == "device_shutdown"
    print(f"  -> SQLite logged action successfully: {actions[0]['action']} on {actions[0]['device_name']} (PASSED)")

    # ── 6. Validation & Edge Cases ──
    print("\n[6] Testing validation and error handling...")
    try:
        sim.set_port_status("switch1", "invalid-port-xyz", False)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print(f"  -> Caught expected error for invalid port: {e} (PASSED)")

    try:
        sim.set_device_power("server1", "fly_to_moon")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print(f"  -> Caught expected error for invalid power action: {e} (PASSED)")

    print("\n" + "=" * 60)
    print("ALL 6 UNIT TEST SUITES PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    test_interactive_device_control()

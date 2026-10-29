"""
Test script for verifying FastAPI route handler logic directly with asyncio.
Doesn't require httpx or external test clients.
"""

import asyncio
from main import (
    lifespan, app,
    get_device_details, get_device_ports, get_device_routing_table,
    control_switch_port, control_device_power, get_device_actions,
    get_route
)
from models.network import SwitchPortControlRequest, DevicePowerRequest
from fastapi import HTTPException


async def run_endpoint_tests():
    print("=" * 60)
    print("TESTING FASTAPI ROUTE HANDLERS DIRECTLY")
    print("=" * 60)

    # Trigger lifespan startup
    async with lifespan(app):
        # 1. Device details endpoint
        print("\n[1] Testing get_device_details for switch1 & router1...")
        res_sw = await get_device_details("switch1")
        assert res_sw["device"]["id"] == "switch1"
        assert len(res_sw["ports"]) == 2
        assert len(res_sw["connected_links"]) == 2
        print(f"  -> switch1: operational_status={res_sw['device']['operational_status']}, ports={len(res_sw['ports'])} (PASSED)")

        res_r1 = await get_device_details("router1")
        assert len(res_r1["routing_table"]) > 0
        print(f"  -> router1: routing_table entries={len(res_r1['routing_table'])} (PASSED)")

        # 2. Ports endpoint
        print("\n[2] Testing get_device_ports...")
        ports_sw = await get_device_ports("switch1")
        assert len(ports_sw) == 2
        print(f"  -> switch1 ports: {[p['port_id'] for p in ports_sw]} (PASSED)")

        # 3. Routing table endpoint
        print("\n[3] Testing get_device_routing_table...")
        rt_r1 = await get_device_routing_table("router1")
        assert len(rt_r1) == 8
        print(f"  -> router1 routing table: {len(rt_r1)} destinations calculated (PASSED)")

        try:
            await get_device_routing_table("switch1")
            assert False, "Should have raised HTTPException for switch"
        except HTTPException as e:
            assert e.status_code == 400
            print(f"  -> Caught expected 400 when requesting routing table for switch: {e.detail} (PASSED)")

        # 4. Port control endpoint (disable then enable)
        print("\n[4] Testing control_switch_port...")
        req_dis = SwitchPortControlRequest(port_id="port-2", action="disable")
        res_dis = await control_switch_port("switch1", req_dis)
        assert res_dis["status"] == "success"
        assert res_dis["result"]["new_status"] == "down"
        print("  -> Port 2 disabled successfully (PASSED)")

        # Verify route client1 -> server1 is broken
        route_broken = await get_route("client1", "server1")
        assert route_broken["path"] is None
        print("  -> Route client1 -> server1 is now UNREACHABLE (PASSED)")

        # Re-enable port
        req_en = SwitchPortControlRequest(port_id="port-2", action="enable")
        res_en = await control_switch_port("switch1", req_en)
        assert res_en["result"]["new_status"] == "up"

        route_restored = await get_route("client1", "server1")
        assert route_restored["path"] is not None
        print(f"  -> Route client1 -> server1 restored: {route_restored['path']} (PASSED)")

        # 5. Device power control (router shutdown and restart)
        print("\n[5] Testing control_device_power for router2...")
        req_shut = DevicePowerRequest(action="shutdown")
        res_shut = await control_device_power("router2", req_shut)
        assert res_shut["device"]["operational_status"] == "FAILED"
        print("  -> router2 shutdown successfully (PASSED)")

        # Verify router1 cannot route through router2 to server1
        route_r2_down = await get_route("router1", "server1")
        assert route_r2_down["path"] is None
        print("  -> router2 excluded from intermediate hops while shut down (PASSED)")

        # Restart router2
        req_rest = DevicePowerRequest(action="restart")
        res_rest = await control_device_power("router2", req_rest)
        assert res_rest["device"]["operational_status"] == "ACTIVE"

        route_r2_rest = await get_route("router1", "server1")
        assert route_r2_rest["path"] is not None
        print(f"  -> router2 restarted and route restored: {route_r2_rest['path']} (PASSED)")

        # 6. Server stop and restart
        print("\n[6] Testing control_device_power for server1...")
        req_srv_stop = DevicePowerRequest(action="stop")
        res_srv_stop = await control_device_power("server1", req_srv_stop)
        assert res_srv_stop["device"]["operational_status"] == "FAILED"

        route_srv_down = await get_route("client1", "server1")
        assert route_srv_down["path"] is None
        print("  -> Stopped server1 is unreachable (PASSED)")

        req_srv_start = DevicePowerRequest(action="restart")
        res_srv_start = await control_device_power("server1", req_srv_start)
        assert res_srv_start["device"]["operational_status"] == "ACTIVE"

        route_srv_up = await get_route("client1", "server1")
        assert route_srv_up["path"] is not None
        print(f"  -> server1 restarted and route restored: {route_srv_up['path']} (PASSED)")

        # 7. Device action history log endpoint
        print("\n[7] Testing get_device_actions...")
        actions = await get_device_actions(limit=50)
        assert len(actions) >= 4
        print(f"  -> Retrieved {len(actions)} device action log records from SQLite:")
        for a in actions[:3]:
            print(f"     * [{a['timestamp'][:19]}] {a['device_name']} -> {a['action']} (Outcome: {a['outcome']})")
        print("  -> PASSED: Action history audit log verified.")

        # 8. Validation tests
        print("\n[8] Testing validation and error handling...")
        try:
            await get_device_details("nonexistent_device_404")
            assert False, "Should have raised 404"
        except HTTPException as e:
            assert e.status_code == 404
            print(f"  -> Caught expected 404 for nonexistent device: {e.detail} (PASSED)")

        try:
            await control_device_power("router1", DevicePowerRequest(action="teleport"))
            assert False, "Should have raised 400"
        except HTTPException as e:
            assert e.status_code == 400
            print(f"  -> Caught expected 400 for invalid action: {e.detail} (PASSED)")

        try:
            await control_switch_port("switch1", SwitchPortControlRequest(port_id="port-999", action="disable"))
            assert False, "Should have raised 404"
        except HTTPException as e:
            assert e.status_code == 404
            print(f"  -> Caught expected 404 for invalid port: {e.detail} (PASSED)")

    print("\n" + "=" * 60)
    print("ALL FASTAPI ENDPOINT TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_endpoint_tests())

"""
Verification that existing AI Anomaly Detection and Self-Healing Engine remain 100% functional.
"""

from services.network_simulator import NetworkSimulator
from services.routing import RoutingEngine
from services.fault_detector import FaultDetector
from services.self_healing import SelfHealingEngine
from models.network import FaultType, DeviceStatus, LinkStatus


def test_ai_fault_detection_and_self_healing():
    print("=" * 60)
    print("TESTING AI ANOMALY DETECTION & SELF-HEALING REGRESSION")
    print("=" * 60)

    sim = NetworkSimulator()
    routing = RoutingEngine()
    detector = FaultDetector()
    healer = SelfHealingEngine(sim, routing)

    fault_scenarios = [
        FaultType.LINK_FAILURE,
        FaultType.ROUTER_FAILURE,
        FaultType.HIGH_LATENCY,
        FaultType.PACKET_LOSS,
        FaultType.CONGESTION,
        FaultType.SERVER_FAILURE,
    ]

    for ft in fault_scenarios:
        print(f"\n[TEST] Fault: {ft.value}...")
        # 1. Inject fault
        inj = sim.inject_fault(ft)
        print(f"  -> Injected affected components: {inj.get('affected')}")

        # 2. AI Analysis
        detection = detector.analyze_network(sim.devices, sim.links)
        print(f"  -> AI Anomaly Detected: {detection.anomaly_detected}")
        print(f"  -> AI Detected Fault Type: {detection.fault_type} (Confidence: {detection.confidence*100:.1f}%)")
        assert detection.anomaly_detected is True, f"AI should detect anomaly for {ft}"

        # 3. Autonomous Self-Healing
        rec = healer.heal(detection, strategy="auto")
        assert rec is not None, f"Self-healing should produce recovery for {ft}"
        print(f"  -> Healed with Strategy: {rec.recovery_strategy} (Status: {rec.status})")
        print(f"  -> Alternate Path: {rec.alternate_path}")
        assert rec.status.value in ("success", "partial"), f"Expected success, got {rec.status}"

        # 4. Reset for next test
        sim.reset_network()
        detector.clear_history()
        healer.clear_history()

    print("\n" + "=" * 60)
    print("ALL 6 FAULT DETECTION & SELF-HEALING REGRESSION TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_ai_fault_detection_and_self_healing()

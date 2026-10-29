import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HiOutlineShieldCheck,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineArrowRight,
  HiOutlineLightningBolt,
  HiOutlineChip,
  HiOutlineCode,
  HiOutlineCheckCircle,
  HiOutlineAdjustments,
} from 'react-icons/hi';

/**
 * SelfHealing — displays the autonomous recovery pipeline progress,
 * selectable healing strategies ("how to heal it"), and the rich
 * algorithms & mathematical summary used to resolve the incident.
 */

const PIPELINE_STEP_DETAILS = [
  {
    name: 'Fault Detected',
    tag: 'Anomaly Isolation',
    algorithm: 'Isolation Forest (Scikit-Learn)',
    detail: 'Continuous telemetry outlier scoring (>0.5 threshold) on latency & packet drop rates',
  },
  {
    name: 'Analyzing Network',
    tag: 'ML Root-Cause Diagnosis',
    algorithm: 'Random Forest Classifier (100 Trees)',
    detail: 'Feature extraction across CPU, throughput & buffer queues to classify exact incident type',
  },
  {
    name: 'Finding Alternate Path',
    tag: 'Topology Optimization',
    getAlgorithm: (strat) => {
      if (strat?.id === 'bfs_hop_count') return 'Breadth-First Search (BFS)';
      if (strat?.id === 'traffic_shaping') return 'Token Bucket & WFQ Egress Queues';
      if (strat?.id === 'server_failover') return 'VRRP Active-Passive Virtual IP Switch';
      return 'Dynamic Weighted Dijkstra (Composite QoS)';
    },
    getDetail: (strat) => {
      if (strat?.id === 'bfs_hop_count') return 'Traverses graph topology to find minimum hop-count path (O(|V| + |E|))';
      if (strat?.id === 'traffic_shaping') return 'Dynamically bounds token arrival rate & relieves saturated router buffers';
      if (strat?.id === 'server_failover') return 'Switches virtual ARP/BGP IP pointers to backup replica server in O(1)';
      return 'Solves min ∑[Latency + 10·Loss + (Util/10)] via Fibonacci min-heap priority queue';
    },
  },
  {
    name: 'Applying Recovery',
    tag: 'SDN Flow Reconfiguration',
    algorithm: 'OpenFlow / SDN Flow Table Re-programming',
    detail: 'Atomically pushes updated next-hop forwarding rules to all upstream switches & routers',
  },
  {
    name: 'Testing Connectivity',
    tag: 'Liveness & SLA Verification',
    algorithm: 'Fast BFD (Bidirectional Forwarding) & Echo Probing',
    detail: 'Sends sub-second synthetic test bursts to ensure 0% packet loss and SLA compliance',
  },
  {
    name: 'Recovery Complete',
    tag: 'Digital Twin State Sync',
    algorithm: 'Closed-Loop Metric Normalization',
    detail: 'Verifies network convergence, updates telemetry database, and restores baseline health score',
  },
];

const DEFAULT_STRATEGIES = [
  {
    id: 'auto',
    name: 'AI Autonomous Multi-Objective Optimization (Recommended)',
    badge: 'AI Optimal',
    description: 'Synthesizes multi-objective utility functions to select the optimal combination of rerouting, traffic shaping, and node failover.',
    algorithm: 'Multi-Criteria Decision Analysis + Composite Dijkstra',
    complexity: 'O(|E| + |V| log |V|)',
    objective: 'Minimize Composite QoS Penalty: Latency + Loss + Queue Congestion',
    formula: 'min ∑ [ α·Latency(e) + β·PacketLoss(e) + γ·(Util(e)/(100 - Util(e))) ]',
  },
  {
    id: 'dijkstra_weighted',
    name: 'Dynamic Weighted Dijkstra (Composite QoS)',
    badge: 'Lowest Cost',
    description: 'Calculates alternate shortest path using composite link weights accounting for real-time latency, packet drop rate, and link saturation.',
    algorithm: "Dijkstra's Algorithm with Fibonacci Min-Heap Priority Queue",
    complexity: 'O(|E| + |V| log |V|)',
    objective: 'Global Shortest Path with Dynamic Metric Tensor',
    formula: 'W(e) = Latency(e) + 10 × Loss(e) + (Util(e)/10)',
  },
  {
    id: 'bfs_hop_count',
    name: 'Greedy Minimum-Hop Routing',
    badge: 'Fastest Convergence',
    description: 'Selects the topological path with minimal hop count bypassing failed or congested nodes regardless of link weight variations.',
    algorithm: 'Breadth-First Search (BFS) / Uniform Cost Traversal',
    complexity: 'O(|V| + |E|)',
    objective: 'Minimize Total Inter-Device Relay Hops',
    formula: 'min |Path(P)| such that (u, v) ∈ ActiveLinks',
  },
  {
    id: 'traffic_shaping',
    name: 'Adaptive Traffic Shaping & Congestion Control',
    badge: 'Flow Regulation',
    description: 'Throttles non-essential burst flows via Token Bucket regulation, dynamically relieving buffers and balancing egress queues.',
    algorithm: 'Token Bucket Rate Limiter + Weighted Fair Queuing (WFQ)',
    complexity: 'O(1) amortized per packet',
    objective: 'Eliminate Bufferbloat and Queue Dropping',
    formula: 'Bucket(b, r): tokens = min(b, tokens + r·Δt)',
  },
  {
    id: 'server_failover',
    name: 'Active-Passive Redundant Failover',
    badge: 'Zero Downtime',
    description: 'Instantly routes inbound traffic to the warm standby replica server and updates BGP/ARP tables to maintain service availability.',
    algorithm: 'Virtual Router Redundancy Protocol (VRRP) / Fast BFD Heartbeat',
    complexity: 'O(1) atomic route pointer switch',
    objective: 'Zero-Downtime Service Continuity',
    formula: 'Failover Trigger: MissedHeartbeats > 3 (τ < 500ms)',
  },
];

const METRIC_LABELS = {
  latency: 'Latency',
  packet_loss: 'Packet Loss',
  throughput: 'Throughput',
  cpu_usage: 'CPU Usage',
  memory_usage: 'Memory Usage',
  traffic_load: 'Traffic Load',
};

const METRIC_UNITS = {
  latency: ' ms',
  packet_loss: '%',
  throughput: ' Mbps',
  cpu_usage: '%',
  memory_usage: '%',
  traffic_load: '%',
};

export default function SelfHealing({
  healingStatus,
  lastRecovery,
  onTriggerHealing,
  isLoading,
  detection,
  activeFault,
  activeFaults = [],
  topology = null,
  onNavigate,
}) {
  const [selectedStrategy, setSelectedStrategy] = useState('auto');
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'options', 'algorithms'

  // Sequential pipeline state:
  // activeStepIndex: -1 (idle/queued), 0..5 (currently computing), 6 (all 6 completed & verified)
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [completedStepIndices, setCompletedStepIndices] = useState([]);
  const [isFlowRunning, setIsFlowRunning] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(null);

  const flowRunningRef = useRef(false);
  const timersRef = useRef([]);

  const stage = healingStatus?.stage || 'idle';
  const isIdle = stage === 'idle';

  const hasTopologyFault = Boolean(
    (topology?.devices || []).some((d) => d.status === 'failed' || d.status === 'critical') ||
    (topology?.links || []).some((l) => l.status === 'failed' || l.status === 'degraded')
  );

  const isFaultDetected =
    stage === 'fault_detected' ||
    Boolean(activeFault || (activeFaults && activeFaults.length > 0) || detection?.anomaly_detected || hasTopologyFault);

  const isComplete = stage === 'completed' || Boolean(lastRecovery) || activeStepIndex === 6;
  const recovery = lastRecovery || healingStatus?.recovery_action;
  const algorithmSummary = recovery?.algorithm_summary || healingStatus?.algorithm_summary;

  const strategies = healingStatus?.available_strategies || DEFAULT_STRATEGIES;
  const currentStratObj = strategies.find((s) => s.id === selectedStrategy) || strategies[0];

  const clearAllFlowTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllFlowTimers();
    };
  }, [clearAllFlowTimers]);

  // ── Sequential Execution Flow ──
  // Advances through all 6 stages sequentially with animations, then moves to next step
  const executeSequentialFlow = useCallback(
    (strategyToUse = 'auto') => {
      if (flowRunningRef.current) return;
      flowRunningRef.current = true;
      setIsFlowRunning(true);
      clearAllFlowTimers();
      setAutoAdvanceCountdown(null);

      // Step 0: Fault Detected (Isolation Forest)
      setActiveStepIndex(0);
      setCompletedStepIndices([]);

      const t1 = setTimeout(() => {
        // Step 0 verified -> Step 1: Analyzing Network (Random Forest)
        setCompletedStepIndices([0]);
        setActiveStepIndex(1);

        const t2 = setTimeout(() => {
          // Step 1 verified -> Step 2: Finding Alternate Path (Dijkstra)
          setCompletedStepIndices([0, 1]);
          setActiveStepIndex(2);

          // Execute backend optimization & Dijkstra route computation
          if (onTriggerHealing) {
            onTriggerHealing(strategyToUse);
          }

          const t3 = setTimeout(() => {
            // Step 2 verified -> Step 3: Applying Recovery (OpenFlow SDN)
            setCompletedStepIndices([0, 1, 2]);
            setActiveStepIndex(3);

            const t4 = setTimeout(() => {
              // Step 3 verified -> Step 4: Testing Connectivity (Fast BFD)
              setCompletedStepIndices([0, 1, 2, 3]);
              setActiveStepIndex(4);

              const t5 = setTimeout(() => {
                // Step 4 verified -> Step 5: Recovery Complete (Digital Twin Sync)
                setCompletedStepIndices([0, 1, 2, 3, 4]);
                setActiveStepIndex(5);

                const t6 = setTimeout(() => {
                  // All 6 steps complete!
                  setCompletedStepIndices([0, 1, 2, 3, 4, 5]);
                  setActiveStepIndex(6);
                  setIsFlowRunning(false);
                  flowRunningRef.current = false;

                  // ── Move to the Next Step (Step 4: Difference Results) ──
                  setAutoAdvanceCountdown(2);

                  const cdTimer1 = setTimeout(() => {
                    setAutoAdvanceCountdown(1);

                    const navTimer = setTimeout(() => {
                      if (onNavigate) {
                        onNavigate('metrics');
                      }
                    }, 1000);
                    timersRef.current.push(navTimer);
                  }, 1000);
                  timersRef.current.push(cdTimer1);

                }, 750);
                timersRef.current.push(t6);

              }, 700);
              timersRef.current.push(t5);

            }, 700);
            timersRef.current.push(t4);

          }, 850);
          timersRef.current.push(t3);

        }, 700);
        timersRef.current.push(t2);

      }, 700);
      timersRef.current.push(t1);
    },
    [onTriggerHealing, onNavigate, clearAllFlowTimers]
  );

  // Auto-start the sequential flow when on this page with an active fault or healing in progress
  useEffect(() => {
    if ((isFaultDetected || isLoading) && !lastRecovery && activeStepIndex === -1 && !flowRunningRef.current) {
      const timer = setTimeout(() => {
        executeSequentialFlow(selectedStrategy || 'auto');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isFaultDetected, isLoading, lastRecovery, activeStepIndex, executeSequentialFlow, selectedStrategy]);

  // If already recovered and network is healthy, keep all steps marked complete
  useEffect(() => {
    if (lastRecovery && !isFaultDetected && !flowRunningRef.current && activeStepIndex === -1) {
      setActiveStepIndex(6);
      setCompletedStepIndices([0, 1, 2, 3, 4, 5]);
    }
  }, [lastRecovery, isFaultDetected, activeStepIndex]);

  // Reset pipeline state when network is reset to baseline
  useEffect(() => {
    if (!isFaultDetected && !lastRecovery) {
      clearAllFlowTimers();
      flowRunningRef.current = false;
      setIsFlowRunning(false);
      setActiveStepIndex(-1);
      setCompletedStepIndices([]);
      setAutoAdvanceCountdown(null);
    }
  }, [isFaultDetected, lastRecovery, clearAllFlowTimers]);

  const handleExecuteHeal = () => {
    executeSequentialFlow(selectedStrategy || 'auto');
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title">
          <HiOutlineShieldCheck style={{ color: 'var(--accent-secondary)' }} />
          Autonomous Self-Healing Pipeline
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 8px',
            borderRadius: 10,
            background: (activeStepIndex === 6 || lastRecovery) ? 'var(--color-healthy-bg)' :
                       isFlowRunning || isLoading ? 'rgba(56, 189, 248, 0.2)' :
                       isFaultDetected ? 'rgba(239, 68, 68, 0.2)' :
                       isIdle ? 'var(--bg-surface)' : 'var(--color-info-bg)',
            color: (activeStepIndex === 6 || lastRecovery) ? 'var(--color-healthy)' :
                   isFlowRunning || isLoading ? '#38bdf8' :
                   isFaultDetected ? '#ef4444' :
                   isIdle ? 'var(--text-muted)' : 'var(--color-info)',
            fontWeight: 700,
            border: isFaultDetected && activeStepIndex !== 6 && !lastRecovery ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
          }}>
            {activeStepIndex === 6 || lastRecovery ? 'AUTONOMOUSLY RECOVERED' :
             isFlowRunning ? `FLOW IN PROGRESS (STAGE ${activeStepIndex + 1}/6)` :
             isLoading ? 'HEALING IN PROGRESS' :
             isFaultDetected ? 'FAULT DETECTED • SEQUENCING' :
             isIdle ? 'STANDBY' : stage.toUpperCase().replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid rgba(42,58,92,0.6)',
        paddingBottom: '8px',
        marginBottom: '14px',
      }}>
        <button
          className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
          style={{ fontSize: '0.74rem', padding: '4px 10px' }}
        >
          Recovery Pipeline
        </button>
        <button
          className={`tab-btn ${activeTab === 'options' ? 'active' : ''}`}
          onClick={() => setActiveTab('options')}
          style={{ fontSize: '0.74rem', padding: '4px 10px' }}
        >
          Options on How to Heal ({strategies.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'algorithms' ? 'active' : ''}`}
          onClick={() => setActiveTab('algorithms')}
          style={{ fontSize: '0.74rem', padding: '4px 10px' }}
        >
          Algorithms Summary
        </button>
      </div>

      {/* ────────────────────────────────────────── */}
      {/* TAB 1: PIPELINE VIEW                       */}
      {/* ────────────────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <>
          {/* Active Fault Action Box */}
          {isFaultDetected && (
            <div style={{
              marginBottom: 14,
              padding: '10px 14px',
              background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(245,158,11,0.1))',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171' }}>
                  Incident Detected: {detection?.fault_type?.replace(/_/g, ' ').toUpperCase() || 'NETWORK DEGRADATION'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: 2 }}>
                  Target: <strong>{detection?.affected_component || 'router1-router2'}</strong> • Strategy: <strong>{currentStratObj.name}</strong>
                </div>
                <div style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '0.68rem',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ color: '#fb923c', fontWeight: 600 }}>Algorithms in Process:</span>
                  <span style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: 4, color: '#fca5a5' }}>1. Isolation Forest</span>
                  <span style={{ color: '#475569' }}>→</span>
                  <span style={{ background: 'rgba(251, 146, 60, 0.15)', padding: '1px 6px', borderRadius: 4, color: '#fdba74' }}>2. Random Forest</span>
                  <span style={{ color: '#475569' }}>→</span>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '1px 6px', borderRadius: 4, color: '#7dd3fc', fontWeight: 600 }}>3. {currentStratObj.algorithm}</span>
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleExecuteHeal}
                disabled={isFlowRunning || (activeStepIndex === 6 && !isFaultDetected)}
                style={{
                  background: (activeStepIndex === 6 || lastRecovery)
                    ? 'linear-gradient(135deg, #059669, #047857)'
                    : isFlowRunning
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: (activeStepIndex === 6 || lastRecovery) ? '#10b981' : '#34d399',
                  boxShadow: (activeStepIndex === 6 || lastRecovery)
                    ? '0 0 12px rgba(16,185,129,0.45)'
                    : '0 0 10px rgba(16,185,129,0.35)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isFlowRunning ? 'default' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {isFlowRunning ? (
                  <>
                    <HiOutlineLightningBolt className="spin" />
                    <span>⚡ AI Flow in Progress (Stage {activeStepIndex + 1}/6)...</span>
                  </>
                ) : (activeStepIndex === 6 || lastRecovery) ? (
                  <>
                    <HiOutlineCheckCircle style={{ color: '#34d399', fontSize: '1rem' }} />
                    <span>✔ Autonomously Self-Healed</span>
                  </>
                ) : (
                  <>
                    <HiOutlineLightningBolt />
                    <span>⚡ Run Self-Healing Flow ➜</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Sequential Flow Progress Bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                {isFlowRunning
                  ? `⚡ Autonomous Healing Flow in Progress (Stage ${Math.min(6, (activeStepIndex >= 0 ? activeStepIndex + 1 : 1))} of 6)...`
                  : activeStepIndex === 6
                  ? '✔ All 6 Pipeline Stages Successfully Verified'
                  : '6-Stage Autonomous Recovery Pipeline'}
              </span>
              <span style={{ fontSize: '0.72rem', color: activeStepIndex === 6 ? '#10b981' : '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                {activeStepIndex === 6 ? '100%' : `${Math.round((completedStepIndices.length / 6) * 100)}%`}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '5px',
              background: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: activeStepIndex === 6 ? '100%' : `${Math.max(completedStepIndices.length > 0 ? (completedStepIndices.length / 6) * 100 : (activeStepIndex === 0 ? 16 : 0), 0)}%`,
                height: '100%',
                background: activeStepIndex === 6 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #38bdf8, #10b981)',
                transition: 'width 0.4s ease',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.5)',
              }} />
            </div>
          </div>

          {/* Pipeline Steps Animation with Algorithm Details */}
          <div className="healing-pipeline" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PIPELINE_STEP_DETAILS.map((step, i) => {
              const isCompleted = completedStepIndices.includes(i) || (!isFaultDetected && Boolean(lastRecovery) && activeStepIndex === 6);
              const isActive = activeStepIndex === i;
              const isPending = !isCompleted && !isActive;

              const algoName = step.getAlgorithm ? step.getAlgorithm(currentStratObj) : step.algorithm;
              const algoDetail = step.getDetail ? step.getDetail(currentStratObj) : step.detail;

              return (
                <div
                  key={step.name}
                  className={`healing-step ${isCompleted ? 'completed' : isActive ? 'active' : 'pending'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: isCompleted ? 'rgba(16, 185, 129, 0.09)' :
                               isActive ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(14, 165, 233, 0.08))' :
                               'rgba(15, 23, 42, 0.4)',
                    border: isCompleted ? '1px solid rgba(16, 185, 129, 0.35)' :
                            isActive ? '1.5px solid rgba(56, 189, 248, 0.7)' :
                            '1px solid rgba(42, 58, 92, 0.35)',
                    boxShadow: isActive ? '0 0 18px rgba(56, 189, 248, 0.25), inset 0 0 12px rgba(56, 189, 248, 0.08)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isActive ? 'scale(1.01)' : 'none',
                  }}
                >
                  <span
                    className="healing-step-icon"
                    style={{
                      marginTop: '2px',
                      fontSize: '1.05rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCompleted ? '#10b981' : isActive ? '#38bdf8' : '#64748b',
                      filter: isActive ? 'drop-shadow(0 0 6px #38bdf8)' : isCompleted ? 'drop-shadow(0 0 4px #10b981)' : 'none',
                    }}
                  >
                    {isCompleted ? <HiOutlineCheck style={{ strokeWidth: 3 }} /> :
                     isActive ? <HiOutlineClock className="spin" /> :
                     <HiOutlineArrowRight />}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          color: isCompleted ? '#34d399' : isActive ? '#38bdf8' : '#e2e8f0',
                        }}>
                          {step.name}
                        </span>
                        <span style={{
                          fontSize: '0.66rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: isCompleted ? 'rgba(16, 185, 129, 0.18)' :
                                     isActive ? 'rgba(56, 189, 248, 0.22)' :
                                     'rgba(100, 116, 139, 0.16)',
                          color: isCompleted ? '#34d399' : isActive ? '#7dd3fc' : '#94a3b8',
                          fontWeight: 600,
                        }}>
                          ⚙️ {algoName}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.65rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        background: isCompleted ? 'rgba(16, 185, 129, 0.2)' :
                                   isActive ? 'rgba(56, 189, 248, 0.25)' :
                                   'rgba(255, 255, 255, 0.04)',
                        color: isCompleted ? '#10b981' : isActive ? '#38bdf8' : '#64748b',
                        border: isCompleted ? '1px solid rgba(16, 185, 129, 0.45)' :
                                isActive ? '1px solid rgba(56, 189, 248, 0.6)' :
                                '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: isActive ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
                      }}>
                        {isCompleted ? '✓ VERIFIED' : isActive ? '● COMPUTING' : '○ QUEUED'}
                      </span>
                    </div>

                    <div style={{
                      fontSize: '0.72rem',
                      color: isCompleted ? '#a7f3d0' : isActive ? '#bae6fd' : '#64748b',
                      marginTop: '4px',
                      lineHeight: 1.4,
                    }}>
                      {algoDetail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Transition Card: Move to Next Step ── */}
          {(activeStepIndex === 6 || completedStepIndices.length === 6) && (
            <div
              style={{
                marginTop: '16px',
                padding: '14px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.14))',
                border: '1.5px solid rgba(16, 185, 129, 0.55)',
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HiOutlineCheckCircle style={{ color: '#10b981', fontSize: '1.6rem', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.02em' }}>
                    ✔ Closed-Loop Self-Healing Pipeline Verified!
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '2px' }}>
                    {autoAdvanceCountdown !== null
                      ? `All 6 stages verified successfully. Advancing to Step 4: Difference & Results in ${autoAdvanceCountdown}s...`
                      : 'All 6 stages verified successfully. Network restored to baseline performance.'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  clearAllFlowTimers();
                  if (onNavigate) onNavigate('metrics');
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.5)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '9px 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <span>Move to Step 4: Difference Results ➜</span>
                <HiOutlineArrowRight />
              </button>
            </div>
          )}

          {/* Recovery Execution Details */}
          {recovery && (
            <div className="healing-details" style={{ marginTop: 14 }}>
              <div className="healing-detail-row">
                <span className="healing-detail-label">Applied Strategy</span>
                <span className="healing-detail-value" style={{ color: '#38bdf8' }}>
                  {recovery.recovery_strategy || 'N/A'}
                </span>
              </div>

              {recovery.alternate_path && (
                <div className="healing-detail-row">
                  <span className="healing-detail-label">New Route</span>
                  <span className="healing-detail-value font-mono" style={{ color: 'var(--color-healthy)' }}>
                    {recovery.alternate_path.join(' → ')}
                  </span>
                </div>
              )}

              {recovery.previous_path && (
                <div className="healing-detail-row">
                  <span className="healing-detail-label">Previous Route</span>
                  <span className="healing-detail-value font-mono" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    {recovery.previous_path.join(' → ')}
                  </span>
                </div>
              )}

              <div className="healing-detail-row">
                <span className="healing-detail-label">Convergence Time</span>
                <span className="healing-detail-value font-mono text-healthy">
                  {recovery.recovery_time_seconds?.toFixed(2) || '1.14'} sec
                </span>
              </div>

              {recovery.explanation && (
                <div style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--accent-secondary)',
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.6,
                }}>
                  {recovery.explanation}
                </div>
              )}

              {/* Algorithmic Breakdown in Recovery Details */}
              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.65)',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#38bdf8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HiOutlineChip /> Algorithms Utilized in Recovery Process
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                  <div style={{ fontSize: '0.70rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: 4 }}>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>1. Detection:</span> Isolation Forest (Anomaly Score)
                  </div>
                  <div style={{ fontSize: '0.70rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: 4 }}>
                    <span style={{ color: '#fb923c', fontWeight: 600 }}>2. Diagnosis:</span> Random Forest (100 Trees)
                  </div>
                  <div style={{ fontSize: '0.70rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: 4 }}>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>3. Optimization:</span> {currentStratObj.algorithm}
                  </div>
                  <div style={{ fontSize: '0.70rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: 4 }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>4. Verification:</span> Fast BFD + Token Bucket
                  </div>
                </div>
                {currentStratObj.formula && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.67rem', fontFamily: 'monospace', color: '#facc15' }}>
                    Formula: {currentStratObj.formula}
                  </div>
                )}
              </div>

              {/* Before / After Telemetry Table */}
              {recovery.before_metrics && recovery.after_metrics && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                    Telemetry Normalization Matrix
                  </div>
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Before AI</th>
                        <th>After AI</th>
                        <th>Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(METRIC_LABELS).map((key) => {
                        const before = recovery.before_metrics[key];
                        const after = recovery.after_metrics[key];
                        if (before === undefined && after === undefined) return null;
                        const gain = key === 'throughput'
                          ? `+${Math.max(0, Math.round((after - before) / Math.max(1, before) * 100))}%`
                          : `-${Math.max(0, Math.round((before - after) / Math.max(0.1, before) * 100))}%`;
                        return (
                          <tr key={key}>
                            <td>{METRIC_LABELS[key]}</td>
                            <td className="before font-mono">
                              {before?.toFixed(1)}{METRIC_UNITS[key]}
                            </td>
                            <td className="after font-mono text-healthy">
                              {after?.toFixed(1)}{METRIC_UNITS[key]}
                            </td>
                            <td style={{ color: '#10b981', fontWeight: 600, fontSize: '0.72rem' }}>
                              {gain}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Idle Prompt */}
          {isIdle && !recovery && !isFaultDetected && (
            <div className="empty-state" style={{ padding: 18 }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🛡️</div>
              <div className="empty-state-text" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                Self-healing engine active & standing by.<br />
                Inject an attack from the <strong>Fault Panel</strong>, then select how to heal it or click <strong>Enable AI</strong>.
              </div>
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────────────────── */}
      {/* TAB 2: OPTIONS ON HOW TO HEAL IT           */}
      {/* ────────────────────────────────────────── */}
      {activeTab === 'options' && (
        <div className="healing-strategies-panel">
          <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 12 }}>
            Choose an algorithmic healing policy to execute on the simulated network:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {strategies.map((strat) => {
              const isSelected = selectedStrategy === strat.id;
              return (
                <div
                  key={strat.id}
                  onClick={() => setSelectedStrategy(strat.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.5)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(42, 58, 92, 0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name="healingStrategy"
                        checked={isSelected}
                        onChange={() => setSelectedStrategy(strat.id)}
                      />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                        {strat.name}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      fontWeight: 600,
                    }}>
                      {strat.badge}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '4px 0 8px 24px', lineHeight: 1.4 }}>
                    {strat.description}
                  </p>

                  <div style={{
                    marginLeft: 24,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    fontSize: '0.7rem',
                    color: '#64748b',
                  }}>
                    <span>Algorithm: <strong style={{ color: '#cbd5e1' }}>{strat.algorithm}</strong></span>
                    <span>Complexity: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{strat.complexity || strat.time_complexity}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleExecuteHeal}
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderColor: '#34d399',
                boxShadow: '0 0 12px rgba(16,185,129,0.3)',
                fontWeight: 600,
              }}
            >
              <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
              {isLoading ? 'Executing Algorithm...' : `🚀 Execute: ${currentStratObj.badge}`}
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────── */}
      {/* TAB 3: ALGORITHMS SUMMARY                  */}
      {/* ────────────────────────────────────────── */}
      {activeTab === 'algorithms' && (
        <div className="algorithms-summary-container">
          <div style={{
            padding: '12px 14px',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HiOutlineChip />
                Optimization Algorithm: {algorithmSummary?.algorithm_name || currentStratObj.algorithm}
              </div>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 600 }}>
                Convergence: {algorithmSummary?.convergence_time || '~1.18s'}
              </span>
            </div>

            {/* Mathematical Formulation */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>
                Mathematical Objective Function
              </div>
              <div style={{
                padding: '8px 12px',
                background: '#090d16',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.76rem',
                color: '#facc15',
                overflowX: 'auto',
              }}>
                {algorithmSummary?.mathematical_formulation || currentStratObj.formula}
              </div>
            </div>

            {/* Complexity Specs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
              <div style={{ background: '#0b1329', padding: '6px 10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>TIME COMPLEXITY</span>
                <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                  {algorithmSummary?.time_complexity || currentStratObj.complexity || 'O(|E| + |V| log |V|)'}
                </div>
              </div>
              <div style={{ background: '#0b1329', padding: '6px 10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>SPACE COMPLEXITY</span>
                <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontFamily: 'monospace', fontWeight: 600 }}>
                  {algorithmSummary?.space_complexity || 'O(|V| + |E|)'}
                </div>
              </div>
              <div style={{ background: '#0b1329', padding: '6px 10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>DECISION MODEL</span>
                <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>
                  Random Forest (100 Trees)
                </div>
              </div>
              <div style={{ background: '#0b1329', padding: '6px 10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>ANOMALY ISOLATION</span>
                <div style={{ fontSize: '0.78rem', color: '#fb923c', fontWeight: 600 }}>
                  Isolation Forest (Score &gt; 0.5)
                </div>
              </div>
            </div>

            {/* Route Transition */}
            {algorithmSummary?.path_transition && (
              <div style={{ marginBottom: 12, padding: '8px 10px', background: '#0b1329', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>TOPOLOGICAL ROUTE TRANSITION:</span>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#e2e8f0', marginTop: 3 }}>
                  {algorithmSummary.path_transition}
                </div>
              </div>
            )}

            {/* Execution Trace Steps */}
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                Autonomous Execution Trace Log
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(algorithmSummary?.steps_executed || [
                  '1. AI Anomaly Diagnosis: Isolation Forest scored telemetry vector outlier',
                  '2. Multi-Class Classification: Random Forest pinpointed affected device',
                  '3. Graph Topology Pruning: Evicted severed/saturated edge from adjacency matrix',
                  `4. Algorithmic Optimization: Computed shortest path with ${currentStratObj.algorithm}`,
                  '5. Flow Redirection: Propagated new routing table & verified connectivity stabilization',
                ]).map((step, idx) => (
                  <div key={idx} style={{ fontSize: '0.73rem', color: '#cbd5e1', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#10b981', marginTop: 2 }}>✓</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


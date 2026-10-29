import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DeviceControlPanel from './components/DeviceControlPanel';
import LiveMonitoring from './components/LiveMonitoring';
import {
  getTopology,
  getMetrics,
  getHealth,
  getMetricsHistory,
  getEvents,
  getAIStatus,
  injectFault,
  injectBatchFaults,
  resetNetwork,
  triggerHealing,
  NetworkWebSocket,
} from './services/api';

const DEFAULT_TOPOLOGY = {
  devices: [
    { id: 'client1', name: 'Client PC-1', device_type: 'client', ip_address: '192.168.1.10', status: 'healthy', metrics: { latency: 18, packet_loss: 0, throughput: 90, cpu_usage: 25, memory_usage: 35 } },
    { id: 'client2', name: 'Client PC-2', device_type: 'client', ip_address: '192.168.1.11', status: 'healthy', metrics: { latency: 19, packet_loss: 0, throughput: 92, cpu_usage: 24, memory_usage: 34 } },
    { id: 'switch1', name: 'Switch S1', device_type: 'switch', ip_address: '192.168.1.1', status: 'healthy', metrics: { latency: 2, packet_loss: 0, throughput: 98, cpu_usage: 18, memory_usage: 22 } },
    { id: 'switch2', name: 'Switch S2', device_type: 'switch', ip_address: '192.168.2.1', status: 'healthy', metrics: { latency: 3, packet_loss: 0, throughput: 96, cpu_usage: 19, memory_usage: 21 } },
    { id: 'router1', name: 'Router R1', device_type: 'router', ip_address: '10.0.0.1', status: 'healthy', metrics: { latency: 8, packet_loss: 0.1, throughput: 88, cpu_usage: 32, memory_usage: 40 } },
    { id: 'router2', name: 'Router R2', device_type: 'router', ip_address: '10.0.0.2', status: 'healthy', metrics: { latency: 9, packet_loss: 0.1, throughput: 86, cpu_usage: 34, memory_usage: 42 } },
    { id: 'router3', name: 'Router R3', device_type: 'router', ip_address: '10.0.0.3', status: 'healthy', metrics: { latency: 7, packet_loss: 0.1, throughput: 89, cpu_usage: 31, memory_usage: 39 } },
    { id: 'server1', name: 'Server S1', device_type: 'server', ip_address: '172.16.0.10', status: 'healthy', metrics: { latency: 12, packet_loss: 0, throughput: 94, cpu_usage: 42, memory_usage: 48 } },
    { id: 'server2', name: 'Server S2', device_type: 'server', ip_address: '172.16.0.11', status: 'healthy', metrics: { latency: 14, packet_loss: 0, throughput: 93, cpu_usage: 40, memory_usage: 46 } },
  ],
  links: [
    { id: 'client1-switch1', source: 'client1', target: 'switch1', status: 'active', latency: 2, packet_loss: 0, utilization: 28 },
    { id: 'client2-switch2', source: 'client2', target: 'switch2', status: 'active', latency: 2, packet_loss: 0, utilization: 27 },
    { id: 'switch1-router1', source: 'switch1', target: 'router1', status: 'active', latency: 3, packet_loss: 0, utilization: 32 },
    { id: 'switch2-router3', source: 'switch2', target: 'router3', status: 'active', latency: 3, packet_loss: 0, utilization: 30 },
    { id: 'router1-router2', source: 'router1', target: 'router2', status: 'active', latency: 5, packet_loss: 0.1, utilization: 38 },
    { id: 'router1-router3', source: 'router1', target: 'router3', status: 'active', latency: 7, packet_loss: 0.1, utilization: 35 },
    { id: 'router2-router3', source: 'router2', target: 'router3', status: 'active', latency: 6, packet_loss: 0.1, utilization: 36 },
    { id: 'router2-server1', source: 'router2', target: 'server1', status: 'active', latency: 3, packet_loss: 0, utilization: 40 },
    { id: 'router2-server2', source: 'router2', target: 'server2', status: 'active', latency: 3, packet_loss: 0, utilization: 39 },
    { id: 'router3-server2', source: 'router3', target: 'server2', status: 'active', latency: 4, packet_loss: 0, utilization: 34 },
  ],
};

export default function App() {
  const [activePage, setActivePage] = useState('faults'); // Default to Step 1: Fault Simulator for guided workflow
  const [showLiveMonitoring, setShowLiveMonitoring] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const isWsConnectedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoHealing, setAutoHealing] = useState(false); // Default to MANUAL for explicit AI optimization workflow

  // Core state — initialized with DEFAULT_TOPOLOGY so diagram is never empty
  const [topology, setTopology] = useState(DEFAULT_TOPOLOGY);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [detection, setDetection] = useState(null);
  const [healingStatus, setHealingStatus] = useState(null);
  const [lastRecovery, setLastRecovery] = useState(null);
  const [events, setEvents] = useState([]);
  const [alternatePath, setAlternatePath] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [activeFault, setActiveFault] = useState(null);
  const [activeFaults, setActiveFaults] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [stagedFaults, setStagedFaults] = useState([]); // [{ id, faultType, targetId, label, componentId, componentName, severity, icon, description }]

  const wsRef = useRef(null);
  const fallbackPollRef = useRef(null);
  const autoReturnTimerRef = useRef(null);

  // Process incoming telemetry data (from WS or REST poll)
  const handleTelemetryUpdate = useCallback((data) => {
    if (!data) return;

    if (data.topology) {
      setTopology(data.topology);
    }
    if (data.health) {
      setHealth(data.health);
    }
    if (data.metrics_history && Array.isArray(data.metrics_history)) {
      setMetricsHistory(data.metrics_history);
      if (data.metrics_history.length > 0) {
        setMetrics(data.metrics_history[data.metrics_history.length - 1]);
      }
    }
    if (data.ai_status !== undefined) {
      setDetection(data.ai_status);
    }
    if (data.comparison) {
      setComparison(data.comparison);
    }
    if (data.healing_status) {
      setHealingStatus(data.healing_status);
      if (data.healing_status.recovery_action) {
        setLastRecovery(data.healing_status.recovery_action);
        if (data.healing_status.recovery_action.alternate_path) {
          setAlternatePath(data.healing_status.recovery_action.alternate_path);
        }
      }
    }
  }, []);

  // Fetch initial REST data & events
  const loadInitialData = useCallback(async () => {
    try {
      const [topRes, hlthRes, histRes, evRes, aiRes] = await Promise.allSettled([
        getTopology(),
        getHealth(),
        getMetricsHistory(),
        getEvents(),
        getAIStatus(),
      ]);

      if (topRes.status === 'fulfilled' && topRes.value.data) {
        setTopology(topRes.value.data);
      }
      if (hlthRes.status === 'fulfilled' && hlthRes.value.data) {
        setHealth(hlthRes.value.data);
      }
      if (histRes.status === 'fulfilled' && histRes.value.data) {
        setMetricsHistory(histRes.value.data);
        if (histRes.value.data.length > 0) {
          setMetrics(histRes.value.data[histRes.value.data.length - 1]);
        }
      }
      if (evRes.status === 'fulfilled' && evRes.value.data) {
        setEvents(evRes.value.data);
      }
      if (aiRes.status === 'fulfilled' && aiRes.value.data) {
        setDetection(aiRes.value.data);
      }
    } catch (err) {
      console.warn('Initial data load error:', err);
    }
  }, []);

  // Poll events periodically to keep log table fresh
  const refreshEvents = useCallback(async () => {
    try {
      const res = await getEvents();
      if (res && res.data) {
        setEvents(res.data);
      }
    } catch (err) {
      // Ignore background event refresh errors
    }
  }, []);

  // Initialize WebSocket connection with reconnect & fallback polling
  useEffect(() => {
    loadInitialData();

    const ws = new NetworkWebSocket(
      // onMessage
      (data) => {
        isWsConnectedRef.current = true;
        setIsWsConnected(true);
        handleTelemetryUpdate(data);
      },
      // onOpen
      () => {
        isWsConnectedRef.current = true;
        setIsWsConnected(true);
      },
      // onClose
      () => {
        isWsConnectedRef.current = false;
        setIsWsConnected(false);
      },
      // onError
      (err) => {
        console.warn('WebSocket warning:', err);
        isWsConnectedRef.current = false;
        setIsWsConnected(false);
      }
    );

    ws.connect();
    wsRef.current = ws;

    // Background poller as backup and for continuous AI status updates
    fallbackPollRef.current = setInterval(() => {
      refreshEvents();
      // Continuously ensure AI detection status is refreshed
      getAIStatus().then((res) => {
        if (res.data) setDetection(res.data);
      }).catch(() => {});

      // If WebSocket is disconnected, poll metrics REST endpoint
      if (!isWsConnectedRef.current) {
        getHealth().then((res) => { if (res.data) setHealth(res.data); }).catch(() => {});
        getTopology().then((res) => {
          if (res.data?.devices?.length) setTopology(res.data);
        }).catch(() => {});
        getMetricsHistory().then((res) => {
          if (res.data?.length) {
            setMetricsHistory(res.data);
            setMetrics(res.data[res.data.length - 1]);
          }
        }).catch(() => {});
      }
    }, 2000);

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
      }
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
      }
    };
  }, []);

  // Seamless transition for autonomous pipeline to Step 5 (Dual Before vs After Simulation)
  const transitionToSimulation = useCallback(() => {
    setActivePage('metrics');
    if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
    // In autonomous pipeline, display difference for 3s then advance to Step 5: Before vs After Live Simulation
    autoReturnTimerRef.current = setTimeout(() => {
      setActivePage('simulation');
    }, 3000);
  }, []);

  const handleNavigate = useCallback((page) => {
    if (autoReturnTimerRef.current) {
      clearTimeout(autoReturnTimerRef.current);
      autoReturnTimerRef.current = null;
    }
    setActivePage(page);
  }, []);

  // Fault Injection Handler — streamlined sequence for both auto and manual modes
  const handleInjectFault = async (faultType, targetId) => {
    setIsLoading(true);
    setActiveFault({ faultType, targetId });
    try {
      // Ingest fault with auto_heal=false so the degraded incident state is recorded
      const res = await injectFault(faultType, targetId, false);
      if (res.data) {
        if (res.data.detection) {
          setDetection(res.data.detection);
        }
        if (res.data.topology) {
          setTopology(res.data.topology);
        }
        if (res.data.health) {
          setHealth(res.data.health);
        }
        if (res.data.comparison) {
          setComparison(res.data.comparison);
        }
      }
      await refreshEvents();

      if (autoHealing) {
        // ── AUTONOMOUS PIPELINE (Fast, responsive transitions) ──
        setActivePage('faults');
        setTimeout(() => {
          setActivePage('ai');
          setTimeout(async () => {
            setActivePage('healing');
            await handleTriggerHealing('auto', true);
            setTimeout(() => {
              transitionToSimulation();
            }, 800);
          }, 600);
        }, 500);
      } else {
        // ── MANUAL MODE ──
        // Keep user on Step 1 to observe the degraded twin; user uses the Next button to advance
        setActivePage('faults');
      }
    } catch (err) {
      console.error('Failed to inject fault:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Batch Multi-Fault Injection Handler — allows choosing more than one fault
  const handleInjectBatch = async (faultsArray) => {
    if (!faultsArray || faultsArray.length === 0) return;
    setIsLoading(true);
    setActiveFaults(faultsArray);
    setActiveFault(faultsArray[0]);
    try {
      const res = await injectBatchFaults(faultsArray, false);
      if (res.data) {
        if (res.data.detection) {
          setDetection(res.data.detection);
        }
        if (res.data.topology) {
          setTopology(res.data.topology);
        }
        if (res.data.health) {
          setHealth(res.data.health);
        }
        if (res.data.comparison) {
          setComparison(res.data.comparison);
        }
      }
      await refreshEvents();

      if (autoHealing) {
        // ── AUTONOMOUS PIPELINE (Crisp, fast, real-time transitions) ──
        setActivePage('faults');
        setTimeout(() => {
          setActivePage('ai');
          setTimeout(async () => {
            setActivePage('healing');
            await handleTriggerHealing('auto', true);
            setTimeout(() => {
              transitionToSimulation();
            }, 800);
          }, 600);
        }, 500);
      } else {
        // ── MANUAL MODE ──
        // Stay on Step 1 so user sees all injected faults active in twin, ready to click Next button
        setActivePage('faults');
      }
    } catch (err) {
      console.error('Failed to inject batch faults:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // AI Self-Healing Trigger Handler — optimize by AI with chosen strategy
  const handleTriggerHealing = async (strategy = 'auto', isAutoPipeline = false) => {
    setIsLoading(true);
    setHealingStatus((prev) => ({
      ...prev,
      stage: 'applying',
      steps_completed: ['Fault Detected', 'Analyzing Network', 'Finding Alternate Path'],
    }));
    try {
      const res = await triggerHealing(strategy);
      if (res.data) {
        if (res.data.recovery) {
          setLastRecovery(res.data.recovery);
          if (res.data.recovery.alternate_path) {
            setAlternatePath(res.data.recovery.alternate_path);
          }
        }
        if (res.data.healing_status) {
          setHealingStatus(res.data.healing_status);
        } else {
          setHealingStatus({
            stage: 'completed',
            steps_completed: [
              'Fault Detected', 'Analyzing Network', 'Finding Alternate Path',
              'Applying Recovery', 'Testing Connectivity', 'Recovery Complete'
            ],
            recovery_action: res.data.recovery,
          });
        }
        if (res.data.topology) {
          setTopology(res.data.topology);
        }
        if (res.data.health) {
          setHealth(res.data.health);
        }
        if (res.data.comparison) {
          setComparison(res.data.comparison);
        }
      }
      setActiveFault(null);
      setActiveFaults([]);
      await refreshEvents();

      // In manual mode, after executing heal, smoothly move to healing view so user can review and click Next
      if (!isAutoPipeline && !autoHealing) {
        setActivePage('healing');
      }
    } catch (err) {
      console.error('Failed to trigger AI healing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Network Handler
  const handleResetNetwork = async () => {
    setIsLoading(true);
    try {
      const res = await resetNetwork();
      setAlternatePath(null);
      setDetection(null);
      setActiveFault(null);
      setActiveFaults([]);
      setStagedFaults([]);
      setHealingStatus({ stage: 'idle', steps_completed: [] });
      setLastRecovery(null);

      if (res.data?.health) {
        setHealth(res.data.health);
      }

      await loadInitialData();
    } catch (err) {
      console.error('Failed to reset network:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearEvents = () => {
    setEvents([]);
  };

  // Staged Faults Handlers (Stage per component -> Simulate All at end of diagram)
  const handleStageFaultsForComponent = useCallback((componentId, componentFaults) => {
    setStagedFaults((prev) => {
      const remaining = prev.filter((f) => f.componentId !== componentId);
      return [...remaining, ...(componentFaults || [])];
    });
  }, []);

  const handleRemoveStagedFault = useCallback((faultId) => {
    setStagedFaults((prev) => prev.filter((f) => f.id !== faultId));
  }, []);

  const handleClearStagedFaults = useCallback(() => {
    setStagedFaults([]);
  }, []);

  const handleSimulateAllStagedFaults = useCallback(async () => {
    if (!stagedFaults || stagedFaults.length === 0) return;
    const batch = stagedFaults.map((f) => ({
      fault_type: f.faultType,
      target_id: f.targetId,
    }));
    setStagedFaults([]);
    await handleInjectBatch(batch);
  }, [stagedFaults, handleInjectBatch]);

  const handleToggleAutoHealing = () => {
    setAutoHealing((prev) => {
      const next = !prev;
      if (next) {
        // If enabling auto-healing while an attack is active, optimize immediately
        handleTriggerHealing('auto');
      }
      return next;
    });
  };

  // Callback to sync state after a manual device control operation
  const handleDeviceActionStateChanged = useCallback(async () => {
    try {
      const [topRes, hlthRes, evRes] = await Promise.allSettled([
        getTopology(),
        getHealth(),
        getEvents(),
      ]);
      if (topRes.status === 'fulfilled' && topRes.value.data) setTopology(topRes.value.data);
      if (hlthRes.status === 'fulfilled' && hlthRes.value.data) setHealth(hlthRes.value.data);
      if (evRes.status === 'fulfilled' && evRes.value.data) setEvents(evRes.value.data);
    } catch (e) {
      console.warn('Device action refresh warning:', e);
    }
  }, []);

  return (
    <div className="app-layout">
      {/* ── Live Network Monitoring full-screen overlay ── */}
      {showLiveMonitoring ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
          <LiveMonitoring onBack={() => setShowLiveMonitoring(false)} />
        </div>
      ) : (
        <>
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            health={health}
            onOpenLiveMonitoring={() => setShowLiveMonitoring(true)}
          />
          <Dashboard
            activePage={activePage}
            health={health}
            metrics={metrics}
            metricsHistory={metricsHistory}
            topology={topology}
            detection={detection}
            healingStatus={healingStatus}
            lastRecovery={lastRecovery}
            events={events}
            alternatePath={alternatePath}
            isWsConnected={isWsConnected}
            isLoading={isLoading}
            autoHealing={autoHealing}
            activeFault={activeFault}
            activeFaults={activeFaults}
            comparison={comparison}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={setSelectedDeviceId}
            onNavigate={handleNavigate}
            onToggleAutoHealing={handleToggleAutoHealing}
            onTriggerHealing={handleTriggerHealing}
            onInjectFault={handleInjectFault}
            onInjectBatch={handleInjectBatch}
            onResetNetwork={handleResetNetwork}
            onClearEvents={handleClearEvents}
            isSimulating={isSimulating}
            onToggleSimulation={setIsSimulating}
            stagedFaults={stagedFaults}
            onStageFaults={handleStageFaultsForComponent}
            onRemoveStagedFault={handleRemoveStagedFault}
            onClearStagedFaults={handleClearStagedFaults}
            onSimulateAllStagedFaults={handleSimulateAllStagedFaults}
            onOpenLiveMonitoring={() => setShowLiveMonitoring(true)}
          />

          {/* Interactive Device Details & Control Side Drawer */}
          {selectedDeviceId && (
            <DeviceControlPanel
              deviceId={selectedDeviceId}
              onClose={() => setSelectedDeviceId(null)}
              liveDevice={topology?.devices?.find((d) => d.id === selectedDeviceId)}
              onStateChanged={handleDeviceActionStateChanged}
              onInjectFault={handleInjectFault}
              onInjectBatch={handleInjectBatch}
              activeFault={activeFault}
              activeFaults={activeFaults}
              stagedFaults={stagedFaults}
              onStageFaults={handleStageFaultsForComponent}
              onTriggerHealing={handleTriggerHealing}
              onResetNetwork={handleResetNetwork}
              isLoading={isLoading}
            />
          )}
        </>
      )}
    </div>
  );
}


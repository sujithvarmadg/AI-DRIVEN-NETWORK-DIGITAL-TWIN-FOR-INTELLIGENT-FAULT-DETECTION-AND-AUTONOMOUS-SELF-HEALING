import React, { useState, useEffect, useCallback } from 'react';
import {
  HiOutlineServer,
  HiOutlineGlobe,
  HiOutlineLightningBolt,
  HiOutlineShieldCheck,
  HiOutlineCheckCircle,
  HiOutlineExclamation,
  HiOutlineRefresh,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineX,
  HiOutlineChip,
  HiOutlinePlay,
  HiOutlineStop,
  HiOutlineSwitchHorizontal,
} from 'react-icons/hi';
import {
  getDeviceDetails,
  controlSwitchPort,
  controlDevicePower,
  getDeviceRoutingTable,
  getDeviceActions,
} from '../services/api';

const STATUS_BADGE = {
  active: { label: 'ACTIVE', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.4)' },
  healthy: { label: 'ACTIVE', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.4)' },
  degraded: { label: 'DEGRADED', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' },
  warning: { label: 'DEGRADED', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' },
  critical: { label: 'DEGRADED', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' },
  failed: { label: 'FAILED / OFF', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' },
  recovering: { label: 'RECOVERING', bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.4)' },
};

const getComponentAttacks = (device, ports = []) => {
  if (!device) return [];
  const devId = device.id;
  const devType = device.device_type;
  const attacks = [];

  // Identify primary uplink/trunk link to prevent repetitive duplicate links
  const primaryPort = ports.find(p => p.link_id && (p.connected_device_id?.startsWith('router') || p.connected_device_id?.startsWith('switch'))) || ports[0];
  const primaryLinkId = primaryPort?.link_id;
  const connectedName = primaryPort?.connected_device_name || 'Uplink Gateway';

  if (devType === 'router') {
    attacks.push({
      id: `${devId}_fail`,
      label: `Routing Engine & Control Plane Crash`,
      icon: '💥',
      faultType: 'router_failure',
      targetId: devId,
      description: `Simulates supervisor engine failure or BGP control-plane crash on ${device.name}. Transit forwarding drops instantly.`,
      severity: 'CRITICAL',
    });
    attacks.push({
      id: `${devId}_congestion`,
      label: `Egress Bufferbloat (Traffic Burst)`,
      icon: '🔥',
      faultType: 'congestion',
      targetId: devId,
      description: `Burst traffic saturates ${device.name} FIFO buffer queues, inducing tail-drop loss and bufferbloat jitter.`,
      severity: 'HIGH',
    });
    attacks.push({
      id: `${devId}_latency`,
      label: `Optical Signal Jitter & Delay Spike (+160ms)`,
      icon: '⏱️',
      faultType: 'high_latency',
      targetId: devId,
      description: `Optical SFP transceiver signal degradation causing serialization delay (+160ms) across ${device.name}.`,
      severity: 'MEDIUM',
    });
  } else if (devType === 'server') {
    attacks.push({
      id: `${devId}_fail`,
      label: `Application Daemon & OS Crash`,
      icon: '🖥️',
      faultType: 'server_failure',
      targetId: devId,
      description: `Backend web/database service daemon crashes or encounters kernel panic. Requires autonomous VRRP/VIP failover.`,
      severity: 'CRITICAL',
    });
    attacks.push({
      id: `${devId}_congestion`,
      label: `Compute & Memory Saturation (99% CPU)`,
      icon: '🔥',
      faultType: 'congestion',
      targetId: devId,
      description: `Memory exhaustion or rogue compute thread locks ${device.name} CPU at 99%, stalling TCP connection handshakes.`,
      severity: 'HIGH',
    });
    attacks.push({
      id: `${devId}_latency`,
      label: `Storage I/O Bottleneck & Query Delay`,
      icon: '⏱️',
      faultType: 'high_latency',
      targetId: devId,
      description: `Disk lock contention on ${device.name} introduces severe application layer response latency (+150ms).`,
      severity: 'MEDIUM',
    });
  } else if (devType === 'switch') {
    if (primaryLinkId) {
      attacks.push({
        id: `${primaryLinkId}_cut`,
        label: `Trunk Uplink Severed (to ${connectedName})`,
        icon: '✂️',
        faultType: 'link_failure',
        targetId: primaryLinkId,
        description: `Physical trunk cable disconnect or transceiver failure between ${device.name} and ${connectedName}.`,
        severity: 'CRITICAL',
      });
    }
    attacks.push({
      id: `${devId}_congestion`,
      label: `Broadcast Storm / MAC Table Flooding`,
      icon: '🌊',
      faultType: 'congestion',
      targetId: devId,
      description: `Layer-2 loop or malicious broadcast flooding overwhelms ${device.name} packet forwarding buffers.`,
      severity: 'HIGH',
    });
    if (primaryLinkId) {
      attacks.push({
        id: `${primaryLinkId}_loss`,
        label: `Port Cyclic Packet Drop (25%)`,
        icon: '📉',
        faultType: 'packet_loss',
        targetId: primaryLinkId,
        description: `Dirty fiber connector or CRC checksum errors causing ~25% packet loss on trunk link to ${connectedName}.`,
        severity: 'MEDIUM',
      });
    }
  } else {
    // client
    if (primaryLinkId) {
      attacks.push({
        id: `${primaryLinkId}_cut`,
        label: `Access Cable Disconnect`,
        icon: '🔌',
        faultType: 'link_failure',
        targetId: primaryLinkId,
        description: `Physical RJ-45 patch cable unplugged or switch access port disabled on ${device.name}.`,
        severity: 'HIGH',
      });
      attacks.push({
        id: `${primaryLinkId}_loss`,
        label: `Damaged Patch Cable Loss (30%)`,
        icon: '📉',
        faultType: 'packet_loss',
        targetId: primaryLinkId,
        description: `Bent copper patch cord or EMI interference causing intermittent 30% drop rate.`,
        severity: 'MEDIUM',
      });
    }
  }

  return attacks;
};

export default function DeviceControlPanel({
  deviceId,
  onClose,
  liveDevice = null,
  onStateChanged = null,
  onInjectFault = null,
  onInjectBatch = null,
  activeFault = null,
  activeFaults = [],
  stagedFaults = [],
  onStageFaults = null,
  onTriggerHealing = null,
  onResetNetwork = null,
  isLoading: isParentLoading = false,
}) {
  const [details, setDetails] = useState(null);
  const [routingTable, setRoutingTable] = useState([]);
  const [actionsHistory, setActionsHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [activeTab, setActiveTab] = useState('attacks'); // Default to 'attacks' for direct component fault selection
  const [selectedAttackIds, setSelectedAttackIds] = useState([]);

  // Initialize selectedAttackIds from any currently staged faults for this device
  useEffect(() => {
    if (stagedFaults && deviceId) {
      const alreadyStaged = stagedFaults
        .filter((sf) => sf.componentId === deviceId)
        .map((sf) => sf.id);
      setSelectedAttackIds(alreadyStaged);
    }
  }, [deviceId, stagedFaults]);

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState(null);
  // { title, message, actionLabel, actionColor, onConfirm }

  // Load device details and routing table
  const fetchDetails = useCallback(async () => {
    if (!deviceId) return;
    setIsLoading(true);
    try {
      const res = await getDeviceDetails(deviceId);
      if (res && res.data) {
        setDetails(res.data);
        if (res.data.routing_table) {
          setRoutingTable(res.data.routing_table);
        }
        if (res.data.recent_actions) {
          setActionsHistory(res.data.recent_actions);
        }
      }
    } catch (err) {
      console.error('Failed to fetch device details:', err);
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to load device details' });
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Keep metrics in sync with live telemetry from WebSocket
  const device = liveDevice || details?.device;
  const devType = device?.device_type || 'device';
  const isPoweredOn = device ? (device.is_powered_on !== false && device.status !== 'failed') : true;
  const operationalStatus = (device?.operational_status || (device?.status === 'failed' ? 'FAILED' : 'ACTIVE')).toLowerCase();
  const statusInfo = STATUS_BADGE[operationalStatus] || STATUS_BADGE.active;

  // Handle Switch Port Toggle
  const handleTogglePort = (port) => {
    const isCurrentlyUp = port.status === 'up';
    const nextAction = isCurrentlyUp ? 'disable' : 'enable';

    if (isCurrentlyUp) {
      // Require confirmation for disabling a port
      setConfirmDialog({
        title: `Disable ${port.name}?`,
        message: `Disabling this port will break link '${port.link_id}' and prevent traffic between ${device.name} and ${port.connected_device_name}. Network routing will be disrupted.`,
        actionLabel: 'Yes, Disable Port',
        actionColor: '#ef4444',
        onConfirm: async () => {
          await executePortControl(port.port_id, nextAction);
        },
      });
    } else {
      executePortControl(port.port_id, nextAction);
    }
  };

  const executePortControl = async (portId, action) => {
    setActionInProgress(`port-${portId}`);
    try {
      const res = await controlSwitchPort(deviceId, portId, action);
      setFeedback({
        type: 'success',
        message: res.data?.message || `Port ${action}d successfully`,
      });
      await fetchDetails();
      if (onStateChanged) onStateChanged();
    } catch (err) {
      console.error('Port control failed:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || `Failed to ${action} port`,
      });
    } finally {
      setActionInProgress(null);
      setConfirmDialog(null);
    }
  };

  // Handle Power Controls (Router / Server / Switch)
  const handlePowerAction = (action) => {
    const isDestructive = action === 'shutdown' || action === 'stop';
    const actionTitle = action === 'shutdown' ? 'Shut Down' : action === 'stop' ? 'Stop' : 'Restart';

    if (isDestructive) {
      setConfirmDialog({
        title: `${actionTitle} ${device.name}?`,
        message: `This will take ${device.name} completely offline. All connected links will fail and the Dijkstra routing engine will immediately exclude this device from routing calculations.`,
        actionLabel: `Yes, ${actionTitle}`,
        actionColor: '#ef4444',
        onConfirm: async () => {
          await executePowerControl(action);
        },
      });
    } else {
      executePowerControl(action);
    }
  };

  const executePowerControl = async (action) => {
    setActionInProgress(`power-${action}`);
    try {
      const res = await controlDevicePower(deviceId, action);
      setFeedback({
        type: 'success',
        message: res.data?.message || `Device ${action} executed successfully`,
      });
      await fetchDetails();
      if (onStateChanged) onStateChanged();
    } catch (err) {
      console.error('Power control failed:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || `Failed to execute ${action}`,
      });
    } finally {
      setActionInProgress(null);
      setConfirmDialog(null);
    }
  };

  if (!device) {
    return (
      <div className="device-drawer-backdrop" onClick={onClose}>
        <div className="device-drawer" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Device Loading...</h3>
            <button className="btn-icon" onClick={onClose}><HiOutlineX /></button>
          </div>
        </div>
      </div>
    );
  }

  const ports = details?.ports || device.ports || [];
  const metrics = device.metrics || {};
  const attacks = getComponentAttacks(device, ports);

  const isDeviceAttacked = Boolean(
    (activeFault && (activeFault.targetId === deviceId || attacks.some((a) => a.targetId === activeFault.targetId))) ||
    (activeFaults && activeFaults.some((f) => (f.target_id === deviceId || f.targetId === deviceId) || attacks.some((a) => a.targetId === (f.target_id || f.targetId)))) ||
    device?.status === 'failed' ||
    device?.operational_status === 'FAILED'
  );

  const handleInjectSingleAttack = async (att) => {
    if (!onInjectFault) return;
    setActionInProgress(`attack-${att.id}`);
    try {
      await onInjectFault(att.faultType, att.targetId);
      setFeedback({ type: 'success', message: `Injected attack '${att.label}' on ${device.name}. AI anomaly detector activated.` });
      if (onStateChanged) onStateChanged();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to inject attack' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleInjectSelectedAttacks = async () => {
    if (selectedAttackIds.length === 0) return;
    const toInject = attacks.filter((a) => selectedAttackIds.includes(a.id)).map((a) => ({
      fault_type: a.faultType,
      target_id: a.targetId,
    }));
    setActionInProgress('batch-attack');
    try {
      if (onInjectBatch && toInject.length > 1) {
        await onInjectBatch(toInject);
        setFeedback({ type: 'success', message: `Injected ${toInject.length} simultaneous attacks on ${device.name}. Network degraded.` });
      } else if (toInject.length === 1 && onInjectFault) {
        await onInjectFault(toInject[0].fault_type, toInject[0].target_id);
        setFeedback({ type: 'success', message: `Injected attack on ${device.name}. Digital Twin active.` });
      }
      if (onStateChanged) onStateChanged();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to inject attacks' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSaveAndExit = () => {
    const selectedFaults = attacks
      .filter((a) => selectedAttackIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        faultType: a.faultType,
        targetId: a.targetId,
        label: a.label,
        componentId: device.id,
        componentName: device.name,
        severity: a.severity,
        icon: a.icon,
        description: a.description,
      }));
    if (onStageFaults) {
      onStageFaults(device.id, selectedFaults);
    }
    if (onClose) {
      onClose(); // "it should go out"
    }
  };

  const renderAttacksSection = () => (
    <div
      className="control-section-card"
      style={{
        border: '1px solid rgba(239, 68, 68, 0.4)',
        background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.06), rgba(15, 23, 42, 0.6))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚡ Component Attacks & Fault Simulator ({attacks.length})
          </h4>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Targeted attacks possible for {device.name}. Select faults and click "Queue Faults & Close Drawer" below.
          </span>
        </div>
        {isDeviceAttacked && (
          <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 700 }}>
            🚨 FAULT ACTIVE ON THIS DEVICE
          </span>
        )}
      </div>

      {/* Multi-attack select bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.7)', padding: '6px 12px', borderRadius: '6px', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 600 }}>
          FAULT SELECT: {selectedAttackIds.length} of {attacks.length} Selected
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedAttackIds(attacks.map((a) => a.id))}
            style={{ fontSize: '0.68rem', padding: '2px 8px' }}
          >
            Select All
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedAttackIds([])}
            style={{ fontSize: '0.68rem', padding: '2px 8px' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Attack cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {attacks.map((att) => {
          const isSelected = selectedAttackIds.includes(att.id);
          const isThisAttackActive = (activeFault?.faultType === att.faultType && (activeFault?.targetId === att.targetId || !activeFault?.targetId)) ||
            (activeFaults && activeFaults.some((f) => (f.fault_type === att.faultType || f.faultType === att.faultType) && (f.target_id === att.targetId || f.targetId === att.targetId)));

          return (
            <div
              key={att.id}
              onClick={() => {
                setSelectedAttackIds((prev) => prev.includes(att.id) ? prev.filter((x) => x !== att.id) : [...prev, att.id]);
              }}
              style={{
                background: isSelected ? 'rgba(239, 68, 68, 0.18)' : isThisAttackActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.8)',
                border: isSelected ? '1.5px solid #ef4444' : isThisAttackActive ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(42, 58, 92, 0.7)',
                borderRadius: '8px',
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ cursor: 'pointer', accentColor: '#ef4444', width: '15px', height: '15px' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? '#fca5a5' : '#f1f5f9' }}>
                    {att.label}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.62rem',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    background: att.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                    color: att.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
                    fontWeight: 700,
                  }}
                >
                  {att.severity}
                </span>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.3' }}>
                {att.description}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                  target: {att.targetId}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInjectSingleAttack(att);
                  }}
                  disabled={actionInProgress !== null}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: isThisAttackActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                  }}
                >
                  {actionInProgress === `attack-${att.id}` ? 'Injecting...' : isThisAttackActive ? 'Active in Twin' : 'Run Single'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Staging Action Bar ("it should go out") */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveAndExit}
            style={{
              flex: 1,
              background: selectedAttackIds.length > 0
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #334155, #1e293b)',
              borderColor: selectedAttackIds.length > 0 ? '#f87171' : 'rgba(148, 163, 184, 0.3)',
              boxShadow: selectedAttackIds.length > 0 ? '0 0 18px rgba(239, 68, 68, 0.45)' : 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              padding: '10px 16px',
              justifyContent: 'center',
            }}
          >
            <HiOutlineCheckCircle style={{ fontSize: '1.15rem' }} />
            {selectedAttackIds.length > 0
              ? `✔ Queue ${selectedAttackIds.length} Selected Fault${selectedAttackIds.length > 1 ? 's' : ''} & Close Drawer ➜`
              : 'Close Drawer (Keep Faults as Is)'}
          </button>

          {selectedAttackIds.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedAttackIds([]);
                if (onStageFaults) onStageFaults(device.id, []);
              }}
              style={{ fontSize: '0.78rem', padding: '10px 14px' }}
              title="Clear staged faults for this device"
            >
              Clear
            </button>
          )}
        </div>

        {/* Optional immediate run button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', border: '1px solid rgba(42, 58, 92, 0.5)' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Want immediate injection on {device.name}?
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleInjectSelectedAttacks}
            disabled={actionInProgress !== null || selectedAttackIds.length === 0}
            style={{ fontSize: '0.7rem', padding: '4px 10px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          >
            ⚡ Inject Right Now
          </button>
        </div>

        {isDeviceAttacked && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (onTriggerHealing) onTriggerHealing('auto');
            }}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderColor: '#34d399',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '8px 14px',
              marginTop: '4px',
            }}
          >
            ⚡ Enable AI & Optimize Network ➜
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="device-drawer-backdrop" onClick={handleSaveAndExit}>
      <div className="device-drawer" onClick={(e) => e.stopPropagation()}>
        {/* ── Top Header ── */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                background:
                  devType === 'router' ? 'rgba(59, 130, 246, 0.2)' :
                  devType === 'switch' ? 'rgba(139, 92, 246, 0.2)' :
                  devType === 'server' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color:
                  devType === 'router' ? '#60a5fa' :
                  devType === 'switch' ? '#c084fc' :
                  devType === 'server' ? '#34d399' : '#fbbf24',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {devType === 'router' ? <HiOutlineGlobe /> :
               devType === 'switch' ? <HiOutlineSwitchHorizontal /> :
               devType === 'server' ? <HiOutlineServer /> : <HiOutlineChip />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}>
                  {device.name}
                </h2>
                <span
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#94a3b8',
                  }}
                >
                  {device.id}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: statusInfo.bg,
                    color: statusInfo.color,
                    border: `1px solid ${statusInfo.border}`,
                  }}
                >
                  ● {statusInfo.label}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                IP: <strong style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{device.ip_address}</strong> · Type: <span style={{ textTransform: 'capitalize' }}>{devType}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchDetails}
              disabled={isLoading}
              title="Refresh device state"
            >
              <HiOutlineRefresh className={isLoading ? 'spin' : ''} />
            </button>
            <button className="btn-icon" onClick={handleSaveAndExit} title="Save faults and close drawer">
              <HiOutlineX />
            </button>
          </div>
        </div>

        {/* ── Feedback Notification Alert ── */}
        {feedback && (
          <div
            style={{
              margin: '12px 20px 0',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: feedback.type === 'success' ? '#34d399' : '#f87171',
            }}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Quick KPI Metrics Row ── */}
        <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          <div className="mini-metric-box">
            <span className="mini-metric-label">CPU Usage</span>
            <span className="mini-metric-val" style={{ color: metrics.cpu_usage > 75 ? '#ef4444' : '#38bdf8' }}>
              {metrics.cpu_usage?.toFixed(1) || '0.0'}%
            </span>
          </div>
          <div className="mini-metric-box">
            <span className="mini-metric-label">Memory</span>
            <span className="mini-metric-val" style={{ color: metrics.memory_usage > 80 ? '#ef4444' : '#a78bfa' }}>
              {metrics.memory_usage?.toFixed(1) || '0.0'}%
            </span>
          </div>
          <div className="mini-metric-box">
            <span className="mini-metric-label">Latency</span>
            <span className="mini-metric-val" style={{ color: metrics.latency > 50 ? '#ef4444' : '#34d399' }}>
              {metrics.latency?.toFixed(1) || '0.0'} ms
            </span>
          </div>
          <div className="mini-metric-box">
            <span className="mini-metric-label">Packet Loss</span>
            <span className="mini-metric-val" style={{ color: metrics.packet_loss > 5 ? '#ef4444' : '#34d399' }}>
              {metrics.packet_loss?.toFixed(2) || '0.0'}%
            </span>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="drawer-tabs">
          <button
            className={`drawer-tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
            onClick={() => setActiveTab('controls')}
          >
            🎮 Device Controls & Ports
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'attacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('attacks')}
            style={{ color: activeTab === 'attacks' ? '#f87171' : 'inherit' }}
          >
            ⚡ Component Attacks ({attacks.length})
          </button>
          {devType === 'router' && (
            <button
              className={`drawer-tab-btn ${activeTab === 'routing' ? 'active' : ''}`}
              onClick={() => setActiveTab('routing')}
            >
              🗺️ Routing Table ({routingTable.length})
            </button>
          )}
          <button
            className={`drawer-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📜 Action Audit Log ({actionsHistory.length})
          </button>
        </div>

        {/* ── TAB 1: DEVICE CONTROLS & INTERFACES ── */}
        {activeTab === 'controls' && (
          <div className="drawer-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Power Controls Section for Router and Server */}
            {(devType === 'router' || devType === 'server') && (
              <div className="control-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                      ⚡ Device Power State Controls
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Shutting down removes device from routing topology; restarting restores operational capacity.
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isPoweredOn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: isPoweredOn ? '#34d399' : '#f87171',
                    }}
                  >
                    {isPoweredOn ? 'POWERED ON' : 'POWERED OFF'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {devType === 'router' && (
                    <>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePowerAction('shutdown')}
                        disabled={!isPoweredOn || actionInProgress !== null}
                        style={{
                          background: isPoweredOn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: isPoweredOn ? '#f87171' : '#64748b',
                          cursor: isPoweredOn ? 'pointer' : 'not-allowed',
                          fontWeight: 600,
                          flex: 1,
                        }}
                      >
                        <HiOutlineStop />
                        {actionInProgress === 'power-shutdown' ? 'Shutting down...' : 'Shut Down Router'}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePowerAction('restart')}
                        disabled={isPoweredOn || actionInProgress !== null}
                        style={{
                          background: !isPoweredOn ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                          border: !isPoweredOn ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
                          color: !isPoweredOn ? '#fff' : '#64748b',
                          cursor: !isPoweredOn ? 'pointer' : 'not-allowed',
                          fontWeight: 600,
                          flex: 1,
                        }}
                      >
                        <HiOutlinePlay />
                        {actionInProgress === 'power-restart' ? 'Restarting...' : 'Restart Router'}
                      </button>
                    </>
                  )}

                  {devType === 'server' && (
                    <>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePowerAction('stop')}
                        disabled={!isPoweredOn || actionInProgress !== null}
                        style={{
                          background: isPoweredOn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: isPoweredOn ? '#f87171' : '#64748b',
                          cursor: isPoweredOn ? 'pointer' : 'not-allowed',
                          fontWeight: 600,
                          flex: 1,
                        }}
                      >
                        <HiOutlineStop />
                        {actionInProgress === 'power-stop' ? 'Stopping...' : 'Stop Server'}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePowerAction('restart')}
                        disabled={isPoweredOn || actionInProgress !== null}
                        style={{
                          background: !isPoweredOn ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                          border: !isPoweredOn ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
                          color: !isPoweredOn ? '#fff' : '#64748b',
                          cursor: !isPoweredOn ? 'pointer' : 'not-allowed',
                          fontWeight: 600,
                          flex: 1,
                        }}
                      >
                        <HiOutlinePlay />
                        {actionInProgress === 'power-restart' ? 'Restarting...' : 'Restart Server'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Component Attacks Section */}
            {renderAttacksSection()}

            {/* Ports & Interfaces Section */}
            <div className="control-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                    🔌 Network Interfaces & Ports ({ports.length})
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {devType === 'switch'
                      ? 'Toggle individual switch ports. Disabling a port drops link traffic immediately.'
                      : 'Physical and logical interfaces connected to adjacent network devices.'}
                  </span>
                </div>
                {devType === 'switch' && (
                  <span style={{ fontSize: '0.68rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px' }}>
                    Interactive Port Toggling
                  </span>
                )}
              </div>

              {ports.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '16px', textAlign: 'center' }}>
                  No physical ports registered for this device.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="drawer-table">
                    <thead>
                      <tr>
                        <th>PORT / INTERFACE</th>
                        <th>CONNECTED PEER</th>
                        <th>LINK ID</th>
                        <th>SPEED</th>
                        <th>STATE</th>
                        {devType === 'switch' && <th style={{ textAlign: 'right' }}>ACTION</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((port) => {
                        const isUp = port.status === 'up';
                        const isPortLoading = actionInProgress === `port-${port.port_id}`;

                        return (
                          <tr key={port.port_id}>
                            <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                              <div>{port.name}</div>
                              <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                                {port.port_id}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#38bdf8', fontWeight: 500 }}>
                                {port.connected_device_name}
                              </span>
                              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                ID: {port.connected_device_id}
                              </div>
                            </td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#94a3b8' }}>
                              {port.link_id}
                            </td>
                            <td style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                              {port.speed_mbps} Mbps
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: isUp ? '#34d399' : '#f87171',
                                  border: `1px solid ${isUp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                }}
                              >
                                {isUp ? '● UP' : '✕ DOWN'}
                              </span>
                            </td>
                            {devType === 'switch' && (
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className={`btn btn-sm ${isUp ? 'btn-danger' : 'btn-primary'}`}
                                  onClick={() => handleTogglePort(port)}
                                  disabled={actionInProgress !== null}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: isUp ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
                                    borderColor: isUp ? 'rgba(239, 68, 68, 0.4)' : '#34d399',
                                    color: isUp ? '#f87171' : '#fff',
                                  }}
                                >
                                  {isPortLoading ? 'Updating...' : isUp ? 'Disable Port' : 'Enable Port'}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Connected Links Summary */}
            <div className="control-section-card">
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                🔗 Active Links Connected ({details?.connected_links?.length || 0})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {(details?.connected_links || []).map((link) => (
                  <div
                    key={link.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{link.id}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Latency: {link.latency?.toFixed(1)}ms · Loss: {link.packet_loss?.toFixed(1)}%
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: link.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: link.status === 'active' ? '#34d399' : '#f87171',
                        fontWeight: 700,
                      }}
                    >
                      {link.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: COMPONENT ATTACKS ONLY ── */}
        {activeTab === 'attacks' && (
          <div className="drawer-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {renderAttacksSection()}
          </div>
        )}

        {/* ── TAB 2: ROUTING TABLE (FOR ROUTERS) ── */}
        {activeTab === 'routing' && devType === 'router' && (
          <div className="drawer-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', fontWeight: 700 }}>
                  Dynamic Dijkstra Routing Table
                </h4>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                  Authoritative routing state computed dynamically by composite Dijkstra shortest path algorithm.
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                {isPoweredOn ? '● Routing Engine Active' : '✕ Router Shut Down'}
              </span>
            </div>

            {!isPoweredOn ? (
              <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', textAlign: 'center', color: '#f87171' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Router is Powered Off</div>
                <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                  Routing table is inactive. Restart this router to recalculate active paths.
                </div>
              </div>
            ) : routingTable.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                Computing routes...
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="drawer-table">
                  <thead>
                    <tr>
                      <th>DESTINATION</th>
                      <th>IP ADDRESS</th>
                      <th>NEXT HOP</th>
                      <th>EGRESS INTERFACE</th>
                      <th>PATH COST</th>
                      <th>HOPS</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routingTable.map((route) => {
                      const isUnreachable = route.status === 'UNREACHABLE';

                      return (
                        <tr key={route.destination_id} style={{ opacity: isUnreachable ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                            <div>{route.destination_name}</div>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              ID: {route.destination_id}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                            {route.destination_ip}
                          </td>
                          <td style={{ color: isUnreachable ? '#ef4444' : '#38bdf8', fontWeight: 600 }}>
                            {route.next_hop_name || 'None (Drop)'}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                            {route.interface || '—'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#a78bfa' }}>
                            {route.path_cost !== null ? route.path_cost.toFixed(2) : '∞'}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                            {route.hops}
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background:
                                  route.status === 'DIRECT' ? 'rgba(56, 189, 248, 0.15)' :
                                  route.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' :
                                  'rgba(239, 68, 68, 0.15)',
                                color:
                                  route.status === 'DIRECT' ? '#38bdf8' :
                                  route.status === 'ACTIVE' ? '#34d399' :
                                  '#f87171',
                              }}
                            >
                              {route.status}
                            </span>
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

        {/* ── TAB 3: ACTION HISTORY AUDIT LOG ── */}
        {activeTab === 'history' && (
          <div className="drawer-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', fontWeight: 700 }}>
                  Device Control Action Audit History
                </h4>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                  Persistent SQLite audit records of all manual interventions, port toggles, and state transitions.
                </div>
              </div>
            </div>

            {actionsHistory.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No recorded actions yet for this device. Use the controls tab to execute actions.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="drawer-table">
                  <thead>
                    <tr>
                      <th>TIMESTAMP</th>
                      <th>ACTION</th>
                      <th>TARGET</th>
                      <th>PREVIOUS STATE</th>
                      <th>NEW STATE</th>
                      <th>OUTCOME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionsHistory.map((act) => (
                      <tr key={act.action_id || act.id}>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#94a3b8' }}>
                          {act.timestamp?.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                          {act.action?.replace('_', ' ').toUpperCase()}
                        </td>
                        <td style={{ color: '#38bdf8', fontSize: '0.78rem' }}>
                          {act.target_component || act.device_name}
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          {act.previous_state}
                        </td>
                        <td style={{ color: '#34d399', fontWeight: 600, fontSize: '0.75rem' }}>
                          {act.new_state}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: act.outcome === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: act.outcome === 'SUCCESS' ? '#34d399' : '#f87171',
                            }}
                          >
                            {act.outcome}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Confirmation Modal Dialog ── */}
        {confirmDialog && (
          <div className="modal-backdrop" onClick={() => setConfirmDialog(null)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ color: '#f59e0b', fontSize: '1.4rem' }}>
                  <HiOutlineExclamation />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 700 }}>
                  {confirmDialog.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 18px 0' }}>
                {confirmDialog.message}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setConfirmDialog(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm"
                  onClick={confirmDialog.onConfirm}
                  style={{
                    background: confirmDialog.actionColor || '#ef4444',
                    borderColor: confirmDialog.actionColor || '#ef4444',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {confirmDialog.actionLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

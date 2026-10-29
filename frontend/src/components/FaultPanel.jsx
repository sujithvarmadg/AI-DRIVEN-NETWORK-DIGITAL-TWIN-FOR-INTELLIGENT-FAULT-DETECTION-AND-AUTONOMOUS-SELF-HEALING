import React, { useState } from 'react';
import {
  HiOutlineLightningBolt, HiOutlineRefresh,
  HiOutlineExclamation, HiOutlineStatusOffline,
  HiOutlineServer, HiOutlineSwitchHorizontal,
  HiOutlineCheck, HiOutlineCheckCircle, HiOutlinePlay
} from 'react-icons/hi';

/**
 * FaultPanel — interactive Fault Simulator supporting single or multi-fault selection.
 * Users can pick multiple simultaneous faults and inject them together into the digital twin.
 */

const FAULT_DEFINITIONS = [
  {
    id: 'link_failure',
    label: 'Fail Link R1-R2',
    icon: <HiOutlineSwitchHorizontal />,
    faultType: 'link_failure',
    targetId: 'router1-router2',
    description: 'Disconnect the physical link between Router R1 and Router R2',
    severity: 'CRITICAL',
  },
  {
    id: 'router_failure',
    label: 'Fail Router R2',
    icon: <HiOutlineStatusOffline />,
    faultType: 'router_failure',
    targetId: 'router2',
    description: 'Force core Router R2 offline to sever transit routes',
    severity: 'CRITICAL',
  },
  {
    id: 'high_latency',
    label: 'Increase Latency',
    icon: <HiOutlineLightningBolt />,
    faultType: 'high_latency',
    targetId: 'router2',
    description: 'Inject propagation jitter and latency spike (+180ms) on Router R2',
    severity: 'HIGH',
  },
  {
    id: 'packet_loss',
    label: 'Inject Packet Loss',
    icon: <HiOutlineExclamation />,
    faultType: 'packet_loss',
    targetId: 'router1-router2',
    description: 'Simulate physical interference causing ~25% packet drop on R1-R2',
    severity: 'HIGH',
  },
  {
    id: 'congestion',
    label: 'Network Congestion',
    icon: <HiOutlineLightningBolt />,
    faultType: 'congestion',
    targetId: 'router2',
    description: 'Overload Router R2 with burst traffic causing bufferbloat',
    severity: 'HIGH',
  },
  {
    id: 'server_failure',
    label: 'Fail Server S1',
    icon: <HiOutlineServer />,
    faultType: 'server_failure',
    targetId: 'server1',
    description: 'Crash Server S1 daemon to trigger backend service outage',
    severity: 'CRITICAL',
  },
];

export default function FaultPanel({
  onInjectFault,
  onInjectBatch,
  onReset,
  isLoading,
  activeFault,
  activeFaults = [],
  onTriggerHealing,
  autoHealing,
  detection,
  onNavigate,
}) {
  // Multiple fault selection state: array of fault IDs
  const [selectedFaultIds, setSelectedFaultIds] = useState(['link_failure']);

  // Toggle selection for a fault
  const handleToggleSelect = (faultId) => {
    setSelectedFaultIds((prev) => {
      if (prev.includes(faultId)) {
        return prev.filter((id) => id !== faultId);
      } else {
        return [...prev, faultId];
      }
    });
  };

  // Select all faults
  const handleSelectAll = () => {
    setSelectedFaultIds(FAULT_DEFINITIONS.map((f) => f.id));
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedFaultIds([]);
  };

  // Inject currently selected faults
  const handleInjectSelected = () => {
    if (selectedFaultIds.length === 0) return;

    const faultsToInject = FAULT_DEFINITIONS.filter((f) =>
      selectedFaultIds.includes(f.id)
    ).map((f) => ({
      fault_type: f.faultType,
      target_id: f.targetId,
    }));

    if (onInjectBatch && faultsToInject.length > 1) {
      onInjectBatch(faultsToInject);
    } else if (faultsToInject.length === 1) {
      onInjectFault(faultsToInject[0].fault_type, faultsToInject[0].target_id);
    }
  };

  // Quick single injection
  const handleQuickInjectSingle = (fault, e) => {
    e.stopPropagation();
    onInjectFault(fault.faultType, fault.targetId);
  };

  // Determine if network is currently in degraded state
  const isDegraded = Boolean(
    activeFault || (activeFaults && activeFaults.length > 0) || detection?.anomaly_detected
  );

  // List of active fault labels
  const activeFaultNames = FAULT_DEFINITIONS.filter((f) =>
    activeFault?.faultType === f.faultType ||
    (activeFaults && activeFaults.some((af) => af.fault_type === f.faultType || af.faultType === f.faultType)) ||
    detection?.fault_type === f.faultType
  ).map((f) => f.label);

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.98rem' }}>
          <HiOutlineExclamation style={{ color: isDegraded ? '#ef4444' : '#38bdf8', fontSize: '1.2rem' }} />
          <span>Fault Simulator</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            borderRadius: 12,
            background: isDegraded ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)',
            color: isDegraded ? '#ef4444' : '#10b981',
            fontWeight: 700,
            border: isDegraded ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(16,185,129,0.3)',
          }}>
            {isDegraded ? `⚠️ ${activeFaultNames.length || 1} FAULT${(activeFaultNames.length || 1) > 1 ? 'S' : ''} ACTIVE` : 'READY TO INJECT'}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Auto: <strong style={{ color: autoHealing ? '#10b981' : '#38bdf8' }}>{autoHealing ? 'ON' : 'MANUAL'}</strong>
          </span>
        </div>
      </div>

      {/* Active Faults Banner */}
      {isDegraded && (
        <div style={{
          margin: '0 0 16px 0',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(245,158,11,0.10))',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#f87171', fontSize: '0.85rem' }}>
              <span className="status-dot critical" style={{ width: 8, height: 8 }}></span>
              Faults Active in Digital Twin ({activeFaultNames.length || 1}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {(activeFaultNames.length > 0 ? activeFaultNames : [detection?.fault_type?.replace(/_/g, ' ') || 'Network Fault']).map((name, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                  }}
                >
                  ⚡ {name}
                </span>
              ))}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '6px' }}>
              Affected: <strong>{detection?.affected_component || 'router1-router2, router2'}</strong> • Telemetry degraded
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onTriggerHealing && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onTriggerHealing('auto')}
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 12px rgba(16,185,129,0.35)',
                  fontWeight: 600,
                  justifyContent: 'center',
                }}
              >
                <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
                {isLoading ? 'Self-Healing...' : '⚡ Enable AI & Optimize Network'}
              </button>
            )}
            {onNavigate && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('ai')}
                style={{ fontSize: '0.78rem' }}
              >
                Review AI Action Plan ➜
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-Selection Control Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: 'rgba(15, 23, 42, 0.7)',
        borderRadius: '6px',
        border: '1px solid var(--border-primary)',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            MULTI-FAULT SELECT:
          </span>
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '4px',
            background: selectedFaultIds.length > 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(100, 116, 139, 0.2)',
            color: selectedFaultIds.length > 0 ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 700,
          }}>
            {selectedFaultIds.length} of {FAULT_DEFINITIONS.length} Selected
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleSelectAll}
            style={{
              background: 'transparent',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearSelection}
            style={{
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: 'var(--text-muted)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Grid of Selectable Fault Cards */}
      <div className="fault-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {FAULT_DEFINITIONS.map((fault) => {
          const isSelected = selectedFaultIds.includes(fault.id);
          const isCurrentlyActive =
            activeFault?.faultType === fault.faultType ||
            (activeFaults && activeFaults.some((af) => af.fault_type === fault.faultType || af.faultType === fault.faultType)) ||
            detection?.fault_type === fault.faultType;

          return (
            <div
              key={fault.id}
              onClick={() => handleToggleSelect(fault.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: isSelected
                  ? '1px solid #38bdf8'
                  : isCurrentlyActive
                  ? '1px solid #ef4444'
                  : '1px solid var(--border-secondary)',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(15, 23, 42, 0.8))'
                  : isCurrentlyActive
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: isSelected
                  ? '0 0 12px rgba(56, 189, 248, 0.3)'
                  : isCurrentlyActive
                  ? '0 0 10px rgba(239, 68, 68, 0.3)'
                  : 'none',
              }}
              title={fault.description}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Custom Checkbox indicator */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.5)',
                      background: isSelected ? '#38bdf8' : 'rgba(15, 23, 42, 0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0f172a',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <HiOutlineCheck />}
                  </div>

                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? '#f8fafc' : 'var(--text-primary)' }}>
                    {fault.label}
                  </span>
                </div>

                <span style={{ color: isSelected ? '#38bdf8' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {fault.icon}
                </span>
              </div>

              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.3 }}>
                {fault.description}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: isCurrentlyActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                  color: isCurrentlyActive ? '#f87171' : 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {isCurrentlyActive ? 'ACTIVE IN TWIN' : fault.targetId}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleQuickInjectSingle(fault, e)}
                  disabled={isLoading}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Inject only this single fault immediately"
                >
                  <HiOutlinePlay style={{ fontSize: '0.65rem' }} />
                  Run Single
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Simultaneous Batch Injection Button */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleInjectSelected}
          disabled={isLoading || selectedFaultIds.length === 0}
          style={{
            width: '100%',
            background: selectedFaultIds.length > 0
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'rgba(51, 65, 85, 0.5)',
            borderColor: selectedFaultIds.length > 0 ? '#f87171' : 'rgba(148, 163, 184, 0.2)',
            boxShadow: selectedFaultIds.length > 0 ? '0 0 16px rgba(239, 68, 68, 0.4)' : 'none',
            fontWeight: 700,
            fontSize: '0.86rem',
            padding: '10px 16px',
            justifyContent: 'center',
            cursor: selectedFaultIds.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
          {isLoading
            ? 'Injecting Fault Simulation...'
            : selectedFaultIds.length === 0
            ? 'Select One or More Faults Above'
            : selectedFaultIds.length === 1
            ? `⚡ Inject Selected Fault: ${FAULT_DEFINITIONS.find(f => f.id === selectedFaultIds[0])?.label} ➜`
            : `⚡ Inject ${selectedFaultIds.length} Selected Faults Simultaneously ➜`}
        </button>
      </div>

      {/* Reset Network Button */}
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setSelectedFaultIds([]);
            onReset();
          }}
          disabled={isLoading}
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '0.8rem',
            padding: '7px 12px',
          }}
          title="Reset network to initial healthy state"
        >
          <HiOutlineRefresh className={isLoading ? 'spin' : ''} />
          Reset Network to Baseline
        </button>
      </div>

      {/* Workflow Explanation Footer */}
      <div style={{
        marginTop: 12,
        padding: '8px 12px',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.74rem',
        color: 'var(--text-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <span>Workflow: 1. Select 1 or more faults ➔ 2. Inject simultaneously ➔ 3. AI analyzes & self-heals</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Multi-fault simulator synced
        </span>
      </div>
    </div>
  );
}

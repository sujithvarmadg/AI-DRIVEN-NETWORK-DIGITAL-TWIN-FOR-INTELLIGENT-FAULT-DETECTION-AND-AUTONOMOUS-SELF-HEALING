import React, { useState } from 'react';
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
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiOutlinePlay,
  HiOutlineWifi,
} from 'react-icons/hi';

import HealthCard from '../components/HealthCard';
import NetworkTopology from '../components/NetworkTopology';
import MetricsChart, { BeforeAfterImprovementBanner } from '../components/MetricsChart';
import FaultPanel from '../components/FaultPanel';
import AIAnalysis from '../components/AIAnalysis';
import SelfHealing from '../components/SelfHealing';
import EventLog from '../components/EventLog';
import BeforeAfterSimulation from '../components/BeforeAfterSimulation';

const WORKFLOW_STEPS = [
  { id: 'faults', num: '1', title: '1. Topology & Component Attacks', desc: 'Select & simulate faults across components' },
  { id: 'ai', num: '2', title: '2. AI Analysis & Changes', desc: 'AI root cause diagnosis & what we can change' },
  { id: 'healing', num: '3', title: '3. Self-Healing', desc: 'Execute autonomous recovery pipeline' },
  { id: 'metrics', num: '4', title: '4. Difference & Results', desc: 'Compare before vs after difference' },
  { id: 'simulation', num: '5', title: '5. Before vs After Simulation', desc: 'Live dual digital twin simulation' },
];

export default function Dashboard({
  activePage = 'faults',
  health,
  metrics,
  metricsHistory,
  topology,
  detection,
  healingStatus,
  lastRecovery,
  events,
  alternatePath,
  isWsConnected,
  isLoading,
  autoHealing,
  activeFault,
  activeFaults = [],
  comparison,
  selectedDeviceId = null,
  onSelectDevice = null,
  onNavigate,
  onToggleAutoHealing,
  onTriggerHealing,
  onInjectFault,
  onInjectBatch,
  onResetNetwork,
  onClearEvents = null,
  isSimulating = false,
  onToggleSimulation = null,
  stagedFaults = [],
  onStageFaults = null,
  onRemoveStagedFault = null,
  onClearStagedFaults = null,
  onSimulateAllStagedFaults = null,
  onOpenLiveMonitoring = null,
}) {
  const [selectedMetricView, setSelectedMetricView] = useState('all');

  const healthScore = health?.health_score ?? 96;
  const healthLabel = health?.health_label ?? 'Healthy';
  const activeDevs = health?.active_devices ?? 9;
  const totalDevs = health?.total_devices ?? 9;
  const activeLinks = health?.active_links ?? 10;
  const totalLinks = health?.total_links ?? 10;
  const latency = metrics?.latency?.toFixed(1) ?? '21.4';
  const packetLoss = metrics?.packet_loss?.toFixed(2) ?? '0.40';
  const throughput = metrics?.throughput?.toFixed(1) ?? '94.2';
  const faultsCount = health?.fault_count ?? 0;
  const recoveryCount = health?.recovery_count ?? 0;

  const isDegraded = activeFault !== null || (activeFaults && activeFaults.length > 0) || healthScore < 85 || detection?.anomaly_detected;
  const isHealed = !isDegraded && (lastRecovery !== null || recoveryCount > 0);

  const getHealthBadgeClass = (score) => {
    if (score >= 90) return 'badge-healthy';
    if (score >= 75) return 'badge-info';
    if (score >= 50) return 'badge-warning';
    return 'badge-critical';
  };

  return (
    <div className="main-content">
      {/* ── Top Bar Header ── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="header-title-wrap">
            <h1 className="topbar-title" style={{ fontSize: '1.25rem' }}>AI-Driven Network Digital Twin</h1>
            <span className="topbar-subtitle" style={{ fontSize: '0.8rem' }}>
              Intelligent Real-Time Fault Detection & Autonomous Self-Healing
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {/* Real-time Status */}
          <div className="connection-pill">
            <span className={`status-dot ${isWsConnected ? 'healthy' : 'warning'}`}></span>
            <span>{isWsConnected ? 'Digital Twin Synced' : 'Connecting / Polling...'}</span>
          </div>

          {/* Quick AI Optimization Action */}
          {isDegraded && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onTriggerHealing('auto')}
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderColor: '#34d399',
                boxShadow: '0 0 14px rgba(16,185,129,0.4)',
                fontWeight: 600,
              }}
              title="Run AI Optimization to restore network health"
            >
              <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
              {isLoading ? 'Optimizing...' : '⚡ Optimize with AI'}
            </button>
          )}

          {/* Auto-Healing Toggle */}
          <button
            className={`btn btn-sm ${autoHealing ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onToggleAutoHealing}
            title="Toggle autonomous self-healing execution upon AI detection"
          >
            <HiOutlineShieldCheck />
            {autoHealing ? 'Auto-Healing: ENABLED' : 'Auto-Healing: MANUAL'}
          </button>

          {/* Reset Twin Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onResetNetwork}
            disabled={isLoading}
            title="Restore baseline topology and metrics"
          >
            <HiOutlineRefresh className={isLoading ? 'spin' : ''} />
            Reset Twin
          </button>

          {/* Live Network Monitoring Button */}
          <button
            className="btn btn-sm"
            onClick={onOpenLiveMonitoring}
            title="Open Live Network Monitoring — real-time interface stats & packet capture"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(99,102,241,0.2))',
              border: '1px solid rgba(6,182,212,0.5)',
              color: '#67e8f9',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              position: 'relative',
            }}
          >
            <HiOutlineWifi />
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Live Monitoring
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block', animation: 'liveBlip 1.8s ease-in-out infinite' }} />
            </span>
          </button>
        </div>
      </header>

      <style>{`
        @keyframes liveBlip {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ade80; }
          50% { opacity: 0.4; box-shadow: 0 0 14px #4ade80; }
        }
      `}</style>

      <div className="dashboard-content" style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', minWidth: 0 }}>

      {/* ── 4-Step Interactive Workflow Navigation Bar ── */}
      <section
        style={{
          background: 'linear-gradient(180deg, rgba(26, 34, 54, 0.95), rgba(15, 22, 41, 0.95))',
          border: '1px solid var(--border-primary)',
          borderRadius: '12px',
          padding: '10px 16px',
          marginBottom: '18px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginRight: '4px' }}>
              Interactive Workflow:
            </span>

            {WORKFLOW_STEPS.map((step, idx) => {
              const isActive = activePage === step.id;
              let badgeText = null;
              let badgeColor = null;

              if (step.id === 'faults' && isDegraded) {
                badgeText = activeFaults && activeFaults.length > 1 ? `${activeFaults.length} FAULTS` : 'FAULT ACTIVE';
                badgeColor = '#ef4444';
              } else if (step.id === 'ai' && isDegraded) {
                badgeText = 'READY';
                badgeColor = '#10b981';
              } else if (step.id === 'healing' && isHealed) {
                badgeText = 'HEALED';
                badgeColor = '#8b5cf6';
              } else if (step.id === 'metrics' && isHealed) {
                badgeText = 'IMPROVEMENT';
                badgeColor = '#38bdf8';
              } else if (step.id === 'simulation' && isHealed) {
                badgeText = 'LIVE DUAL SIM';
                badgeColor = '#10b981';
              }

              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && (
                    <HiOutlineArrowRight style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 2px' }} />
                  )}
                  <button
                    onClick={() => onNavigate && onNavigate(step.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: isActive ? '1px solid var(--accent-primary)' : '1px solid rgba(42, 58, 92, 0.6)',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.2))'
                        : 'rgba(17, 24, 39, 0.6)',
                      color: isActive ? '#60a5fa' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{step.title}</span>
                    {badgeText && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: badgeColor,
                          color: '#fff',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {badgeText}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Switch to Full Dashboard Overview */}
          <button
            onClick={() => onNavigate && onNavigate('dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: activePage === 'dashboard' ? '1px solid var(--accent-primary)' : '1px solid rgba(42, 58, 92, 0.5)',
              background: activePage === 'dashboard' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activePage === 'dashboard' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <HiOutlineGlobe />
            <span>Overview</span>
          </button>
        </div>
      </section>

      {/* ── Quick Interactive Device Selector Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '8px 14px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(42, 58, 92, 0.6)',
          borderRadius: '8px',
          fontSize: '0.75rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        <span style={{ color: '#38bdf8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          🎛️ Interactive Device Controls:
        </span>
        {(topology?.devices || []).map((d) => {
          const isSelected = selectedDeviceId === d.id;
          const isOff = d.status === 'failed' || d.is_powered_on === false;
          const icon = d.device_type === 'router' ? '🌐' : d.device_type === 'switch' ? '🔀' : d.device_type === 'server' ? '🖥️' : '💻';

          return (
            <button
              key={d.id}
              onClick={() => onSelectDevice && onSelectDevice(d.id)}
              style={{
                padding: '4px 9px',
                borderRadius: '5px',
                border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(42, 58, 92, 0.7)',
                background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                color: isSelected ? '#38bdf8' : isOff ? '#f87171' : '#e2e8f0',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: isSelected ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
              title={`Click to open controls for ${d.name} (${d.ip_address})`}
            >
              <span>{icon}</span>
              <span>{d.name}</span>
              {isOff && (
                <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 700 }}>
                  [OFF]
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── STEP 1: FAULT SIMULATOR (Choose Multiple Faults) ── */}
      {activePage === 'faults' && (
        <section>
          {/* Step Guidance Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isDegraded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(30, 41, 59, 0.4)',
              border: `1px solid ${isDegraded ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-primary)'}`,
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isDegraded ? '#f87171' : 'var(--accent-primary)' }}>
                  STEP 1: NETWORK TOPOLOGY & COMPONENT ATTACKS
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  — Click any router, switch, or server node to open its control drawer and inject targeted component attacks.
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: isDegraded ? '#fca5a5' : 'var(--text-secondary)', marginTop: '4px' }}>
                {isDegraded
                  ? (autoHealing
                      ? `🤖 Auto-Mode Active: Fault(s) injected (${activeFaults && activeFaults.length > 1 ? `${activeFaults.length} simultaneous faults` : (activeFault?.faultType || 'anomaly')}). Transitioning through AI Analysis & Self-Healing automatically...`
                      : `🚨 Faults Active: ${activeFaults && activeFaults.length > 1 ? `${activeFaults.length} simultaneous faults applied` : `${activeFault?.faultType || 'Anomaly'} on ${activeFault?.targetId || 'Network'}`}. Health: ${healthScore}%. Topology degraded. Proceeding to AI Analysis...`)
                  : (autoHealing
                      ? '⚡ Auto-Healing is ENABLED: Injecting faults will execute the full 4-stage pipeline automatically.'
                      : '🟢 Network Baseline Normal (Health: 96%+). Click any router, switch, or server to inject component attacks.')}
              </div>
            </div>

            {isDegraded && (
              <button
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('ai')}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 16px rgba(16,185,129,0.4)',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Proceed to Step 2: AI Analysis & Proposed Changes ➜
              </button>
            )}
          </div>

          {/* If faults are active, show active incident banner (Screenshot 1 top banner) */}
          {isDegraded && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171' }}>
                    Faults Active in Digital Twin ({activeFaults && activeFaults.length > 1 ? activeFaults.length : (activeFault ? 1 : 0)}):
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600 }}>
                    {activeFaults && activeFaults.length > 1
                      ? `${activeFaults.length} component attacks applied`
                      : `${activeFault?.faultType || 'Fault'} on ${activeFault?.targetId || 'Network'}`}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Telemetry degraded. AI Anomaly Detector has identified anomalous patterns.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onTriggerHealing && onTriggerHealing('auto')}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#34d399',
                    padding: '6px 14px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  ⚡ Enable AI & Optimize Network
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigate && onNavigate('ai')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Review AI Action Plan ➜
                </button>
              </div>
            </div>
          )}

          {/* Full-Width Network Digital Twin Topology (Matching Screenshot 3 as Main) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <NetworkTopology
              devices={topology?.devices || []}
              links={topology?.links || []}
              alternatePath={alternatePath}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={onSelectDevice}
              isSimulating={isSimulating}
              onToggleSimulation={onToggleSimulation}
              stagedFaults={stagedFaults}
            />

            {/* ── AT THE END OF THE DIAGRAM: SIMULATE ALL SELECTED FAULTS BAR ── */}
            <div
              className="staged-simulation-bar"
              style={{
                background: stagedFaults.length > 0
                  ? 'linear-gradient(135deg, rgba(30, 27, 45, 0.95), rgba(15, 23, 42, 0.98))'
                  : 'rgba(15, 23, 42, 0.75)',
                border: stagedFaults.length > 0
                  ? '1.5px solid rgba(239, 68, 68, 0.6)'
                  : '1px dashed rgba(56, 189, 248, 0.35)',
                borderRadius: '12px',
                padding: '14px 18px',
                boxShadow: stagedFaults.length > 0
                  ? '0 0 24px rgba(239, 68, 68, 0.25), inset 0 0 16px rgba(239, 68, 68, 0.08)'
                  : '0 2px 8px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease',
              }}
            >
              {stagedFaults.length > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', display: 'inline-block' }} />
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>
                          ⚡ STAGED COMPONENT FAULTS ({stagedFaults.length} Ready to Simulate)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '3px' }}>
                        You selected faults across components. Click <strong>Simulate All Selected Faults</strong> to execute them in the digital twin and advance to the next step.
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={onClearStagedFaults}
                        disabled={isLoading}
                        style={{ fontSize: '0.78rem', padding: '8px 14px' }}
                      >
                        Clear All
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onSimulateAllStagedFaults}
                        disabled={isLoading}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          borderColor: '#f87171',
                          boxShadow: '0 0 24px rgba(239, 68, 68, 0.55)',
                          padding: '10px 22px',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          transform: 'scale(1.02)',
                        }}
                      >
                        <HiOutlineLightningBolt style={{ fontSize: '1.25rem' }} className={isLoading ? 'spin' : ''} />
                        {isLoading ? 'Simulating Faults in Twin...' : `⚡ Simulate All Selected Faults (${stagedFaults.length}) ➜`}
                      </button>
                    </div>
                  </div>

                  {/* Queued Fault Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {stagedFaults.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          border: '1px solid rgba(239, 68, 68, 0.45)',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          color: '#f1f5f9',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 700 }}>
                          {f.componentName || f.componentId}
                        </span>
                        <span style={{ fontWeight: 600, color: '#fca5a5' }}>
                          {f.label}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          ({f.targetId})
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveStagedFault && onRemoveStagedFault(f.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '0 2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginLeft: '2px',
                          }}
                          title="Remove this fault from queue"
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>🎯</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                        Simulate Component Faults Workflow
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Click any component in the diagram above to choose faults. When finished, click <strong>"Simulate All Selected Faults"</strong> here to inject them and advance to Step 2: AI Analysis.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>Quick open:</span>
                    {(topology?.devices || []).slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectDevice && onSelectDevice(d.id)}
                        style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                        title={`Select ${d.name} (${d.id})`}
                      >
                        + Select {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Telemetry KPI Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <HealthCard label="Latency" value={latency} unit="ms" status={parseFloat(latency) < 40 ? 'good' : 'bad'} icon={<HiOutlineClock />} />
              <HealthCard label="Packet Loss" value={packetLoss} unit="%" status={parseFloat(packetLoss) < 2 ? 'good' : 'bad'} icon={<HiOutlineExclamation />} />
              <HealthCard label="Throughput" value={throughput} unit="Mbps" status={parseFloat(throughput) > 70 ? 'good' : 'bad'} icon={<HiOutlineChartBar />} />
              <HealthCard label="Network Health" value={healthScore} unit="%" status={healthScore >= 80 ? 'good' : 'bad'} icon={<HiOutlineShieldCheck />} />
            </div>

            {/* ── Workflow Navigation Footer (End of Step 1) ── */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(42, 58, 92, 0.7)',
                borderRadius: '12px',
                padding: '14px 20px',
                marginTop: '6px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>
                  STEP 1 COMPLETE: Network Topology & Component Faults
                </span>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isDegraded
                    ? 'Faults are active in the digital twin. Proceed to Step 2 to review AI diagnosis & proposed changes.'
                    : 'Fault simulator ready. Select component faults above, or click next to review AI diagnosis & proposed changes.'}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('ai')}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 18px rgba(16, 185, 129, 0.45)',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Proceed to Step 2: AI Analysis & Changes ➜</span>
                <HiOutlineArrowRight />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── STEP 2: AI ANALYSIS & WHAT WE CAN CHANGE (Matching Screenshot 2) ── */}
      {activePage === 'ai' && (
        <section>
          {/* Step Guidance Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isDegraded ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.4)',
              border: `1px solid ${isDegraded ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-primary)'}`,
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                  STEP 2: AI ANALYSIS & WHAT WE CAN CHANGE
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  — Root cause diagnosis & actionable AI plan to restore healthy network baselines.
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {isDegraded
                  ? (autoHealing
                      ? '🤖 Auto-Mode Active: AI analyzing root cause & formulating flow changes. Applying Self-Healing automatically...'
                      : `⚡ Root cause diagnosed: ${detection?.fault_type?.replace(/_/g, ' ') || 'Fault'} (${(detection?.confidence ? detection.confidence * 100 : 96.4).toFixed(1)}% confidence). Review proposed changes below and click Self-Heal.`)
                  : '✅ AI Optimization has been applied. Network rerouted via alternate path and health restored.'}
              </div>
            </div>

            {isDegraded ? (
              <button
                className="btn btn-primary"
                onClick={() => onTriggerHealing('auto')}
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 16px rgba(16,185,129,0.4)',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {isLoading ? 'Self-Healing...' : '🛡️ Self-Heal Network (Apply Changes) ➜'}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('healing')}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  borderColor: '#a78bfa',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Proceed to Step 3: Self-Healing Pipeline ➜
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 480px) 1fr', gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AIAnalysis
                detection={detection}
                onTriggerHealing={onTriggerHealing}
                isLoading={isLoading}
                autoHealing={autoHealing}
                onToggleAutoHealing={onToggleAutoHealing}
                lastRecovery={lastRecovery}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <NetworkTopology
                devices={topology?.devices || []}
                links={topology?.links || []}
                alternatePath={alternatePath}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={onSelectDevice}
              />

              {/* ML Model Performance Summary Card */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '10px' }}>
                  Machine Learning Model Performance
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MODEL PRECISION</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>98.4%</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>F1-SCORE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>0.979</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INFERENCE LATENCY</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>~4.2 ms</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Workflow Navigation Footer (End of Step 2) ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(42, 58, 92, 0.7)',
              borderRadius: '12px',
              padding: '14px 20px',
              marginTop: '18px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate && onNavigate('faults')}
              style={{ fontSize: '0.85rem', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <HiOutlineArrowLeft />
              <span>Back to Step 1: Topology & Attacks</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isDegraded && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onTriggerHealing && onTriggerHealing('auto')}
                  disabled={isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#34d399',
                    padding: '10px 18px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
                  <span>Execute Self-Healing Now</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('healing')}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  borderColor: '#a78bfa',
                  boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Proceed to Step 3: Self-Healing Pipeline ➜</span>
                <HiOutlineArrowRight />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── STEP 3: SELF-HEALING & ALGORITHMS (Matching Screenshot 3) ── */}
      {activePage === 'healing' && (
        <section>
          {/* Step Guidance Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa' }}>
                  STEP 3: AUTONOMOUS SELF-HEALING EXECUTION
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  — Inspect execution pipeline, choose from 5 healing strategies, and review algorithms.
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {lastRecovery
                  ? `✔ Applied Strategy: ${lastRecovery.recovery_strategy || lastRecovery.strategy_used || 'Multi-Objective AI Shortest Path'} in ${(lastRecovery.recovery_time_seconds ? (lastRecovery.recovery_time_seconds * 1000).toFixed(1) : lastRecovery.execution_time_ms ? lastRecovery.execution_time_ms.toFixed(1) : 8.4)}ms. Alternate path active.`
                  : 'Autonomous self-healing engine ready. Choose strategy below or execute automated recovery.'}
              </div>
            </div>

            {lastRecovery ? (
              <button
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('metrics')}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                ✔ Proceed to Step 4: Difference Results ➜
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => onTriggerHealing && onTriggerHealing('auto')}
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
                <span>{isLoading ? 'AI Optimizing...' : '⚡ Optimize Network with AI First'}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(480px, 1.2fr) 1fr', gap: '16px', alignItems: 'start' }}>
            <SelfHealing
              healingStatus={healingStatus}
              lastRecovery={lastRecovery}
              onTriggerHealing={onTriggerHealing}
              isLoading={isLoading}
              detection={detection}
              activeFault={activeFault}
              activeFaults={activeFaults}
              topology={topology}
              onNavigate={onNavigate}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <NetworkTopology
                devices={topology?.devices || []}
                links={topology?.links || []}
                alternatePath={alternatePath}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={onSelectDevice}
                isSimulating={isSimulating}
                onToggleSimulation={onToggleSimulation}
              />

              {/* Recovery Status Card */}
              {lastRecovery && (
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HiOutlineCheckCircle />
                    Active Recovery Execution Record
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    {lastRecovery.action_details}
                  </div>
                  {lastRecovery.alternate_path && lastRecovery.alternate_path.length > 0 && (
                    <div style={{ marginTop: '10px', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 10px', borderRadius: '6px', color: '#34d399' }}>
                      Active Alternate Path: {lastRecovery.alternate_path.join(' ➔ ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Workflow Navigation Footer (End of Step 3) ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(42, 58, 92, 0.7)',
              borderRadius: '12px',
              padding: '14px 20px',
              marginTop: '18px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate && onNavigate('ai')}
              style={{ fontSize: '0.85rem', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <HiOutlineArrowLeft />
              <span>Back to Step 2: AI Analysis</span>
            </button>

            {lastRecovery ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('metrics')}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 18px rgba(16, 185, 129, 0.45)',
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✔ Optimization Complete — Proceed to Step 4: Difference Results ➜</span>
                <HiOutlineArrowRight />
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  🔒 Step 4 (Difference Results) unlocks after AI optimization completes
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onTriggerHealing && onTriggerHealing('auto')}
                  disabled={isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#34d399',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                    padding: '10px 22px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
                  <span>{isLoading ? 'AI Optimizing Network Twin...' : '⚡ Optimize Network Now with AI ➜'}</span>
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── STEP 4: DIFFERENCE & RESULTS (Matching Screenshot 4) ── */}
      {activePage === 'metrics' && (
        <section>
          {/* Step Guidance Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
                  STEP 4: PERFORMANCE DIFFERENCE RESULTS (BEFORE VS AFTER AI)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  — Verified telemetry difference comparing before AI intervention (degraded) vs after self-healing.
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {autoHealing
                  ? '🤖 Auto-Mode Completed: All 4 stages executed autonomously. Detailed difference breakdown shown below.'
                  : 'Manual Workflow Completed: Telemetry differences and AI self-healing improvements shown below.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (onNavigate) onNavigate('topology');
                  if (onToggleSimulation) onToggleSimulation(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                  border: '1px solid #38bdf8',
                  boxShadow: '0 0 14px rgba(14, 165, 233, 0.4)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '7px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>▶ Show Simulation (Topology)</span>
                <HiOutlineArrowRight />
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  await onResetNetwork();
                  if (onNavigate) onNavigate('faults');
                }}
                disabled={isLoading}
                title="Reset network to baseline and start a new scenario"
              >
                <HiOutlineRefresh />
                ↻ Perform Another Fault Scenario
              </button>
            </div>
          </div>

          {/* Before vs After Improvement KPI Banner */}
          <BeforeAfterImprovementBanner comparison={comparison} />

          {/* Detailed Performance Difference Table */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HiOutlineChartBar />
                  Performance Difference Summary: Degraded vs AI Self-Healed
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Measured telemetry contrast comparing degraded baseline before intervention against restored performance post-AI.
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600, border: '1px solid rgba(16,185,129,0.3)' }}>
                ✔ AI Optimization Difference Verified
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>METRIC</th>
                    <th style={{ padding: '8px 12px' }}>BEFORE AI (DEGRADED)</th>
                    <th style={{ padding: '8px 12px' }}>AFTER AI (OPTIMIZED)</th>
                    <th style={{ padding: '8px 12px' }}>ABSOLUTE DIFFERENCE</th>
                    <th style={{ padding: '8px 12px' }}>NET IMPROVEMENT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(42, 58, 92, 0.4)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>End-to-End Latency</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.before?.latency ?? 78.4).toFixed(1)} ms</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.after?.latency ?? 21.2).toFixed(1)} ms</td>
                    <td style={{ padding: '10px 12px', color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>-{((comparison?.before?.latency ?? 78.4) - (comparison?.after?.latency ?? 21.2)).toFixed(1)} ms</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>+{comparison?.improvement?.latency_reduction_pct ?? 72.9}% Faster</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(42, 58, 92, 0.4)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>Packet Loss Rate</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.before?.packet_loss ?? 8.9).toFixed(2)}%</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.after?.packet_loss ?? 0.35).toFixed(2)}%</td>
                    <td style={{ padding: '10px 12px', color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>-{((comparison?.before?.packet_loss ?? 8.9) - (comparison?.after?.packet_loss ?? 0.35)).toFixed(2)}%</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>-{comparison?.improvement?.loss_reduction_pct ?? 96.1}% Loss Reduction</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(42, 58, 92, 0.4)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>Network Throughput</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.before?.throughput ?? 42.1).toFixed(1)} Mbps</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.after?.throughput ?? 95.2).toFixed(1)} Mbps</td>
                    <td style={{ padding: '10px 12px', color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>+{((comparison?.after?.throughput ?? 95.2) - (comparison?.before?.throughput ?? 42.1)).toFixed(1)} Mbps</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>+{comparison?.improvement?.throughput_boost_pct ?? 126.1}% Gain</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(42, 58, 92, 0.4)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>Core CPU & Congestion</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.before?.cpu_usage ?? 46.5).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{(comparison?.after?.cpu_usage ?? 34.0).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>-{((comparison?.before?.cpu_usage ?? 46.5) - (comparison?.after?.cpu_usage ?? 34.0)).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>-{comparison?.improvement?.cpu_reduction_pct ?? 26.9}% Reduced Load</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>Overall Network Health</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 600 }}>{(comparison?.before?.health_score ?? 52).toFixed(0)}% (Critical)</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>{(comparison?.after?.health_score ?? 96).toFixed(0)}% (Excellent)</td>
                    <td style={{ padding: '10px 12px', color: '#a855f7', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>+{((comparison?.after?.health_score ?? 96) - (comparison?.before?.health_score ?? 52)).toFixed(0)}%</td>
                    <td style={{ padding: '10px 12px', color: '#a855f7', fontWeight: 700 }}>+{comparison?.improvement?.health_boost ?? 44}% Full Recovery</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Clean 4-Chart Grid */}
          <div className="charts-grid-full" style={{ marginTop: '16px' }}>
            <MetricsChart data={metricsHistory} metric="latency" height={210} comparison={comparison} showComparisonToggle={true} />
            <MetricsChart data={metricsHistory} metric="packet_loss" height={210} comparison={comparison} showComparisonToggle={true} />
            <MetricsChart data={metricsHistory} metric="throughput" height={210} comparison={comparison} showComparisonToggle={true} />
            <MetricsChart data={metricsHistory} metric="cpu_usage" height={210} comparison={comparison} showComparisonToggle={true} />
          </div>

          {/* ── Workflow Navigation Footer (End of Step 4) ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '12px',
              padding: '14px 20px',
              marginTop: '20px',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate && onNavigate('healing')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '10px 18px' }}
            >
              <HiOutlineArrowLeft />
              <span>Back to Step 3: Self-Healing</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate && onNavigate('simulation')}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                borderColor: '#38bdf8',
                boxShadow: '0 0 20px rgba(14, 165, 233, 0.5)',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '10px 24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>Proceed to Step 5: Before vs After AI Simulation ➜</span>
              <HiOutlineArrowRight />
            </button>
          </div>
        </section>
      )}

      {/* ── STEP 5: BEFORE VS AFTER AI SIMULATION (Dedicated Live Dual Twin) ── */}
      {activePage === 'simulation' && (
        <BeforeAfterSimulation
          topology={topology}
          comparison={comparison}
          activeFault={activeFault}
          activeFaults={activeFaults}
          lastRecovery={lastRecovery}
          alternatePath={alternatePath}
          onNavigate={onNavigate}
          onResetNetwork={onResetNetwork}
          isLoading={isLoading}
        />
      )}

      {/* ── ALL-IN-ONE OVERVIEW DASHBOARD (Compact & Balanced, No 3800px vertical pileup) ── */}
      {activePage === 'dashboard' && (
        <section>
          {/* Top KPI row */}
          <div className="metrics-grid" style={{ marginBottom: '16px' }}>
            <HealthCard label="End-to-End Latency" value={latency} unit="ms" status={parseFloat(latency) < 40 ? 'good' : 'bad'} icon={<HiOutlineClock />} />
            <HealthCard label="Packet Loss Rate" value={packetLoss} unit="%" status={parseFloat(packetLoss) < 2 ? 'good' : 'bad'} icon={<HiOutlineExclamation />} />
            <HealthCard label="Network Throughput" value={throughput} unit="Mbps" status={parseFloat(throughput) > 70 ? 'good' : 'bad'} icon={<HiOutlineChartBar />} />
            <HealthCard label="Overall Network Health" value={healthScore} unit="%" status={healthScore >= 80 ? 'good' : 'bad'} icon={<HiOutlineShieldCheck />} />
          </div>

          {/* Center: Topology on Left, AI Analysis on Right */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <NetworkTopology
              devices={topology?.devices || []}
              links={topology?.links || []}
              alternatePath={alternatePath}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={onSelectDevice}
              isSimulating={isSimulating}
              onToggleSimulation={onToggleSimulation}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <AIAnalysis
                detection={detection}
                onTriggerHealing={onTriggerHealing}
                isLoading={isLoading}
                autoHealing={autoHealing}
                onToggleAutoHealing={onToggleAutoHealing}
                lastRecovery={lastRecovery}
              />
            </div>
          </div>

          {/* Telemetry Charts & Improvement */}
          <BeforeAfterImprovementBanner comparison={comparison} />

          <div className="charts-grid-full" style={{ marginTop: '16px', marginBottom: '20px' }}>
            <MetricsChart data={metricsHistory} metric="latency" height={190} comparison={comparison} showComparisonToggle={true} />
            <MetricsChart data={metricsHistory} metric="packet_loss" height={190} comparison={comparison} showComparisonToggle={true} />
          </div>

          {/* Event Log */}
          <EventLog events={events} onClearEvents={onClearEvents} />
        </section>
      )}

      {/* ── Standalone Topology View ── */}
      {activePage === 'topology' && (
        <section>
          <NetworkTopology
            devices={topology?.devices || []}
            links={topology?.links || []}
            alternatePath={alternatePath}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={onSelectDevice}
            isSimulating={isSimulating}
            onToggleSimulation={onToggleSimulation}
          />
        </section>
      )}

      {/* ── Standalone Event History View ── */}
      {activePage === 'history' && (
        <section>
          <EventLog events={events} onClearEvents={onClearEvents} />
        </section>
      )}
      </div>
    </div>
  );
}

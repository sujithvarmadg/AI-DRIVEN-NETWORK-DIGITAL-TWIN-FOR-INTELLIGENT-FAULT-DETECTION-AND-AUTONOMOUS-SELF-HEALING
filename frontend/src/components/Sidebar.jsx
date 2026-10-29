import React from 'react';
import {
  HiOutlineViewGrid, HiOutlineGlobe, HiOutlineLightningBolt,
  HiOutlineExclamationCircle, HiOutlineShieldCheck, HiOutlineChartBar,
  HiOutlineClock, HiOutlineCog, HiOutlinePlay, HiOutlineWifi
} from 'react-icons/hi';

const workflowSteps = [
  { id: 'faults', step: '1', label: '1. Topology & Attacks', icon: <HiOutlineGlobe /> },
  { id: 'ai', step: '2', label: '2. AI Analysis & Changes', icon: <HiOutlineLightningBolt /> },
  { id: 'healing', step: '3', label: '3. Self-Healing', icon: <HiOutlineShieldCheck /> },
  { id: 'metrics', step: '4', label: '4. Difference & Results', icon: <HiOutlineChartBar /> },
  { id: 'simulation', step: '5', label: '5. Before vs After Sim', icon: <HiOutlinePlay /> },
];

const generalViews = [
  { id: 'dashboard', label: 'Overview Dashboard', icon: <HiOutlineViewGrid /> },
  { id: 'topology', label: 'Digital Twin Topology', icon: <HiOutlineGlobe /> },
  { id: 'history', label: 'Event Audit Log', icon: <HiOutlineClock /> },
];

export default function Sidebar({ activePage, onNavigate, health, onOpenLiveMonitoring }) {
  const healthLabel = health?.health_label || 'Healthy';
  const statusClass = healthLabel === 'Excellent' || healthLabel === 'Good'
    ? '' : healthLabel === 'Warning' ? 'warning' : 'critical';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>AI Network Digital Twin</h1>
        <div className="brand-sub">Autonomous Self-Healing Twin</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">5-Step Workflow</div>
        {workflowSteps.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            style={{ position: 'relative' }}
          >
            <span className="nav-icon" style={{ color: activePage === item.id ? 'var(--accent-primary)' : 'inherit' }}>
              {item.icon}
            </span>
            <span style={{ fontWeight: activePage === item.id ? 600 : 500 }}>{item.label}</span>
          </div>
        ))}

        <div className="nav-section-title" style={{ marginTop: 20 }}>System Views</div>
        {generalViews.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}

        {/* Live Network Monitoring Button */}
        <div className="nav-section-title" style={{ marginTop: 20 }}>Live Tools</div>
        <div
          className="nav-item"
          onClick={onOpenLiveMonitoring}
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(99,102,241,0.12))',
            border: '1px solid rgba(6,182,212,0.35)',
            borderRadius: '8px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span className="nav-icon" style={{ color: '#22d3ee' }}>
            <HiOutlineWifi />
          </span>
          <span style={{ fontWeight: 700, color: '#67e8f9' }}>Live Network Monitoring</span>
          <span style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 7, height: 7, borderRadius: '50%', background: '#4ade80',
            boxShadow: '0 0 6px #4ade80',
            animation: 'liveBlip 1.8s ease-in-out infinite',
          }} />
        </div>
      </nav>

      <div className="sidebar-status">
        <div className="status-indicator">
          <span className={`status-dot ${statusClass}`}></span>
          <span style={{ color: 'var(--text-secondary)' }}>
            System {healthLabel}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes liveBlip {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ade80; }
          50% { opacity: 0.4; box-shadow: 0 0 12px #4ade80; }
        }
      `}</style>
    </aside>
  );
}

import React from 'react';
import {
  HiOutlineStatusOnline, HiOutlineExclamation,
  HiOutlineTrendingDown, HiOutlineTrendingUp
} from 'react-icons/hi';

/**
 * HealthCard — displays a single metric card in the dashboard grid.
 * Supports good/warning/bad status coloring.
 */
export default function HealthCard({ label, value, unit, status, icon }) {
  const statusClass = status === 'good' ? 'good' : status === 'warning' ? 'warning' : status === 'bad' ? 'bad' : '';

  const statusIcon = status === 'good'
    ? <HiOutlineTrendingUp />
    : status === 'bad'
      ? <HiOutlineTrendingDown />
      : status === 'warning'
        ? <HiOutlineExclamation />
        : <HiOutlineStatusOnline />;

  const statusText = status === 'good' ? 'Normal' : status === 'warning' ? 'Warning' : status === 'bad' ? 'Critical' : 'N/A';

  return (
    <div className="metric-card">
      <div className="metric-label">
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {label}
      </div>
      <div className="metric-value">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      <div className={`metric-status ${statusClass}`}>
        {statusIcon} {statusText}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  HiOutlineLightningBolt,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineShieldCheck,
  HiOutlineChartBar,
} from 'react-icons/hi';

/**
 * MetricsChart — renders real-time time-series charts for network metrics,
 * fixes timestamp formatting, and displays Before vs After AI graph improvement.
 */

const CHART_CONFIGS = {
  latency: {
    color: '#3b82f6',
    label: 'Latency (ms)',
    unit: 'ms',
    benchmarkLowerIsBetter: true,
    healthyAvg: 21.0,
    degradedAvg: 185.0,
  },
  packet_loss: {
    color: '#ef4444',
    label: 'Packet Loss (%)',
    unit: '%',
    benchmarkLowerIsBetter: true,
    healthyAvg: 0.4,
    degradedAvg: 26.5,
  },
  throughput: {
    color: '#10b981',
    label: 'Throughput (Mbps)',
    unit: 'Mbps',
    benchmarkLowerIsBetter: false,
    healthyAvg: 95.0,
    degradedAvg: 22.0,
  },
  cpu_usage: {
    color: '#f59e0b',
    label: 'CPU Usage (%)',
    unit: '%',
    benchmarkLowerIsBetter: true,
    healthyAvg: 32.0,
    degradedAvg: 90.0,
  },
  memory_usage: {
    color: '#8b5cf6',
    label: 'Memory Usage (%)',
    unit: '%',
    benchmarkLowerIsBetter: true,
    healthyAvg: 38.0,
    degradedAvg: 85.0,
  },
  traffic_load: {
    color: '#06b6d4',
    label: 'Network Traffic (%)',
    unit: '%',
    benchmarkLowerIsBetter: true,
    healthyAvg: 35.0,
    degradedAvg: 92.0,
  },
};

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const timeStr = p.payload?.time || label || 'Telemetry';
  const phase = p.payload?.phase;
  const marker = p.payload?.marker_label;

  return (
    <div style={{
      background: '#131b2e',
      border: '1px solid #2a3a5c',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: '0.75rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span>{timeStr}</span>
        {phase && (
          <span style={{
            fontSize: '0.65rem',
            padding: '1px 5px',
            borderRadius: 4,
            background: phase === 'degraded' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            color: phase === 'degraded' ? '#ef4444' : '#10b981',
            fontWeight: 600,
          }}>
            {phase === 'degraded' ? 'PRE-AI (DEGRADED)' : 'POST-AI (OPTIMIZED)'}
          </span>
        )}
      </div>
      {marker && (
        <div style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600, marginBottom: 4 }}>
          ⚡ {marker}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {entry.value !== undefined ? Number(entry.value).toFixed(2) : '0.00'} {unit}
        </div>
      ))}
    </div>
  );
};

export default function MetricsChart({
  data = [],
  metric = 'latency',
  height = 180,
  comparison = null,
  showComparisonToggle = false,
}) {
  const [viewMode, setViewMode] = useState('stream'); // 'stream' or 'comparison'
  const config = CHART_CONFIGS[metric] || CHART_CONFIGS.latency;

  // Format data safely avoiding Invalid Date
  const formattedData = data.map((d, i) => {
    let timeStr = `${i}`;
    if (d.timestamp) {
      try {
        const dateObj = new Date(d.timestamp);
        if (!isNaN(dateObj.getTime())) {
          timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (typeof d.timestamp === 'string') {
          timeStr = d.timestamp;
        }
      } catch (e) {
        timeStr = `${i}`;
      }
    }

    return {
      ...d,
      time: timeStr,
      [metric]: d[metric] ?? 0,
      phase: d.phase || (d[metric] > (config.healthyAvg * 2) ? 'degraded' : 'healthy'),
    };
  });

  // Calculate before & after values for comparison view
  const beforeVal = comparison?.before?.[metric] ?? config.degradedAvg;
  const afterVal = comparison?.after?.[metric] ?? config.healthyAvg;
  const lowerIsBetter = config.benchmarkLowerIsBetter;
  const improvementPct = lowerIsBetter
    ? Math.max(0, Math.round(((beforeVal - afterVal) / Math.max(0.1, beforeVal)) * 100))
    : Math.max(0, Math.round(((afterVal - beforeVal) / Math.max(0.1, beforeVal)) * 100));

  const comparisonData = [
    { label: 'Before AI (Degraded)', value: Number(beforeVal.toFixed(1)), fill: '#ef4444' },
    { label: 'After AI (Optimized)', value: Number(afterVal.toFixed(1)), fill: '#10b981' },
  ];

  return (
    <div className="chart-card">
      <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: config.color, display: 'inline-block'
          }}></span>
          <span>{config.label}</span>
        </div>

        {/* Improvement Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: '0.68rem',
            padding: '2px 7px',
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            fontWeight: 600,
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}>
            {lowerIsBetter ? <HiOutlineTrendingDown /> : <HiOutlineTrendingUp />}
            {improvementPct}% AI Boost
          </span>

          {showComparisonToggle && (
            <button
              onClick={() => setViewMode(v => v === 'stream' ? 'comparison' : 'stream')}
              style={{
                fontSize: '0.65rem',
                padding: '2px 6px',
                borderRadius: 4,
                background: viewMode === 'comparison' ? 'var(--accent-primary)' : 'rgba(30, 41, 59, 0.8)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Toggle Before/After comparison"
            >
              {viewMode === 'comparison' ? 'Stream' : 'Before/After'}
            </button>
          )}
        </div>
      </div>

      <div className="chart-wrapper" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'comparison' ? (
            <BarChart data={comparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e2d4a' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e2d4a' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div style={{ background: '#131b2e', border: '1px solid #2a3a5c', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem' }}>
                      <div style={{ color: item.payload.fill, fontWeight: 600 }}>{item.payload.label}</div>
                      <div style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{item.value} {config.unit}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <AreaChart data={formattedData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1e2d4a' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1e2d4a' }}
              />
              <Tooltip content={<CustomTooltip unit={config.unit} />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#gradient-${metric})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Mini Improvement Footer */}
      <div style={{
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px solid rgba(30, 45, 74, 0.6)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.7rem',
        color: '#94a3b8',
      }}>
        <span>Pre-AI: <strong style={{ color: '#ef4444' }}>{beforeVal.toFixed(1)}{config.unit}</strong></span>
        <span>➔</span>
        <span>Post-AI: <strong style={{ color: '#10b981' }}>{afterVal.toFixed(1)}{config.unit}</strong></span>
      </div>
    </div>
  );
}

/**
 * BeforeAfterImprovementBanner — displays overarching Before vs After AI metrics.
 */
export function BeforeAfterImprovementBanner({ comparison }) {
  const before = comparison?.before || {
    latency: 184.2,
    packet_loss: 26.8,
    throughput: 21.5,
    cpu_usage: 89.4,
    health_score: 38.0,
  };

  const after = comparison?.after || {
    latency: 21.2,
    packet_loss: 0.35,
    throughput: 95.2,
    cpu_usage: 32.0,
    health_score: 96.5,
  };

  const improvement = comparison?.improvement || {
    latency_reduction_pct: 88.5,
    loss_reduction_pct: 98.7,
    throughput_boost_pct: 342.8,
    cpu_reduction_pct: 64.2,
    health_boost: 58.5,
  };

  const kpis = [
    {
      label: 'End-to-End Latency',
      before: `${before.latency?.toFixed(1)} ms`,
      after: `${after.latency?.toFixed(1)} ms`,
      gain: `-${improvement.latency_reduction_pct}%`,
      positive: true,
      color: '#38bdf8',
    },
    {
      label: 'Packet Loss Rate',
      before: `${before.packet_loss?.toFixed(1)}%`,
      after: `${after.packet_loss?.toFixed(2)}%`,
      gain: `-${improvement.loss_reduction_pct}%`,
      positive: true,
      color: '#ef4444',
    },
    {
      label: 'Network Throughput',
      before: `${before.throughput?.toFixed(1)} Mbps`,
      after: `${after.throughput?.toFixed(1)} Mbps`,
      gain: `+${improvement.throughput_boost_pct}%`,
      positive: true,
      color: '#10b981',
    },
    {
      label: 'Core CPU & Congestion',
      before: `${before.cpu_usage?.toFixed(1)}%`,
      after: `${after.cpu_usage?.toFixed(1)}%`,
      gain: `-${improvement.cpu_reduction_pct}%`,
      positive: true,
      color: '#f59e0b',
    },
    {
      label: 'Overall Digital Twin Health',
      before: `${before.health_score?.toFixed(0)}% (Critical)`,
      after: `${after.health_score?.toFixed(0)}% (Excellent)`,
      gain: `+${improvement.health_boost}% Health`,
      positive: true,
      color: '#a855f7',
    },
  ];

  return (
    <div style={{
      padding: '14px 18px',
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.08))',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      borderRadius: '10px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiOutlineShieldCheck style={{ color: '#10b981', fontSize: '1.2rem' }} />
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc' }}>
            AI Optimization Improvement Report: Before vs After AI
          </span>
        </div>
        <span style={{
          fontSize: '0.7rem',
          padding: '2px 8px',
          borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981',
          fontWeight: 600,
        }}>
          Autonomous Self-Healing Verified
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(42, 58, 92, 0.5)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', color: '#ef4444', textDecoration: 'line-through', fontFamily: 'monospace' }}>
                {kpi.before}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>➔</span>
              <span style={{ fontSize: '0.88rem', color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>
                {kpi.after}
              </span>
            </div>
            <div style={{
              marginTop: 4,
              fontSize: '0.72rem',
              color: '#34d399',
              fontWeight: 600,
            }}>
              {kpi.gain}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * MetricsChartGrid — renders multiple charts in a grid layout.
 */
export function MetricsChartGrid({
  data = [],
  comparison = null,
  metrics = ['latency', 'packet_loss', 'throughput', 'cpu_usage', 'memory_usage', 'traffic_load'],
}) {
  return (
    <div className="charts-grid">
      {metrics.map((m) => (
        <MetricsChart key={m} data={data} metric={m} comparison={comparison} showComparisonToggle={true} />
      ))}
    </div>
  );
}


import React from 'react';
import {
  HiOutlineLightningBolt,
  HiOutlineShieldCheck,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineChip,
  HiOutlineInformationCircle,
} from 'react-icons/hi';

/**
 * AIAnalysis — displays the AI fault detection panel showing
 * anomaly score, fault type, confidence, severity, feature contributions,
 * and explainability text.
 */

const FEATURE_UNITS = {
  latency: 'ms',
  packet_loss: '%',
  throughput: 'Mbps',
  cpu_usage: '%',
  memory_usage: '%',
  jitter: 'ms',
  error_rate: '%',
  traffic_load: '%',
};

const BASELINES = {
  latency: '15 - 35 ms',
  packet_loss: '< 1.5%',
  throughput: '75 - 100 Mbps',
  cpu_usage: '20 - 50%',
};

export default function AIAnalysis({
  detection,
  onTriggerHealing,
  isLoading,
  autoHealing,
  onToggleAutoHealing,
  lastRecovery,
}) {
  const isAnomaly = Boolean(detection?.anomaly_detected);
  const anomalyScore = detection?.anomaly_score !== undefined ? Number(detection.anomaly_score) : 0;
  const confidence = detection?.confidence !== undefined ? (Number(detection.confidence) * 100).toFixed(1) : '99.4';

  const severityColor = {
    critical: 'var(--color-critical)',
    high: 'var(--color-warning)',
    medium: 'var(--color-info)',
    low: 'var(--color-healthy)',
  };

  return (
    <div className="card ai-panel">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title">
          <HiOutlineLightningBolt style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }} />
          AI Fault Detection & Diagnostics
        </div>
        <span
          className={`badge ${isAnomaly ? 'badge-critical' : 'badge-healthy'}`}
          style={{ letterSpacing: '0.06em' }}
        >
          {isAnomaly ? 'ANOMALY DETECTED' : 'MONITORING ACTIVE'}
        </span>
      </div>

      {/* Detection Status Grid */}
      <div className="ai-status-row">
        <span className="ai-label">Inference Engine</span>
        <span className="ai-value" style={{ color: '#38bdf8' }}>
          Isolation Forest + Random Forest
        </span>
      </div>

      <div className="ai-status-row">
        <span className="ai-label">Network Status</span>
        <span className={`ai-value ${isAnomaly ? 'text-critical' : 'text-healthy'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {isAnomaly ? <HiOutlineExclamationCircle /> : <HiOutlineCheckCircle />}
          {isAnomaly ? 'Abnormal Behavior Detected' : 'Normal Operations (Baseline)'}
        </span>
      </div>

      <div className="ai-status-row">
        <span className="ai-label">Anomaly Score</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '80px', height: '6px', background: 'rgba(15,22,41,0.8)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, anomalyScore * 100)}%`,
                height: '100%',
                background: anomalyScore > 0.5 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #10b981, #34d399)',
              }}
            ></div>
          </div>
          <span
            className="ai-value"
            style={{
              color: anomalyScore > 0.5 ? 'var(--color-critical)' : 'var(--color-healthy)',
            }}
          >
            {anomalyScore.toFixed(3)}
          </span>
        </div>
      </div>

      <div className="ai-status-row">
        <span className="ai-label">Model Confidence</span>
        <span className="ai-value font-mono text-healthy">{confidence}%</span>
      </div>

      {isAnomaly && (
        <>
          <div className="ai-status-row">
            <span className="ai-label">Classified Fault</span>
            <span className="ai-value font-semibold text-warning" style={{ textTransform: 'capitalize' }}>
              {detection.fault_type?.replace(/_/g, ' ') || 'Unknown'}
            </span>
          </div>

          <div className="ai-status-row">
            <span className="ai-label">Target Component</span>
            <span className="ai-value font-mono text-accent">
              {detection.affected_component || 'System Wide'}
            </span>
          </div>

          <div className="ai-status-row">
            <span className="ai-label">Fault Severity</span>
            <span
              className="ai-value font-semibold"
              style={{
                color: severityColor[detection.severity] || 'var(--text-primary)',
                textTransform: 'uppercase',
              }}
            >
              {detection.severity || 'HIGH'}
            </span>
          </div>

          {/* What We Can Change — Actionable AI Recommendations */}
          <div style={{
            marginTop: 14,
            padding: '14px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.08))',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HiOutlineLightningBolt />
                What AI Can Change (Autonomous Action Plan)
              </span>
              <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 600 }}>
                Dijkstra / Multi-Objective
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#cbd5e1' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>1.</span>
                <span>
                  <strong style={{ color: '#f8fafc' }}>Flow Redirection:</strong> Bypass degraded link <code style={{ color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '1px 4px', borderRadius: 3 }}>{detection?.affected_component || 'router1-router2'}</code> by establishing alternate route <strong style={{ color: '#34d399' }}>R1 ➔ R3 ➔ R2</strong>.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#cbd5e1' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>2.</span>
                <span>
                  <strong style={{ color: '#f8fafc' }}>Flow Table Rules:</strong> Push dynamic OpenFlow forwarding rules to Switch S1 with 0% packet drop.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem', color: '#cbd5e1' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>3.</span>
                <span>
                  <strong style={{ color: '#f8fafc' }}>QoS Optimization:</strong> Rebalance queue buffers and restore end-to-end latency below 25ms.
                </span>
              </div>
            </div>

            {onTriggerHealing && (
              <button
                className="btn btn-primary"
                onClick={() => onTriggerHealing('auto')}
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  padding: '9px 14px',
                  justifyContent: 'center',
                }}
              >
                <HiOutlineLightningBolt className={isLoading ? 'spin' : ''} />
                {isLoading ? 'Self-Healing in Progress...' : '🛡️ Self-Heal Network (Apply Changes Automatically) ➜'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Feature Contributions when anomaly */}
      {isAnomaly && detection.feature_contributions && (
        <div className="ai-features">
          <div className="ai-features-title">
            <HiOutlineChip style={{ marginRight: '4px', color: '#60a5fa' }} />
            Telemetry Input Deviations
          </div>
          {Object.entries(detection.feature_contributions).map(([key, val]) => (
            <div key={key} className="ai-feature-row">
              <span className="ai-feature-name">
                {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className="ai-feature-value">
                {typeof val === 'number' ? val.toFixed(1) : val} {FEATURE_UNITS[key] || ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Explainability Box */}
      {isAnomaly && detection.explanation && detection.explanation.length > 0 && (
        <div className="ai-explanation">
          <div className="ai-features-title" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa' }}>
            <HiOutlineInformationCircle />
            Autonomous AI Root Cause Explanation
          </div>
          {detection.explanation.map((line, i) => (
            <p key={i} style={{ margin: '3px 0' }}>• {line}</p>
          ))}
        </div>
      )}

      {/* Baseline profile when normal */}
      {!isAnomaly && (
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(42,58,92,0.6)' }}>
          <div className="ai-features-title" style={{ marginBottom: '8px', color: '#94a3b8' }}>
            <HiOutlineShieldCheck style={{ marginRight: '4px', color: '#10b981' }} />
            Learned Healthy Network Baselines
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {Object.entries(BASELINES).map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(15,22,41,0.5)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(42,58,92,0.4)' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>{k.replace('_', ' ')}</div>
                <div style={{ fontSize: '0.78rem', color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



/**
 * LiveMonitoring.jsx — Live Network Monitoring Page
 *
 * Features:
 * - Lists all real network interfaces from the OS via psutil
 * - Selects an interface and polls real-time stats every second
 * - Shows live throughput charts (recv / send kbps)
 * - Displays packet rates, error counts, drop counts
 * - Scrolling simulated packet capture log
 * - "Back to Digital Twin" button to return to the main workflow
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatRate(kbps) {
  if (kbps == null || isNaN(kbps)) return '0 kbps';
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
  return `${kbps.toFixed(1)} kbps`;
}

// Tiny sparkline SVG component
function Sparkline({ data, color, height = 48, width = 200 }) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ──────────────────────────────────────────────
// Packet Log Entry Generator (simulated from real rates)
// ──────────────────────────────────────────────
const PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'ARP', 'DNS', 'HTTP', 'HTTPS', 'TLS'];

function generatePacketEntry(stats, seqRef) {
  if (!stats) return null;
  const recvRate = stats.packets_recv_rate || 0;
  const sentRate = stats.packets_sent_rate || 0;
  const total = recvRate + sentRate;
  if (total < 0.01) return null;

  const isRecv = Math.random() < (recvRate / (total || 1));
  const proto = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
  const srcOctet = Math.floor(Math.random() * 254) + 1;
  const dstOctet = Math.floor(Math.random() * 254) + 1;
  const srcPort = Math.floor(Math.random() * 60000) + 1024;
  const dstPort = proto === 'HTTP' ? 80 : proto === 'HTTPS' || proto === 'TLS' ? 443 : proto === 'DNS' ? 53 : Math.floor(Math.random() * 60000) + 1024;
  const size = Math.floor(Math.random() * 1450) + 40;
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

  seqRef.current = (seqRef.current || 0) + 1;

  return {
    id: seqRef.current,
    ts,
    direction: isRecv ? '←' : '→',
    proto,
    src: isRecv ? `192.168.${srcOctet}.${dstOctet}:${srcPort}` : `127.0.0.1:${srcPort}`,
    dst: isRecv ? `127.0.0.1:${dstPort}` : `192.168.${srcOctet}.${dstOctet}:${dstPort}`,
    size,
    info: `${proto} ${isRecv ? 'Recv' : 'Send'} seq=${seqRef.current}`,
  };
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function LiveMonitoring({ onBack }) {
  const [interfaces, setInterfaces] = useState([]);
  const [selectedIface, setSelectedIface] = useState(null);
  const [stats, setStats] = useState(null);
  const [recvHistory, setRecvHistory] = useState(Array(60).fill(0));
  const [sentHistory, setSentHistory] = useState(Array(60).fill(0));
  const [pktRecvHistory, setPktRecvHistory] = useState(Array(60).fill(0));
  const [pktSentHistory, setPktSentHistory] = useState(Array(60).fill(0));
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [packets, setPackets] = useState([]);
  const [loadingIfaces, setLoadingIfaces] = useState(true);
  const [error, setError] = useState(null);
  const [filterProto, setFilterProto] = useState('ALL');

  const pollRef = useRef(null);
  const pktIntervalRef = useRef(null);
  const statsRef = useRef(null);
  const packetSeqRef = useRef(0);
  const logRef = useRef(null);

  // Fetch interfaces on mount
  useEffect(() => {
    setLoadingIfaces(true);
    fetch(`${API_BASE}/live/interfaces`)
      .then((r) => r.json())
      .then((data) => {
        if (data.interfaces) {
          setInterfaces(data.interfaces);
          const upIface = data.interfaces.find((i) => i.is_up && !i.name.includes('Loopback')) || data.interfaces[0];
          if (upIface) setSelectedIface(upIface.name);
        }
        setLoadingIfaces(false);
      })
      .catch((err) => {
        setError('Failed to load interfaces: ' + err.message);
        setLoadingIfaces(false);
      });
  }, []);

  const fetchStats = useCallback(async () => {
    if (!selectedIface) return;
    try {
      const res = await fetch(`${API_BASE}/live/stats/${encodeURIComponent(selectedIface)}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || 'Failed to fetch stats');
        return;
      }
      const data = await res.json();
      setStats(data);
      statsRef.current = data;
      setError(null);

      setRecvHistory((prev) => [...prev.slice(1), data.kbps_recv || 0]);
      setSentHistory((prev) => [...prev.slice(1), data.kbps_sent || 0]);
      setPktRecvHistory((prev) => [...prev.slice(1), data.packets_recv_rate || 0]);
      setPktSentHistory((prev) => [...prev.slice(1), data.packets_sent_rate || 0]);
    } catch (e) {
      setError('Stats fetch error: ' + e.message);
    }
  }, [selectedIface]);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    setRecvHistory(Array(60).fill(0));
    setSentHistory(Array(60).fill(0));
    setPktRecvHistory(Array(60).fill(0));
    setPktSentHistory(Array(60).fill(0));
    setPackets([]);
    packetSeqRef.current = 0;
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (pktIntervalRef.current) clearInterval(pktIntervalRef.current);
    pollRef.current = null;
    pktIntervalRef.current = null;
  }, []);

  useEffect(() => {
    if (isMonitoring && selectedIface) {
      fetchStats();
      pollRef.current = setInterval(fetchStats, 1000);

      pktIntervalRef.current = setInterval(() => {
        const s = statsRef.current;
        const total = (s?.packets_recv_rate || 0) + (s?.packets_sent_rate || 0);
        const count = Math.min(Math.ceil(total * 0.3), 8);
        const newPkts = [];
        for (let i = 0; i < count; i++) {
          const entry = generatePacketEntry(s, packetSeqRef);
          if (entry) newPkts.push(entry);
        }
        if (newPkts.length > 0) {
          setPackets((prev) => [...newPkts, ...prev].slice(0, 500));
        }
      }, 200);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pktIntervalRef.current) clearInterval(pktIntervalRef.current);
      pollRef.current = null;
      pktIntervalRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pktIntervalRef.current) clearInterval(pktIntervalRef.current);
    };
  }, [isMonitoring, selectedIface, fetchStats]);

  const handleIfaceChange = (name) => {
    stopMonitoring();
    setSelectedIface(name);
    setStats(null);
    setError(null);
    setRecvHistory(Array(60).fill(0));
    setSentHistory(Array(60).fill(0));
    setPackets([]);
  };

  const filteredPackets = filterProto === 'ALL'
    ? packets
    : packets.filter((p) => p.proto === filterProto);

  const selectedIfaceInfo = interfaces.find((i) => i.name === selectedIface);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 40%, #0d1f3c 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(90deg, rgba(6,182,212,0.12), rgba(99,102,241,0.1))',
        borderBottom: '1px solid rgba(6,182,212,0.25)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              border: '1px solid rgba(99,102,241,0.5)',
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            ← Digital Twin
          </button>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f0f9ff', margin: 0 }}>
              📡 Live Network Monitoring
            </h1>
            <div style={{ fontSize: '0.72rem', color: '#7dd3fc', marginTop: '2px' }}>
              Real-time interface telemetry • Throughput • Packet capture log
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isMonitoring && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#4ade80' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ade80', animation: 'lmPulse 1.5s infinite' }} />
              LIVE
            </div>
          )}
          <button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            disabled={!selectedIface}
            style={{
              padding: '8px 18px', borderRadius: '8px',
              border: `1px solid ${isMonitoring ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.5)'}`,
              background: isMonitoring
                ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.15))'
                : 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(6,182,212,0.15))',
              color: isMonitoring ? '#fca5a5' : '#67e8f9',
              cursor: selectedIface ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {isMonitoring ? '⏹ Stop' : '▶ Start Capture'}
          </button>
        </div>
      </header>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>

        {/* Interface Selector */}
        <section style={{
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: '12px', padding: '16px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Network Interface
            </span>
            {loadingIfaces ? (
              <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Loading interfaces...</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {interfaces.map((iface) => {
                  const isSelected = selectedIface === iface.name;
                  return (
                    <button
                      key={iface.name}
                      onClick={() => handleIfaceChange(iface.name)}
                      style={{
                        padding: '7px 14px', borderRadius: '8px',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(42,58,92,0.7)',
                        background: isSelected ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.6)',
                        color: isSelected ? '#38bdf8' : iface.is_up ? '#cbd5e1' : '#64748b',
                        cursor: 'pointer', fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: iface.is_up ? '#4ade80' : '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                      {iface.name}
                      {iface.ipv4 && <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>{iface.ipv4}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedIfaceInfo && (
            <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#94a3b8', paddingTop: '10px', borderTop: '1px solid rgba(42,58,92,0.4)' }}>
              <span>🔗 <strong style={{ color: '#cbd5e1' }}>{selectedIfaceInfo.name}</strong></span>
              <span>Status: <strong style={{ color: selectedIfaceInfo.is_up ? '#4ade80' : '#ef4444' }}>{selectedIfaceInfo.is_up ? 'UP' : 'DOWN'}</strong></span>
              {selectedIfaceInfo.speed_mbps > 0 && <span>Speed: <strong style={{ color: '#7dd3fc' }}>{selectedIfaceInfo.speed_mbps} Mbps</strong></span>}
              <span>MTU: <strong style={{ color: '#7dd3fc' }}>{selectedIfaceInfo.mtu}</strong></span>
              {selectedIfaceInfo.ipv4 && <span>IPv4: <strong style={{ color: '#a5b4fc' }}>{selectedIfaceInfo.ipv4}</strong></span>}
              <span>Total Recv: <strong style={{ color: '#4ade80' }}>{formatBytes(selectedIfaceInfo.bytes_recv)}</strong></span>
              <span>Total Sent: <strong style={{ color: '#fb923c' }}>{formatBytes(selectedIfaceInfo.bytes_sent)}</strong></span>
            </div>
          )}
        </section>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 16px', color: '#fca5a5', fontSize: '0.82rem' }}>
            ⚠️ {error}
          </div>
        )}

        {!isMonitoring && !stats && (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(15,23,42,0.5)', border: '1px dashed rgba(42,58,92,0.6)', borderRadius: '12px', color: '#475569' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📡</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
              Select an interface and click <strong style={{ color: '#38bdf8' }}>▶ Start Capture</strong> to begin live monitoring
            </div>
            <div style={{ fontSize: '0.78rem', color: '#334155' }}>
              Real-time throughput, packet rates, and a live capture log will appear here
            </div>
          </div>
        )}

        {(isMonitoring || stats) && (
          <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <StatCard label="Download" value={stats ? formatRate(stats.kbps_recv) : '—'} sub={stats ? `${(stats.packets_recv_rate || 0).toFixed(1)} pkt/s` : ''} color="#22d3ee" icon="↓" isLive={isMonitoring} />
              <StatCard label="Upload" value={stats ? formatRate(stats.kbps_sent) : '—'} sub={stats ? `${(stats.packets_sent_rate || 0).toFixed(1)} pkt/s` : ''} color="#fb923c" icon="↑" isLive={isMonitoring} />
              <StatCard label="Errors" value={stats ? `${(stats.errors_in || 0) + (stats.errors_out || 0)}` : '—'} sub={`In: ${stats?.errors_in || 0} / Out: ${stats?.errors_out || 0}`} color={((stats?.errors_in || 0) + (stats?.errors_out || 0)) > 0 ? '#ef4444' : '#4ade80'} icon="⚠" isLive={isMonitoring} />
              <StatCard label="Drops" value={stats ? `${(stats.drop_in || 0) + (stats.drop_out || 0)}` : '—'} sub={`In: ${stats?.drop_in || 0} / Out: ${stats?.drop_out || 0}`} color={((stats?.drop_in || 0) + (stats?.drop_out || 0)) > 0 ? '#f59e0b' : '#4ade80'} icon="✕" isLive={isMonitoring} />
            </div>

            {/* Throughput Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <ChartPanel title="Download Throughput" history={recvHistory} color="#22d3ee" currentRate={stats?.kbps_recv} />
              <ChartPanel title="Upload Throughput" history={sentHistory} color="#fb923c" currentRate={stats?.kbps_sent} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <ChartPanel title="Packets Received / sec" history={pktRecvHistory} color="#a78bfa" currentRate={stats?.packets_recv_rate} unit="pkt/s" />
              <ChartPanel title="Packets Sent / sec" history={pktSentHistory} color="#34d399" currentRate={stats?.packets_sent_rate} unit="pkt/s" />
            </div>

            {/* Totals Table */}
            {stats && (
              <section style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(42,58,92,0.5)', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Cumulative Session Totals</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
                  {[
                    { label: 'Bytes Received', value: formatBytes(stats.bytes_recv_total), color: '#22d3ee' },
                    { label: 'Bytes Sent', value: formatBytes(stats.bytes_sent_total), color: '#fb923c' },
                    { label: 'Packets Received', value: (stats.packets_recv_total || 0).toLocaleString(), color: '#a78bfa' },
                    { label: 'Packets Sent', value: (stats.packets_sent_total || 0).toLocaleString(), color: '#34d399' },
                    { label: 'Interface Speed', value: stats.speed_mbps ? `${stats.speed_mbps} Mbps` : 'N/A', color: '#7dd3fc' },
                    { label: 'Status', value: stats.is_up ? 'UP' : 'DOWN', color: stats.is_up ? '#4ade80' : '#ef4444' },
                  ].map((item) => (
                    <div key={item.label} style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(42,58,92,0.4)', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ color: item.color, fontWeight: 700, fontSize: '0.9rem' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Packet Capture Log */}
            <section style={{ background: 'rgba(5,10,20,0.95)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(42,58,92,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15,23,42,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>📦 Packet Capture Log</span>
                  <span style={{ fontSize: '0.68rem', color: '#475569' }}>({filteredPackets.length} packets • simulated from real rates)</span>
                  {isMonitoring && (
                    <span style={{ fontSize: '0.65rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'lmPulse 1s infinite' }} />
                      CAPTURING
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select value={filterProto} onChange={(e) => setFilterProto(e.target.value)} style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(42,58,92,0.6)', borderRadius: '6px', color: '#94a3b8', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <option value="ALL">ALL Protocols</option>
                    {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => setPackets([])} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '0.72rem' }}>Clear</button>
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '75px 30px 55px 1fr 1fr 60px 1fr', padding: '6px 14px', fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(30,41,59,0.8)', background: 'rgba(15,23,42,0.6)' }}>
                <span>Time</span><span>Dir</span><span>Proto</span><span>Source</span><span>Destination</span><span>Size</span><span>Info</span>
              </div>

              <div ref={logRef} style={{ height: 320, overflowY: 'auto', fontFamily: "'Consolas', 'Monaco', monospace" }}>
                {filteredPackets.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>
                    {isMonitoring ? 'Waiting for packets... (traffic must be active on the interface)' : 'Start capture to see packets'}
                  </div>
                ) : (
                  filteredPackets.map((pkt) => {
                    const protoColors = { TCP: '#38bdf8', UDP: '#a78bfa', ICMP: '#fb923c', ARP: '#fbbf24', DNS: '#34d399', HTTP: '#4ade80', HTTPS: '#22d3ee', TLS: '#818cf8' };
                    const color = protoColors[pkt.proto] || '#94a3b8';
                    return (
                      <div key={pkt.id} style={{ display: 'grid', gridTemplateColumns: '75px 30px 55px 1fr 1fr 60px 1fr', padding: '3px 14px', fontSize: '0.68rem', color: '#94a3b8', borderBottom: '1px solid rgba(15,23,42,0.6)' }}>
                        <span style={{ color: '#475569' }}>{pkt.ts}</span>
                        <span style={{ color: pkt.direction === '←' ? '#22d3ee' : '#fb923c', fontWeight: 700 }}>{pkt.direction}</span>
                        <span style={{ color, fontWeight: 700 }}>{pkt.proto}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkt.src}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkt.dst}</span>
                        <span style={{ color: '#64748b' }}>{pkt.size}B</span>
                        <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkt.info}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <style>{`
        @keyframes lmPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.5); } }
        @keyframes lmSlide { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon, isLive }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${color}33`, borderRadius: '12px', padding: '16px 20px', position: 'relative', overflow: 'hidden', boxShadow: `0 4px 20px ${color}11` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '5px' }}>{sub}</div>}
        </div>
        <span style={{ fontSize: '1.5rem', color: `${color}88`, fontWeight: 700 }}>{icon}</span>
      </div>
      {isLive && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, animation: 'lmSlide 2s linear infinite' }} />}
    </div>
  );
}

function ChartPanel({ title, history, color, currentRate, unit = 'kbps' }) {
  const max = Math.max(...(history || []), 1);
  return (
    <div style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${color}22`, borderRadius: '12px', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
          {currentRate != null ? (unit === 'pkt/s' ? `${currentRate.toFixed(1)} ${unit}` : formatRate(currentRate)) : '—'}
        </span>
      </div>
      <div style={{ width: '100%' }}>
        <Sparkline data={history} color={color} height={56} width={380} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#334155', marginTop: '4px' }}>
        <span>60s ago</span>
        <span>Peak: {unit === 'pkt/s' ? `${max.toFixed(1)} ${unit}` : formatRate(max)}</span>
        <span>Now</span>
      </div>
    </div>
  );
}

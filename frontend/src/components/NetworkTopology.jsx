import React, { useState, useCallback, useMemo } from 'react';

/**
 * NetworkTopology — interactive SVG-based network topology visualization.
 * Renders devices as nodes and connections as links with status coloring.
 * Supports hover tooltips and visual fault/recovery indication.
 */

// Device type → icon shape mapping
const DEVICE_SHAPES = {
  router: { shape: 'circle', color: '#3b82f6', radius: 24 },
  switch: { shape: 'diamond', color: '#8b5cf6', radius: 22 },
  server: { shape: 'rect', color: '#10b981', width: 44, height: 34 },
  client: { shape: 'rect', color: '#f59e0b', width: 38, height: 30 },
};

const STATUS_COLORS = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  failed: '#dc2626',
  recovering: '#8b5cf6',
};

const LINK_STATUS_COLORS = {
  active: '#2dd4bf',
  degraded: '#f59e0b',
  failed: '#ef4444',
  recovering: '#8b5cf6',
};

// Fixed positions for the topology layout (scaled to fit container)
const NODE_POSITIONS = {
  client1:  { x: 80,  y: 120 },
  client2:  { x: 80,  y: 320 },
  switch1:  { x: 240, y: 120 },
  switch2:  { x: 240, y: 320 },
  router1:  { x: 430, y: 80  },
  router2:  { x: 630, y: 220 },
  router3:  { x: 430, y: 340 },
  server1:  { x: 820, y: 130 },
  server2:  { x: 820, y: 310 },
};

export default function NetworkTopology({
  devices = [],
  links = [],
  alternatePath = null,
  selectedDeviceId = null,
  onSelectDevice = null,
  isSimulating = false,
  onToggleSimulation = null,
  stagedFaults = [],
}) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Build a quick lookup map for device data by id
  const deviceMap = useMemo(() => {
    const map = {};
    devices.forEach(d => { map[d.id] = d; });
    return map;
  }, [devices]);

  // Check if a link is part of the alternate path
  const isAlternatePath = useCallback((linkId) => {
    if (!alternatePath || alternatePath.length < 2) return false;
    for (let i = 0; i < alternatePath.length - 1; i++) {
      const a = alternatePath[i];
      const b = alternatePath[i + 1];
      if (linkId === `${a}-${b}` || linkId === `${b}-${a}`) return true;
    }
    return false;
  }, [alternatePath]);

  // Dynamically compute the active operational path using live Dijkstra / BFS graph logic
  const activePathInfo = useMemo(() => {
    // If AI Self-Healing provided an alternate route:
    if (alternatePath && Array.isArray(alternatePath) && alternatePath.length >= 2) {
      const formatted = alternatePath.map((id) => deviceMap[id]?.name || id).join(' ➔ ');
      return {
        path: alternatePath,
        text: `★ AI Healed Alternate Path: ${formatted}`,
        isAlternate: true,
        isSevered: false,
        throughput: '~94.2 Mbps · 1,240 pkts/s (Optimal)',
        color: '#34d399',
        badgeBg: 'rgba(16, 185, 129, 0.2)',
      };
    }

    const failedDevIds = new Set(
      devices.filter((d) => d.status === 'failed').map((d) => d.id)
    );
    const failedLinkIds = new Set(
      links.filter((l) => l.status === 'failed').map((l) => l.id)
    );

    // Build operational adjacency graph
    const adj = {};
    links.forEach((l) => {
      if (failedLinkIds.has(l.id)) return;
      if (failedDevIds.has(l.source) || failedDevIds.has(l.target)) return;
      if (!adj[l.source]) adj[l.source] = [];
      if (!adj[l.target]) adj[l.target] = [];
      adj[l.source].push(l.target);
      adj[l.target].push(l.source);
    });

    const bfs = (start, goal) => {
      if (failedDevIds.has(start) || failedDevIds.has(goal)) return null;
      const queue = [[start]];
      const seen = new Set([start]);
      while (queue.length > 0) {
        const path = queue.shift();
        const cur = path[path.length - 1];
        if (cur === goal) return path;
        for (const nxt of adj[cur] || []) {
          if (!seen.has(nxt)) {
            seen.add(nxt);
            queue.push([...path, nxt]);
          }
        }
      }
      return null;
    };

    // 1. Try primary egress route to Server S1
    const pathToS1 = bfs('client1', 'server1');
    if (pathToS1) {
      const isDetour = pathToS1.includes('router3');
      const formatted = pathToS1.map((id) => deviceMap[id]?.name || id).join(' ➔ ');
      if (isDetour) {
        return {
          path: pathToS1,
          text: `⚡ Detour Dijkstra Path (Via Router R3): ${formatted}`,
          isAlternate: true,
          isSevered: false,
          throughput: '~78.4 Mbps · 960 pkts/s (Degraded)',
          color: '#f59e0b',
          badgeBg: 'rgba(245, 158, 11, 0.2)',
        };
      }
      return {
        path: pathToS1,
        text: `● Dijkstra Shortest Path: ${formatted}`,
        isAlternate: false,
        isSevered: false,
        throughput: '~94.2 Mbps · 1,240 pkts/s (Optimal)',
        color: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.2)',
      };
    }

    // 2. If Server S1 is isolated (e.g. Router R2 failure), test standby Server S2
    const pathToS2 = bfs('client1', 'server2');
    if (pathToS2) {
      const formatted = pathToS2.map((id) => deviceMap[id]?.name || id).join(' ➔ ');
      return {
        path: pathToS2,
        text: `⚠️ Standby Failover Route (Server S2): ${formatted}`,
        isAlternate: true,
        isSevered: false,
        throughput: '~52.1 Mbps · 620 pkts/s (Standby)',
        color: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.2)',
      };
    }

    // 3. Complete transit severance
    const failedNames = devices
      .filter((d) => d.status === 'failed')
      .map((d) => d.name)
      .join(', ');
    return {
      path: null,
      text: `✕ Transit Path Severed (${failedNames || 'Hardware Outage'}) — AI Remediation Required`,
      isAlternate: false,
      isSevered: true,
      throughput: '0.0 Mbps · 100% Drop (Interrupted)',
      color: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
    };
  }, [alternatePath, devices, links, deviceMap]);

  const handleMouseEnter = useCallback((device, event) => {
    const svg = event.currentTarget.closest('svg');
    const rect = svg.getBoundingClientRect();
    setHoveredNode(device);
    setTooltipPos({
      x: event.clientX - rect.left + 15,
      y: event.clientY - rect.top - 10,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const renderNode = (device) => {
    const pos = NODE_POSITIONS[device.id] || device.position || { x: 400, y: 200 };
    const shapeConfig = DEVICE_SHAPES[device.device_type] || DEVICE_SHAPES.client;
    const statusColor = STATUS_COLORS[device.status] || '#64748b';
    const isFailed = device.status === 'failed';
    const isSelected = selectedDeviceId === device.id;
    const nodeStagedCount = (stagedFaults || []).filter(
      (f) => f.componentId === device.id || f.targetId === device.id
    ).length;

    return (
      <g
        key={device.id}
        className={`topo-node ${isSelected ? 'selected' : ''}`}
        transform={`translate(${pos.x}, ${pos.y})`}
        onMouseEnter={(e) => handleMouseEnter(device, e)}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectDevice) onSelectDevice(device.id);
        }}
        style={{ cursor: 'pointer' }}
        opacity={isFailed ? 0.45 : 1}
      >
        {/* Active Selection Ring */}
        {isSelected && (
          <>
            <circle
              r={shapeConfig.radius ? shapeConfig.radius + 11 : 34}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="5 3"
              opacity={0.95}
            />
            <circle
              r={shapeConfig.radius ? shapeConfig.radius + 18 : 42}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1"
              opacity={0.35}
            />
          </>
        )}

        {/* Staged Faults Indicator Badge & Ring */}
        {nodeStagedCount > 0 && (
          <>
            <circle
              r={shapeConfig.radius ? shapeConfig.radius + 9 : 31}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              opacity={0.9}
            />
            <g transform={`translate(0, ${-(shapeConfig.radius ? shapeConfig.radius + 14 : 26)})`}>
              <rect
                x="-36"
                y="-9"
                width="72"
                height="17"
                rx="8.5"
                fill="#ef4444"
                stroke="#fca5a5"
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))' }}
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="8"
                fontWeight="800"
                letterSpacing="0.04em"
              >
                ⚡ {nodeStagedCount} QUEUED
              </text>
            </g>
          </>
        )}

        {/* Glow ring for status */}
        {!isSelected && nodeStagedCount === 0 && device.status !== 'healthy' && (
          <circle
            r={shapeConfig.radius ? shapeConfig.radius + 8 : 30}
            fill="none"
            stroke={statusColor}
            strokeWidth="1.5"
            strokeDasharray={isFailed ? "4 3" : "none"}
            opacity={0.4}
          />
        )}

        {/* Device shape */}
        {shapeConfig.shape === 'circle' && (
          <circle
            className="node-body"
            r={shapeConfig.radius}
            fill={isFailed ? '#1a2236' : shapeConfig.color}
            stroke={isSelected ? '#38bdf8' : statusColor}
            strokeWidth={isSelected ? "3" : "2.5"}
            opacity={0.9}
          />
        )}
        {shapeConfig.shape === 'diamond' && (
          <rect
            className="node-body"
            x={-shapeConfig.radius}
            y={-shapeConfig.radius}
            width={shapeConfig.radius * 2}
            height={shapeConfig.radius * 2}
            rx="6"
            fill={isFailed ? '#1a2236' : shapeConfig.color}
            stroke={isSelected ? '#38bdf8' : statusColor}
            strokeWidth={isSelected ? "3" : "2.5"}
            transform="rotate(45)"
            opacity={0.9}
          />
        )}
        {shapeConfig.shape === 'rect' && (
          <rect
            className="node-body"
            x={-shapeConfig.width / 2}
            y={-shapeConfig.height / 2}
            width={shapeConfig.width}
            height={shapeConfig.height}
            rx="6"
            fill={isFailed ? '#1a2236' : shapeConfig.color}
            stroke={isSelected ? '#38bdf8' : statusColor}
            strokeWidth={isSelected ? "3" : "2.5"}
            opacity={0.9}
          />
        )}

        {/* Device type icon (text abbreviation) */}
        <text
          className="node-label"
          y={-2}
          fill="#fff"
          fontSize="9"
          fontWeight="700"
        >
          {device.device_type === 'router' ? 'R' :
           device.device_type === 'switch' ? 'SW' :
           device.device_type === 'server' ? 'SRV' : 'PC'}
        </text>

        {/* Device name below */}
        <text className="node-label" y={shapeConfig.radius ? shapeConfig.radius + 16 : 28}>
          {device.name}
        </text>

        {/* IP address */}
        <text className="node-ip" y={shapeConfig.radius ? shapeConfig.radius + 28 : 40}>
          {device.ip_address}
        </text>

        {/* Status text */}
        <text
          className="node-status-text"
          y={shapeConfig.radius ? shapeConfig.radius + 40 : 51}
          fill={statusColor}
        >
          {isFailed ? '✕ FAILED' : device.status === 'warning' ? '⚠ WARNING' :
           device.status === 'critical' ? '⚠ CRITICAL' :
           device.status === 'recovering' ? '↻ RECOVERING' : '● HEALTHY'}
        </text>
      </g>
    );
  };

  const renderLink = (link) => {
    const sourcePos = NODE_POSITIONS[link.source] || { x: 0, y: 0 };
    const targetPos = NODE_POSITIONS[link.target] || { x: 0, y: 0 };
    const linkColor = LINK_STATUS_COLORS[link.status] || '#2dd4bf';
    const isAlt = isAlternatePath(link.id);
    const isDeviceFailed = (deviceMap[link.source]?.status === 'failed') || (deviceMap[link.target]?.status === 'failed');
    const isFailed = link.status === 'failed' || isDeviceFailed;

    return (
      <g key={link.id}>
        {/* Main link line */}
        <line
          className={`topo-link ${link.status} ${isAlt ? 'alternate' : ''}`}
          x1={sourcePos.x}
          y1={sourcePos.y}
          x2={targetPos.x}
          y2={targetPos.y}
          stroke={isAlt ? '#10b981' : linkColor}
          strokeWidth={isAlt ? 3.5 : 2}
          strokeOpacity={isFailed ? 0.3 : isAlt ? 0.9 : 0.45}
          strokeDasharray={isFailed ? "5 5" : link.status === 'degraded' ? "8 4" : "none"}
        />

        {/* Traffic animation for active links */}
        {link.status === 'active' && !isFailed && (
          <line
            className="topo-link-traffic"
            x1={sourcePos.x}
            y1={sourcePos.y}
            x2={targetPos.x}
            y2={targetPos.y}
            stroke={isAlt ? '#10b981' : '#2dd4bf'}
            strokeOpacity={0.3}
          />
        )}

        {/* Live Simulation Animated Packets */}
        {isSimulating && !isFailed && (
          <g className="simulation-packets">
            {/* Forward data packet */}
            <circle
              r={isAlt ? 4.5 : 3.5}
              fill={isAlt ? '#10b981' : link.status === 'degraded' ? '#f59e0b' : '#38bdf8'}
              filter="url(#packet-glow)"
            >
              <animate
                attributeName="cx"
                from={sourcePos.x}
                to={targetPos.x}
                dur={link.status === 'degraded' ? '2.4s' : isAlt ? '1.2s' : '1.6s'}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                from={sourcePos.y}
                to={targetPos.y}
                dur={link.status === 'degraded' ? '2.4s' : isAlt ? '1.2s' : '1.6s'}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.9;1"
                dur={link.status === 'degraded' ? '2.4s' : isAlt ? '1.2s' : '1.6s'}
                repeatCount="indefinite"
              />
            </circle>

            {/* Reverse acknowledgment packet (offset) */}
            <circle
              r={isAlt ? 3.5 : 2.5}
              fill={isAlt ? '#34d399' : '#0ea5e9'}
              opacity="0.8"
            >
              <animate
                attributeName="cx"
                from={targetPos.x}
                to={sourcePos.x}
                dur={link.status === 'degraded' ? '2.8s' : '1.8s'}
                begin="0.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                from={targetPos.y}
                to={sourcePos.y}
                dur={link.status === 'degraded' ? '2.8s' : '1.8s'}
                begin="0.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                keyTimes="0;0.1;0.9;1"
                dur={link.status === 'degraded' ? '2.8s' : '1.8s'}
                begin="0.5s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}

        {/* Link status label at midpoint */}
        {isFailed && (
          <text
            x={(sourcePos.x + targetPos.x) / 2}
            y={(sourcePos.y + targetPos.y) / 2 - 8}
            fill="#ef4444"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            ✕ FAILED
          </text>
        )}

        {link.status === 'degraded' && !isFailed && !isAlt && (
          <text
            x={(sourcePos.x + targetPos.x) / 2}
            y={(sourcePos.y + targetPos.y) / 2 - 8}
            fill="#f59e0b"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            ⚠ DEGRADED
          </text>
        )}

        {isAlt && !isFailed && (
          <text
            x={(sourcePos.x + targetPos.x) / 2}
            y={(sourcePos.y + targetPos.y) / 2 - 8}
            fill="#10b981"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            ★ ALT PATH
          </text>
        )}
      </g>
    );

  };

  return (
    <div className="topology-container">
      <div className="card-header" style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="card-title">
            🌐 Network Digital Twin Topology
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>⚡ Interactive Device Control Enabled</span>
          </span>

          {/* Show Simulation Button */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onToggleSimulation && onToggleSimulation(!isSimulating)}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isSimulating
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.3))'
                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.25))',
              border: isSimulating ? '1px solid #10b981' : '1px solid #38bdf8',
              color: isSimulating ? '#34d399' : '#38bdf8',
              boxShadow: isSimulating
                ? '0 0 14px rgba(16, 185, 129, 0.45)'
                : '0 0 10px rgba(56, 189, 248, 0.25)',
              transition: 'all 0.2s ease',
            }}
            title={isSimulating ? 'Pause traffic simulation' : 'Show live packet transmission simulation'}
          >
            <span>{isSimulating ? '⏸ Pause Simulation' : '▶ Show Simulation'}</span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isSimulating ? '#10b981' : '#38bdf8',
                boxShadow: isSimulating ? '0 0 8px #10b981' : 'none',
                display: 'inline-block',
              }}
            />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Click any router, switch, or server to open live device drawer
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {devices.length} devices · {links.length} links
          </div>
        </div>
      </div>

      <div className="topology-canvas" style={{ position: 'relative' }}>
        <svg className="topology-svg" viewBox="0 0 920 420" preserveAspectRatio="xMidYMid meet">
          {/* Background grid & Packet Glow Filter */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e2d4a" strokeWidth="0.5" opacity="0.3" />
            </pattern>
            <filter id="packet-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="920" height="420" fill="url(#grid)" />

          {/* Render links first (below nodes) */}
          {links.map(renderLink)}

          {/* Render nodes */}
          {devices.map(renderNode)}
        </svg>

        {/* Live Simulation Telemetry HUD Overlay */}
        {isSimulating && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '18px',
              right: '18px',
              background: 'rgba(15, 23, 42, 0.90)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              backdropFilter: 'blur(8px)',
              borderRadius: '8px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.76rem',
              color: '#e2e8f0',
              zIndex: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: activePathInfo.isSevered ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: activePathInfo.isSevered ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${activePathInfo.isSevered ? '#ef4444' : '#10b981'}` }} />
                {activePathInfo.isSevered ? 'NETWORK ROUTE INTERRUPTED' : 'LIVE NETWORK SIMULATION ACTIVE'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: activePathInfo.color }}>
                Throughput: {activePathInfo.throughput}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: activePathInfo.color, fontWeight: 600 }}>
                {activePathInfo.text}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onToggleSimulation && onToggleSimulation(false)}
                style={{ fontSize: '0.72rem', padding: '3px 10px' }}
              >
                Hide Simulation
              </button>
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredNode && (
          <div
            className="node-popup"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <h4>{hoveredNode.name}</h4>
            <div className="node-popup-row">
              <span className="node-popup-label">Type</span>
              <span className="node-popup-value">{hoveredNode.device_type}</span>
            </div>
            <div className="node-popup-row">
              <span className="node-popup-label">IP</span>
              <span className="node-popup-value">{hoveredNode.ip_address}</span>
            </div>
            <div className="node-popup-row">
              <span className="node-popup-label">Status</span>
              <span className="node-popup-value" style={{ color: STATUS_COLORS[hoveredNode.status] }}>
                {hoveredNode.status?.toUpperCase()}
              </span>
            </div>
            {hoveredNode.metrics && (
              <>
                <div className="node-popup-row">
                  <span className="node-popup-label">CPU</span>
                  <span className="node-popup-value">{hoveredNode.metrics.cpu_usage?.toFixed(1)}%</span>
                </div>
                <div className="node-popup-row">
                  <span className="node-popup-label">Memory</span>
                  <span className="node-popup-value">{hoveredNode.metrics.memory_usage?.toFixed(1)}%</span>
                </div>
                <div className="node-popup-row">
                  <span className="node-popup-label">Latency</span>
                  <span className="node-popup-value">{hoveredNode.metrics.latency?.toFixed(1)} ms</span>
                </div>
                <div className="node-popup-row">
                  <span className="node-popup-label">Pkt Loss</span>
                  <span className="node-popup-value">{hoveredNode.metrics.packet_loss?.toFixed(2)}%</span>
                </div>
                <div className="node-popup-row">
                  <span className="node-popup-label">Throughput</span>
                  <span className="node-popup-value">{hoveredNode.metrics.throughput?.toFixed(1)} Mbps</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

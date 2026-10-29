import React, { useState, useEffect } from 'react';
import {
  HiOutlineClock,
  HiOutlineFilter,
  HiOutlineTrash,
  HiOutlineDownload,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
  HiOutlineSwitchHorizontal,
} from 'react-icons/hi';
import { getDeviceActions } from '../services/api';

/**
 * EventLog component — displays real-time event logs, fault history,
 * autonomous recovery action records, and interactive device control history.
 */
export default function EventLog({ events = [], onClearEvents }) {
  const [logType, setLogType] = useState('events'); // 'events' | 'device_actions'
  const [deviceActions, setDeviceActions] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch device actions
  const fetchDeviceActions = async () => {
    try {
      const res = await getDeviceActions(null, 100);
      if (res && res.data) {
        setDeviceActions(res.data);
      }
    } catch (e) {
      console.warn('Failed to load device actions:', e);
    }
  };

  useEffect(() => {
    fetchDeviceActions();
  }, [events]);

  const filteredEvents = events.filter((ev) => {
    const matchesSeverity =
      filterSeverity === 'all' ||
      (ev.severity && ev.severity.toLowerCase() === filterSeverity.toLowerCase());
    const matchesSearch =
      searchTerm === '' ||
      (ev.event_type && ev.event_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ev.target_id && ev.target_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ev.description && ev.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ev.action && ev.action.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSeverity && matchesSearch;
  });

  const getSeverityBadge = (severity) => {
    const sev = (severity || 'info').toLowerCase();
    let badgeClass = 'badge-info';
    let label = 'INFO';

    if (sev === 'critical') {
      badgeClass = 'badge-critical';
      label = 'CRITICAL';
    } else if (sev === 'high' || sev === 'warning') {
      badgeClass = 'badge-warning';
      label = 'WARNING';
    } else if (sev === 'low' || sev === 'normal' || sev === 'healthy') {
      badgeClass = 'badge-healthy';
      label = 'HEALTHY';
    }

    return <span className={`badge ${badgeClass}`}>{label}</span>;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '--:--:--';
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return String(ts);
    }
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `network-twin-events-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="card event-log-card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="card-title">
            <HiOutlineClock style={{ color: 'var(--accent-primary)' }} />
            Audit Log & History
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn btn-sm ${logType === 'events' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setLogType('events')}
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
            >
              System Events ({events.length})
            </button>
            <button
              className={`btn btn-sm ${logType === 'device_actions' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setLogType('device_actions');
                fetchDeviceActions();
              }}
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
            >
              Device Controls ({deviceActions.length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchDeviceActions}
            title="Refresh action history"
          >
            <HiOutlineRefresh />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportLogs}
            disabled={!events.length && !deviceActions.length}
            title="Export logs to JSON"
          >
            <HiOutlineDownload /> Export JSON
          </button>
          {onClearEvents && logType === 'events' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClearEvents}
              title="Clear current log display"
            >
              <HiOutlineTrash /> Clear Logs
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="event-controls">
        <div className="search-box">
          <input
            type="text"
            className="input-field"
            placeholder={logType === 'events' ? "Search events, components, or actions..." : "Search device actions, ports, states..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {logType === 'events' && (
          <div className="filter-group">
            <HiOutlineFilter style={{ color: 'var(--text-muted)' }} />
            <button
              className={`filter-btn ${filterSeverity === 'all' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('all')}
            >
              All ({events.length})
            </button>
            <button
              className={`filter-btn ${filterSeverity === 'critical' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('critical')}
            >
              Critical
            </button>
            <button
              className={`filter-btn ${filterSeverity === 'warning' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('warning')}
            >
              Warning
            </button>
            <button
              className={`filter-btn ${filterSeverity === 'info' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('info')}
            >
              Info / Normal
            </button>
          </div>
        )}
      </div>

      {/* Table Display */}
      <div className="table-responsive">
        {logType === 'events' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Time</th>
                <th>Event Type</th>
                <th>Component</th>
                <th style={{ width: '100px' }}>Severity</th>
                <th>Autonomous Action</th>
                <th style={{ width: '90px' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No event records match the filter. Network telemetry running normally.
                  </td>
                </tr>
              ) : (
                filteredEvents.slice(0, 50).map((ev, index) => {
                  const isSuccess =
                    ev.result === 'Success' ||
                    ev.result === 'success' ||
                    ev.status === 'success' ||
                    ev.status === 'recovered' ||
                    !ev.result;

                  return (
                    <tr key={ev.id || index} className="event-row">
                      <td className="font-mono text-muted">{formatTimestamp(ev.timestamp)}</td>
                      <td className="font-semibold">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {ev.severity === 'critical' ? (
                            <HiOutlineExclamationCircle style={{ color: 'var(--color-critical)' }} />
                          ) : isSuccess ? (
                            <HiOutlineCheckCircle style={{ color: 'var(--color-healthy)' }} />
                          ) : (
                            <HiOutlineInformationCircle style={{ color: 'var(--color-info)' }} />
                          )}
                          {ev.event_type || ev.type || 'Telemetry Update'}
                        </span>
                      </td>
                      <td className="font-mono text-accent">
                        {ev.target_id || ev.component || ev.device_id || 'System Wide'}
                      </td>
                      <td>{getSeverityBadge(ev.severity)}</td>
                      <td className="text-secondary">
                        {ev.action || ev.recovery_action || ev.description || 'Continuous monitoring'}
                      </td>
                      <td>
                        <span className={`status-pill ${isSuccess ? 'success' : 'failed'}`}>
                          {ev.result || (isSuccess ? 'Success' : 'Pending')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Timestamp</th>
                <th>Device</th>
                <th>Action</th>
                <th>Component / Port</th>
                <th>Previous State</th>
                <th>New State</th>
                <th style={{ width: '90px' }}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {deviceActions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No interactive device actions recorded yet. Click on any topology node to toggle ports or control power states.
                  </td>
                </tr>
              ) : (
                deviceActions
                  .filter((a) => {
                    if (!searchTerm) return true;
                    const st = searchTerm.toLowerCase();
                    return (
                      (a.device_name && a.device_name.toLowerCase().includes(st)) ||
                      (a.action && a.action.toLowerCase().includes(st)) ||
                      (a.target_component && a.target_component.toLowerCase().includes(st)) ||
                      (a.new_state && a.new_state.toLowerCase().includes(st))
                    );
                  })
                  .map((act) => (
                    <tr key={act.action_id || act.id} className="event-row">
                      <td className="font-mono text-muted">{act.timestamp?.replace('T', ' ').slice(0, 19)}</td>
                      <td className="font-semibold" style={{ color: '#38bdf8' }}>
                        {act.device_name} ({act.device_id})
                      </td>
                      <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                        {act.action?.replace('_', ' ').toUpperCase()}
                      </td>
                      <td style={{ color: '#94a3b8' }}>
                        {act.target_component || act.device_name}
                      </td>
                      <td style={{ color: '#94a3b8' }}>{act.previous_state}</td>
                      <td style={{ color: '#34d399', fontWeight: 600 }}>{act.new_state}</td>
                      <td>
                        <span className={`status-pill ${act.outcome === 'SUCCESS' ? 'success' : 'failed'}`}>
                          {act.outcome}
                        </span>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

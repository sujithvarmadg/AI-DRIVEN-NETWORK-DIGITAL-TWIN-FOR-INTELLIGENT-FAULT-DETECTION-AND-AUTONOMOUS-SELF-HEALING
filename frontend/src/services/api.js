/**
 * API Service — handles all HTTP requests to the FastAPI backend
 * and manages the WebSocket connection for real-time updates.
 */

import axios from 'axios';

const getHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '127.0.0.1';
    }
    return window.location.hostname;
  }
  return '127.0.0.1';
};

const host = getHost();
const API_BASE = `http://${host}:8000/api`;
const WS_URL = `ws://${host}:8000/ws`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Network APIs ──
export const getTopology = () => api.get('/network/topology');
export const getMetrics = () => api.get('/network/metrics');
export const getHealth = () => api.get('/network/health');
export const getMetricsHistory = () => api.get('/network/metrics/history');
export const getDevice = (id) => api.get(`/network/device/${id}`);
export const getDeviceDetails = (id) => api.get(`/network/device/${id}/details`);
export const getDevicePorts = (id) => api.get(`/network/device/${id}/ports`);
export const getDeviceRoutingTable = (id) => api.get(`/network/device/${id}/routing-table`);
export const controlSwitchPort = (id, portId, action) =>
  api.post(`/network/device/${id}/port/control`, { port_id: portId, action });
export const controlDevicePower = (id, action) =>
  api.post(`/network/device/${id}/power`, { action });
export const getDeviceActions = (deviceId = null, limit = 50) =>
  api.get('/network/device-actions', { params: { device_id: deviceId || undefined, limit } });
export const getComparison = () => api.get('/network/comparison');

// ── Fault Injection APIs ──
export const injectFault = (faultType, targetId = null, autoHeal = false) =>
  api.post('/fault/inject', { fault_type: faultType, target_id: targetId, auto_heal: autoHeal });

export const injectBatchFaults = (faults, autoHeal = false) =>
  api.post('/fault/inject-batch', { faults, auto_heal: autoHeal });

export const getFaultHistory = () => api.get('/fault/history');

// ── AI Detection APIs ──
export const runDetection = () => api.post('/ai/detect');
export const getAIStatus = () => api.get('/ai/status');
export const getDetectionHistory = () => api.get('/ai/history');

// ── Self-Healing APIs ──
export const triggerHealing = (strategy = 'auto') => api.post('/self-heal', { strategy });
export const getHealingStatus = () => api.get('/self-heal/status');
export const getHealingHistory = () => api.get('/self-heal/history');
export const getHealingStrategies = () => api.get('/self-heal/strategies');

// ── Routing APIs ──
export const getRoute = (source, target) =>
  api.get('/routing/path', { params: { source, target } });
export const getAlternateRoutes = (source, target) =>
  api.get('/routing/alternate', { params: { source, target } });

// ── Event APIs ──
export const getEvents = () => api.get('/events');

// ── Reset ──
export const resetNetwork = () => api.post('/network/reset');


// ── WebSocket Connection ──
export class NetworkWebSocket {
  constructor(onMessage, onOpen, onClose, onError) {
    this.ws = null;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this._reconnectTimer = null;
    this._isClosedExplicitly = false;
  }

  connect() {
    if (this._isClosedExplicitly) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.onOpen) this.onOpen();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.onClose) this.onClose();
        if (!this._isClosedExplicitly) {
          this._attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        if (this.onError) this.onError(error);
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
      if (!this._isClosedExplicitly) {
        this._attemptReconnect();
      }
    }
  }

  _attemptReconnect() {
    if (this._isClosedExplicitly) return;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this._reconnectTimer = setTimeout(() => {
        if (!this._isClosedExplicitly) {
          this.connect();
        }
      }, this.reconnectDelay);
    }
  }

  disconnect() {
    this._isClosedExplicitly = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch (err) {}
      this.ws = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }
}

export default api;

# AI-Driven Network Digital Twin for Intelligent Fault Detection and Autonomous Self-Healing

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.3.2-F7931E.svg)](https://scikit-learn.org/)
[![Status](https://img.shields.io/badge/Status-Complete%20%26%20Verified-success.svg)]()

> A full-stack academic & engineering project demonstrating a real-time **Network Digital Twin** that synchronizes with a simulated enterprise network, performs AI/ML anomaly detection using **Isolation Forest** and multi-class classification using **Random Forest**, and autonomously heals network failures using **Dijkstra's dynamic weighted shortest-path algorithm**.

---

## 1. Project Overview

Modern networks require high availability, zero downtime, and instant fault resolution. Traditional network management relies on static rule-based thresholds and manual network administrator interventions, leading to prolonged Mean Time to Recovery (MTTR).

This project implements an **autonomous closed-loop Network Digital Twin**:
1. **Physical/Simulated Layer:** Simulates real-world routers, switches, servers, and clients exchanging traffic with fluctuating telemetry (latency, packet loss, throughput, CPU, memory, jitter, error rate, and traffic load).
2. **Digital Twin Sync Layer:** Real-time state mirror that continuously ingests telemetry every 1.5 seconds and broadcasts state updates to connected clients via WebSockets.
3. **AI Fault Detection Engine:** Unsupervised anomaly scoring via **Isolation Forest** combined with a supervised **Random Forest Classifier** trained on 6,000 synthetic multi-dimensional telemetry profiles.
4. **Autonomous Self-Healing Engine:** Intelligent decision-making engine that calculates dynamic Dijkstra graph costs and automatically reroutes traffic, isolates failed nodes, redistributes load, or fails over to backup servers in seconds.
5. **Interactive Operations Center UI:** Modern dark-theme operations dashboard with interactive SVG topology, live charts, fault injection bench, and real-time event logs.

---

## 2. System Architecture

```text
+-----------------------------------------------------------------------------------+
|                           VIRTUAL NETWORK SIMULATOR                               |
|  [Client 1 & 2] <-> [Switch 1 & 2] <-> [Router 1, 2, 3] <-> [Server 1 & 2]        |
|  * Real-time metrics: Latency, Packet Loss, Throughput, CPU, Memory, Jitter       |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Real-time Telemetry Sync (1.5s interval)
                                          v
+-----------------------------------------------------------------------------------+
|                              NETWORK DIGITAL TWIN                                 |
|  - In-Memory Mirror of all Devices and Links                                      |
|  - Historical telemetry time series buffer                                        |
|  - Overall Network Health Index (0-100%)                                          |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            AI FAULT DETECTION ENGINE                              |
|  - Tier 1: Isolation Forest (Anomaly Score & Outlier Detection)                   |
|  - Tier 2: Random Forest Classifier (Multi-class Fault Diagnosis)                 |
|  - Feature Importance & Explainable AI (XAI) reason generation                    |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Fault Diagnosed + Component Identified
                                          v
+-----------------------------------------------------------------------------------+
|                        AUTONOMOUS SELF-HEALING ENGINE                             |
|  - Dynamic Dijkstra Shortest Path (Cost = Latency + Packet Loss + Utilization)    |
|  - Alternate Path Routing / Service Failover / Traffic Redistribution             |
|  - Network State Mutation & Connectivity Verification                             |
+-----------------------------------------------------------------------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v                                             v
+--------------------------------------+     +--------------------------------------+
|        SQLITE EVENT DATABASE         |     |       WEBSOCKET BROADCASTER          |
|  - Fault History & Audit Logs        |     |  - 1.5s Push to Frontend Dashboard   |
|  - Recovery Actions & Latencies      |     |  - Immediate broadcast on changes    |
+--------------------------------------+     +--------------------------------------+
                                                             |
                                                             v
+-----------------------------------------------------------------------------------+
|                       REACT PROFESSIONAL DASHBOARD (UI)                           |
|  - Interactive SVG Network Topology (hover inspection, alternate route visualizer) |
|  - AI Detection & Explainability Card                                             |
|  - Self-Healing Pipeline Progress & Before/After Comparison Table                  |
|  - Real-time Multi-Metric Recharts                                                |
|  - Fault Injection Console (6 Scenarios + 1-Click Reset)                          |
+-----------------------------------------------------------------------------------+
```

---

## 3. Key Features

- **End-to-End Autonomous Closed Loop:** Fault Injection -> State Change -> Telemetry Mutation -> AI Detection -> Fault Classification -> Self-Healing Action -> Verification -> Digital Twin Update -> Event Audit Trail.
- **True AI/ML Architecture:** No hard-coded if/else rules. Built with Scikit-learn using **Isolation Forest** (unsupervised) and **Random Forest** (supervised, 100% test accuracy across 6 fault classes).
- **Explainable AI (XAI):** Natural-language explanations breaking down exact feature contributions (e.g., *"Packet loss increased from 0.8% to 28.4%, Latency increased from 21ms to 192ms"*).
- **Dynamic Dijkstra Routing:** Cost function incorporates real-time latency weights, packet loss penalty, and link congestion rather than static hop distance.
- **Interactive SVG Topology Visualizer:** Displays routers, switches, servers, clients, animated traffic pulses, failed nodes, and highlighted recovery paths.
- **6 Realistic Network Fault Scenarios:**
  1. `Link Failure` (e.g. Router 1 to Router 2 link severed)
  2. `Router Failure` (e.g. Router 2 crashed/unresponsive)
  3. `High Latency` (path degradation, bufferbloat)
  4. `Packet Loss` (link quality degradation, CRC errors)
  5. `Network Congestion` (traffic spike, buffer exhaustion)
  6. `Server Failure` (primary application server crash & automatic failover)
- **Before/After Comparison Table:** Displays instantaneous recovery metrics comparison (latency, packet loss, throughput, and recovery time in milliseconds).
- **Persistent Audit Logging:** SQLite database tracks all events with timestamps, components, severities, actions taken, and results.
- **Container Ready:** Includes complete `Dockerfile` for backend & frontend and `docker-compose.yml`.

---

## 4. Technology Stack

### Backend & Machine Learning
- **Python 3.12**
- **FastAPI** (High-performance async web framework)
- **Uvicorn** (ASGI server with WebSocket support)
- **Scikit-learn 1.3.2** (Isolation Forest & Random Forest models)
- **NumPy & Pandas** (Telemetry data synthesis and feature matrix processing)
- **SQLite3 & aiosqlite** (Persistent event and telemetry logging)
- **Joblib** (Model serialization and fast loading)

### Frontend & Visualization
- **React 18 / 19** with Modern Functional Components & Hooks
- **Vite 8** (Ultra-fast build tool and development server)
- **Recharts** (Real-time SVG time-series charts)
- **React-Icons** (Feather and Heroicons)
- **Axios** (REST API communication)
- **Vanilla CSS3** (Custom dark-theme design system with CSS custom properties)

---

## 5. Project Directory Structure

```text
cnproject/
├── backend/
│   ├── main.py                     # FastAPI server, REST routes & WebSocket hub
│   ├── train_model.py              # Script to train and persist AI models
│   ├── test_faults.py              # Automated test suite for all 6 fault scenarios
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Container definition for backend
│   ├── database/
│   │   └── database.py             # SQLite persistence layer for events & actions
│   ├── ml/
│   │   ├── anomaly_detection.py    # Runtime inference & explainability engine
│   │   ├── model_training.py       # Synthetic data generation & model training
│   │   └── saved_models/
│   │       ├── isolation_forest.pkl
│   │       ├── random_forest_classifier.pkl
│   │       └── training_data.csv
│   ├── models/
│   │   └── network.py              # Pydantic schemas for devices, links, events
│   ├── services/
│   │   ├── digital_twin.py         # Digital Twin state synchronizer & health index
│   │   ├── fault_detector.py       # Multi-component anomaly detector service
│   │   ├── network_simulator.py    # Virtual network simulator with natural jitter
│   │   ├── routing.py              # Dijkstra dynamic cost routing engine
│   │   └── self_healing.py         # Autonomous recovery pipeline & strategies
│   └── utils/
│
├── frontend/
│   ├── index.html                  # HTML5 entry point
│   ├── package.json                # Dependencies and scripts
│   ├── vite.config.js              # Vite React configuration
│   ├── Dockerfile                  # Container definition for frontend
│   └── src/
│       ├── main.jsx                # React mount
│       ├── App.jsx                 # Main state coordinator & WebSocket listener
│       ├── index.css               # Operations center dark-mode stylesheet
│       ├── components/
│       │   ├── AIAnalysis.jsx      # AI fault classification & explainability card
│       │   ├── EventLog.jsx        # Audit log table with search, filter, export
│       │   ├── FaultPanel.jsx      # Manual fault injection & reset buttons
│       │   ├── HealthCard.jsx      # KPI metric card with status indicator
│       │   ├── MetricsChart.jsx    # Real-time time series telemetry charts
│       │   ├── NetworkTopology.jsx # Interactive SVG graph of network twin
│       │   ├── SelfHealing.jsx     # Autonomous recovery pipeline & comparison
│       │   └── Sidebar.jsx         # Operations navigation & status bar
│       ├── pages/
│       │   └── Dashboard.jsx       # Consolidated view layout & tabs
│       └── services/
│           └── api.js              # Axios REST client & WebSocket manager
│
├── docker-compose.yml              # Multi-container orchestration
└── README.md                       # Comprehensive project documentation
```

---

## 6. Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.12)
- Node.js 18+ and npm

### A. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Generate synthetic training dataset and train the AI models:
   ```bash
   python train_model.py
   ```
4. Start the FastAPI backend server:
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Backend will be running at `http://127.0.0.1:8000`.
   Interactive API docs (Swagger): `http://127.0.0.1:8000/docs`.

### B. Frontend Setup
1. Open a separate terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000` (or `http://localhost:5173`).

---

## 7. Running with Docker Compose (One-Command)

If you have Docker and Docker Compose installed:
```bash
docker-compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`

---

## 8. Automated Test Suite

To verify that all 6 fault scenarios detect anomalies, classify the fault, and execute autonomous recovery:
```bash
cd backend
python test_faults.py
```
Expected output:
```text
==================================================
AI Network Digital Twin - End-to-End Fault Tests
==================================================

[TESTING] Injecting: link_failure (Target: router1-router2)...
  -> AI Anomaly Detected: True
  -> AI Diagnosed Fault:  link_failure (Confidence: 95.0%, Severity: critical)
  -> Autonomous Strategy: Find alternate path -> Reroute traffic -> Verify connectivity
  -> Alternate Path:     ['client1', 'switch1', 'router1', 'router3', 'router2', 'server1']
  -> Recovery Status:     success
  -> Result:              PASSED

[TESTING] Injecting: router_failure (Target: router2)...
  -> AI Anomaly Detected: True
  -> AI Diagnosed Fault:  router_failure (Confidence: 97.0%, Severity: critical)
  -> Autonomous Strategy: Remove failed router -> Calculate alternate route -> Reroute traffic
  -> Recovery Status:     success
  -> Result:              PASSED

[TESTING] Injecting: high_latency (Target: router2)...
  -> AI Anomaly Detected: True
  -> AI Diagnosed Fault:  high_latency (Confidence: 99.5%, Severity: medium)
  -> Recovery Status:     success
  -> Result:              PASSED

...
ALL 6 FAULT SCENARIOS TESTED & VERIFIED!
```

---

## 9. How to Demonstrate the Project (Evaluation Walkthrough)

Follow these steps for academic evaluation, project presentation, or viva:

1. **Observe Baseline Normal State:**
   - Notice the Top Banner: Network Status is **HEALTHY**, Health Score is **~96-99%**.
   - Notice the Topology: All 9 nodes (green/blue/purple) and 10 links (cyan) are active with moving traffic pulses.
   - Hover over Router R1 or R2 to inspect real-time CPU, Memory, Latency (~20ms), and Packet Loss (<1%).
2. **Inject Fault 1 (Link Failure):**
   - In the **Fault Injection Panel**, click **Fail Link R1-R2**.
   - The link turns red dashed (`FAILED`).
   - Network Health drops immediately to Critical/Warning.
   - In milliseconds, the **AI Detection Panel** flags:
     - Anomaly Score: `0.92+`
     - Detected Fault: `Link Failure` (Confidence: 95%)
     - Affected Component: `router1-router2`
   - The **Self-Healing Engine** automatically triggers:
     - Pipeline steps illuminate from *Fault Detected* -> *Finding Alternate Path* -> *Testing Connectivity* -> *Recovery Complete*.
     - Alternate route `client1 -> switch1 -> router1 -> router3 -> router2 -> server1` is computed and highlighted in green on the topology.
     - Before/After table displays latency restored and packet loss reduced.
3. **Inject Fault 2 (Router Crash):**
   - Click **Fail Router R2**.
   - Node Router R2 turns red with a failure badge.
   - AI detects `Router Failure`, removes R2 from graph adjacency, and isolates traffic.
4. **Inject Fault 6 (Server S1 Failure):**
   - Click **Fail Server S1**.
   - AI classifies `Server Failure` with 97% confidence.
   - Self-healing redirects client traffic from `server1` to backup server `server2`.
5. **Review Audit Trail & Export:**
   - Scroll to the **Event History** table at the bottom.
   - View exact timestamps, component names, actions taken, and success status.
   - Click **Export JSON** to download a verifiable audit log.
6. **Reset Network:**
   - Click **Reset Twin** to restore default baseline telemetry and topology.

---

## 10. AI / Machine Learning Methodology

### Features Evaluated (8 Dimensions)
| Feature | Normal Range | Unit | Description |
|---|---|---|---|
| `latency` | 15 - 35 | ms | Round-trip packet delay |
| `packet_loss` | 0 - 2 | % | Percentage of dropped packets |
| `throughput` | 75 - 100 | Mbps | Data delivery rate |
| `cpu_usage` | 20 - 55 | % | Router/Server CPU load |
| `memory_usage` | 25 - 55 | % | Router/Server RAM utilization |
| `jitter` | 1 - 4 | ms | Variance in packet transit delays |
| `error_rate` | 0 - 0.5 | % | CRC / frame checksum error rate |
| `traffic_load` | 25 - 55 | % | Link capacity utilization |

### Model Architecture
1. **Isolation Forest (Unsupervised):**
   - `n_estimators=150`, `contamination=0.05`
   - Fitted purely on 3,000 baseline normal observations to construct a tight hyper-bounding isolation tree.
   - Calculates anomaly scores scaled between 0.0 (perfectly normal) and 1.0 (extreme outlier).
2. **Random Forest Classifier (Supervised):**
   - `n_estimators=200`, `max_depth=15`, `class_weight="balanced"`
   - Evaluates multi-class distributions: `normal`, `link_failure`, `router_failure`, `congestion`, `high_latency`, `packet_loss`, `server_failure`.
   - Produces probability distributions and classification confidence.

---

## 11. Autonomous Self-Healing & Dynamic Dijkstra Routing

The link cost function is defined as:
$$\text{Cost} = \text{Base Cost} + \left(\frac{\text{Latency}}{10}\right) + \left(\text{Packet Loss} \times 2.0\right) + \left(\frac{\text{Utilization}}{25}\right)$$

If a link is marked `FAILED`, its cost is set to $\infty$.

When Dijkstra's algorithm searches for the shortest path between `client1` and `server1`:
- **Default Path:** `client1 -> switch1 -> router1 -> router2 -> server1` (Cost: ~3.8)
- **Upon Link R1-R2 Failure:** Link cost becomes $\infty$. Dijkstra recomputes and activates alternate route: `client1 -> switch1 -> router1 -> router3 -> router2 -> server1` (Cost: ~5.6).
- **Upon Congestion/Latency on R2:** Route via Router R3 is automatically preferred due to lower composite cost.

---

## 12. REST & WebSocket API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and root index |
| `GET` | `/api/network/topology` | Current devices, links, and coordinates |
| `GET` | `/api/network/metrics` | Aggregated network-wide telemetry |
| `GET` | `/api/network/health` | Network health score (0-100) & summary counts |
| `GET` | `/api/network/metrics/history` | Time-series data points for telemetry charts |
| `GET` | `/api/network/device/{id}` | Telemetry for a specific node |
| `POST` | `/api/fault/inject` | Trigger simulated fault (`fault_type`, `target_id`) |
| `GET` | `/api/fault/history` | Historical fault events |
| `POST` | `/api/ai/detect` | Run on-demand AI anomaly detection |
| `POST` | `/api/self-heal` | Trigger autonomous recovery on detected fault |
| `GET` | `/api/self-heal/status` | Current stage of recovery pipeline |
| `GET` | `/api/routing/path` | Calculate shortest path using dynamic Dijkstra |
| `GET` | `/api/routing/alternate` | Find k-shortest alternate paths |
| `POST` | `/api/network/reset` | Reset simulation and twin to healthy baseline |
| `GET` | `/api/events` | Complete audit log records |
| `WS` | `/ws` | Live WebSocket streaming telemetry updates every 1.5s |

---

## 13. Limitations & Future Enhancements

### Limitations
- Network simulation is software-defined; physical packet captures (e.g. PCAP / raw sockets) are modeled via virtual telemetry rather than real hardware NIC drivers.
- Topology is modeled for an enterprise campus (9 devices, 10 links) rather than an ISP-scale backbone network.

### Future Enhancements
- Integration with Mininet / OpenFlow SDN controllers (e.g., Ryu or ONOS).
- Deep Reinforcement Learning (PPO or DQN) for proactive congestion avoidance before anomalies cross critical thresholds.
- Multi-tenancy and distributed digital twin edge agents via gRPC.

---

## 14. License & Academic Attribution
Developed as an academic software engineering project for Computer Networks & Artificial Intelligence coursework. Feel free to use, adapt, and build upon this implementation.

# AI Network Digital Twin — System Deployment & Run Guide

This guide provides step-by-step instructions to run the **AI Network Digital Twin** project on any other system (Windows, macOS, or Linux).

---

## 📋 System Prerequisites

Depending on how you prefer to run the project, ensure you have the following installed:

### Option 1: Docker (Easiest — No Python or Node.js required)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine + Docker Compose (Linux)

### Option 2: Native Setup (Without Docker)
* **Python**: Version 3.10, 3.11, or 3.12 (`python --version`)
* **Node.js**: Version 18.x or 20.x+ (`node --version`)
* **npm**: Version 9.x or 10.x+ (`npm --version`)
* **Git**: Optional, for cloning or version control

---

## 🚀 Method 1: Running with Docker (Recommended)

This method packages both the FastAPI backend and React frontend into isolated containers with zero manual dependency configuration.

1. **Extract the ZIP file** and navigate into the project root folder:
   ```bash
   cd cnproject
   ```

2. **Start the application containers**:
   ```bash
   docker-compose up --build
   ```
   *(Add `-d` at the end if you want to run it in detached background mode)*

3. **Access the application**:
   * 🌐 **Web Dashboard (Frontend)**: [http://localhost:3000](http://localhost:3000)
   * ⚙️ **FastAPI Backend Root**: [http://localhost:8000](http://localhost:8000)
   * 📖 **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   * 🔌 **WebSocket Stream**: `ws://localhost:8000/ws`

4. **Stop the application**:
   ```bash
   docker-compose down
   ```

---

## 💻 Method 2: Manual Local Setup (Windows / macOS / Linux)

If you do not have Docker installed, you can run the backend and frontend natively using two terminal windows.

### Step 1: Start the Backend (FastAPI + AI Engine)

1. Open your terminal and navigate to the `backend` folder:
   ```bash
   cd cnproject/backend
   ```

2. Create a Python virtual environment:
   * **Windows**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   * **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Upgrade pip and install the required dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. *(Optional)* Re-train the AI models (the models are already pre-trained and saved in `ml/saved_models/`):
   ```bash
   python train_model.py
   ```

5. Run the FastAPI backend server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   You should see:
   ```text
   INFO: Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
   [START] Starting AI Network Digital Twin...
   [AI] Models loaded successfully!
   ```

---

### Step 2: Start the Frontend (React + Vite Dashboard)

1. Open a **second terminal window** and navigate to the `frontend` folder:
   ```bash
   cd cnproject/frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   *(If port 3000 is occupied, Vite will inform you of the alternate port, e.g. `http://localhost:3001` or `http://localhost:5173`)*

---

## 🧪 Testing the Setup

Once both servers are running:
1. Open the frontend in your browser: [http://localhost:3000](http://localhost:3000).
2. The real-time network topology (Routers, Switches, Servers) should display with live metrics (traffic, latency, packet loss).
3. Check the connection indicator in the top navbar — it should show **Live WebSocket Connected**.
4. Test **Fault Injection**: Click on a node or link, inject a failure (e.g., link drop or congestion).
5. Watch the **AI Analysis** panel detect anomalies in real time and trigger automated **Self-Healing** rerouting!
6. To run backend automated tests:
   ```bash
   cd backend
   python test_faults.py
   ```

---

## ⚠️ Troubleshooting & Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Port 8000 or 3000 already in use** | Another service (e.g., existing Node or Python app) is holding the port. | Change the port in `uvicorn main:app --port 8080` and `frontend/vite.config.js`, or terminate the blocking process. |
| **npm install dependency conflict** | Strict peer dependency checks with React 19. | Always run `npm install --legacy-peer-deps`. |
| **Python architecture mismatch on scikit-learn** | Using 32-bit Python or unsupported architecture. | Use 64-bit Python 3.10 - 3.12. |
| **WebSocket connection failed** | Backend is not started or firewall blocks port 8000. | Confirm backend is running at `http://localhost:8000` and CORS is allowed. |
| **Docker volume permission error on Linux** | File permissions for SQLite database. | Run `chmod 666 backend/network_twin.db` or let Docker generate it. |

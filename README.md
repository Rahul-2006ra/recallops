# RecallOps — The Self-Learning Industrial Maintenance Agent

RecallOps is an AI-driven, self-learning maintenance copilot designed for industrial operations and predictive plant maintenance. By combining real-time equipment telemetry analysis, high-speed reasoning via Groq, and persistent episodic memory through Hindsight Cloud, RecallOps recalls past failures, surfaces diagnostic insights, and continuously learns from technician resolutions.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS |
| **Backend** | Python 3, FastAPI, Uvicorn |
| **AI Model** | Groq (`openai/gpt-oss-120b`) |
| **Persistent Memory** | Hindsight Cloud |
| **Database** | SQLite |

---

## 📁 Project Directory Structure

```text
RecallOps/
├── backend/
│   ├── models/            # Pydantic schemas and database models
│   ├── routes/            # FastAPI API endpoint routers
│   ├── services/          # Core business logic, LLM, and memory clients
│   ├── tests/             # Backend test suite (pytest)
│   ├── __init__.py
│   └── main.py            # FastAPI entry point & middleware configuration
├── docs/                  # Architecture & system documentation
│   ├── ARCHITECTURE.md
│   └── README.md
├── frontend/              # React + Vite + Tailwind web application
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── sample_data/           # Industrial telemetry samples and failure logs
│   ├── equipment_logs_example.json
│   └── README.md
├── .env.example           # Environment template with secure placeholders
├── .gitignore             # Comprehensive Git ignore rules
├── README.md              # Project documentation and setup guide
└── requirements.txt       # Python backend dependencies
```

---

## 🚀 Setup & Installation Instructions

### 1. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
# In the project root:
cp .env.example .env
```

Edit `.env` with your actual settings (Groq API key, Hindsight Cloud credentials, etc.).

---

### 2. Backend Setup (Python + FastAPI)

1. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the backend development server:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

4. Verify backend health check:
   - Visit: `http://localhost:8000/health`
   - Interactive Swagger API docs: `http://localhost:8000/docs`

---

### 3. Frontend Setup (React + Vite + Tailwind CSS)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open the application:
   - Visit: `http://localhost:5173`

---

### 4. Running Backend Tests

With the virtual environment active:

```bash
pytest backend/tests/
```

---

## 🔒 Security & Privacy Notice
- Never commit `.env` or sensitive API keys to source control.
- All persistent memory and sensor datasets should follow operational security policies.

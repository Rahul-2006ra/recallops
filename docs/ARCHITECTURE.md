# RecallOps Architecture Overview

## Concept
**RecallOps** is an intelligent, self-learning maintenance agent tailored for industrial equipment monitoring, predictive failure detection, and automated technician guidance.

## Core Stack Components

1. **Frontend**:
   - React with Vite for fast build and responsive UI
   - Tailwind CSS for industrial dark-mode dashboard styling

2. **Backend**:
   - Python 3 with FastAPI
   - Modular structure: routes, services, models, and tests

3. **Inference & AI**:
   - **Groq API**: Powered by `openai/gpt-oss-120b` for high-throughput, low-latency reasoning on complex industrial telemetry and diagnostics.

4. **Persistent Memory Layer**:
   - **Hindsight Cloud**: Stores past incident histories, technician feedback loops, and root-cause solutions to enable continuous self-learning.

5. **Storage**:
   - **SQLite**: Local relational persistence for equipment profiles, operational logs, and session metadata.

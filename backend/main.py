from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database import init_db
from backend.routes.incidents import router as incidents_router
from backend.services.hindsight_service import hindsight_service
from backend.services.groq_service import groq_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure SQLite tables exist
    init_db()
    yield
    # Shutdown: cleanup network clients
    hindsight_service.close()
    groq_service.close()


app = FastAPI(
    title="RecallOps API",
    description="Backend API for RecallOps — The Self-Learning Industrial Maintenance Agent",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS setup
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(incidents_router)


@app.get("/", tags=["system"])
def read_root():
    return {
        "project": "RecallOps",
        "description": "The Self-Learning Industrial Maintenance Agent",
        "status": "operational",
        "version": "0.2.0",
        "ai_engine": settings.GROQ_MODEL,
        "memory_bank": settings.HINDSIGHT_BANK_ID,
    }


@app.get("/health", tags=["system"])
def health_check():
    return {
        "status": "healthy",
        "service": "recallops-backend",
        "environment": settings.APP_ENV,
    }

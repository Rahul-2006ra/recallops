import os
import ssl
from pathlib import Path
from dotenv import load_dotenv

# Locate project root and load .env securely
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def get_ssl_context() -> ssl.SSLContext:
    """Load default system certificates to ensure robust TLS verification across Windows environments."""
    ctx = ssl.create_default_context()
    ctx.load_default_certs()
    return ctx


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    # Groq AI
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # Hindsight Cloud
    HINDSIGHT_API_KEY: str = os.getenv("HINDSIGHT_API_KEY", "")
    HINDSIGHT_BASE_URL: str = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
    HINDSIGHT_BANK_ID: str = os.getenv("HINDSIGHT_BANK_ID", "recallops-demo")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./recallops.db")

    @property
    def sqlite_db_path(self) -> str:
        """Extract filesystem path from DATABASE_URL."""
        raw_path = self.DATABASE_URL
        if raw_path.startswith("sqlite:///"):
            raw_path = raw_path[10:]
        if raw_path.startswith("./"):
            return str(ROOT_DIR / raw_path[2:])
        if raw_path.startswith("/") or (len(raw_path) > 2 and raw_path[1] == ":"):
            return raw_path
        return str(ROOT_DIR / raw_path)


settings = Settings()

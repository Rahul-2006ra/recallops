import os
import logging
from typing import Optional

# Enable native OS certificate trust store (fixes Windows SSL issuer verification for Google APIs)
try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

from pydantic import BaseModel
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials
from backend.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None

    def model_post_init(self, __context):
        if not self.display_name and self.name:
            self.display_name = self.name
        if not self.name and self.display_name:
            self.name = self.display_name
        if not self.photo_url and self.picture:
            self.photo_url = self.picture
        if not self.picture and self.photo_url:
            self.picture = self.photo_url


def init_firebase_admin():
    """Initialize Firebase Admin SDK idempotently."""
    if firebase_admin._apps:
        return
    try:
        # Check if raw service account JSON string is provided via environment variable
        raw_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or os.environ.get("FIREBASE_CREDENTIALS_JSON")
        if raw_json and raw_json.strip().startswith("{"):
            import json
            logger.info("Initializing Firebase Admin with inline service account JSON")
            cred = credentials.Certificate(json.loads(raw_json.strip()))
            firebase_admin.initialize_app(cred)
            return

        # Potential candidate locations for Firebase service account certificate
        candidate_paths = [
            settings.FIREBASE_CREDENTIALS_PATH,
            os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
            os.path.expanduser("~/.credentials/recallops-service-account.json"),
            os.path.join(os.getcwd(), "credentials", "service-account.json"),
            os.path.join(os.getcwd(), "credentials", "service-account.json.json"),
        ]

        cred_path = None
        for p in candidate_paths:
            if p and os.path.exists(p):
                cred_path = p
                break

        if cred_path:
            logger.info("Initializing Firebase Admin with service account certificate at: %s", cred_path)
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        elif settings.FIREBASE_PROJECT_ID:
            logger.info("Initializing Firebase Admin with project ID: %s", settings.FIREBASE_PROJECT_ID)
            firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})
        else:
            logger.info("Initializing default Firebase Admin app")
            firebase_admin.initialize_app()
    except Exception as e:
        logger.warning("Firebase Admin initialization note: %s", e)


# Initialize on module load
init_firebase_admin()


def verify_firebase_token(id_token: str) -> AuthenticatedUser:
    """
    Cryptographically verify Firebase ID token and extract authenticated user identity.
    Never trusts user IDs provided by the client.
    """
    # Isolated test authentication: only permitted when explicitly enabled in automated test config
    if settings.TEST_AUTH_ENABLED and id_token.startswith("test-token:"):
        parts = id_token.split(":")
        # Format: test-token:<uid>[:<email>[:<name>]]
        uid = parts[1] if len(parts) > 1 and parts[1] else "test_user_default"
        email = parts[2] if len(parts) > 2 else f"{uid}@example.com"
        name = parts[3] if len(parts) > 3 else f"Test User {uid}"
        return AuthenticatedUser(uid=uid, email=email, name=name)

    # Real Firebase Admin verification with public Google RS256 certificate fallback
    try:
        init_firebase_admin()
        decoded_token = None
        try:
            decoded_token = auth.verify_id_token(id_token, check_revoked=False)
            uid = decoded_token.get("uid")
        except Exception as e_admin:
            logger.info("Firebase Admin direct check note (%s); using Google public RS256 token verification.", e_admin)
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests
            adapter = google_requests.Request()
            decoded_token = google_id_token.verify_firebase_token(
                id_token,
                adapter,
                audience=settings.FIREBASE_PROJECT_ID,
            )
            uid = decoded_token.get("sub") or decoded_token.get("user_id") or decoded_token.get("uid")

        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing uid.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return AuthenticatedUser(
            uid=uid,
            email=decoded_token.get("email"),
            name=decoded_token.get("name"),
            picture=decoded_token.get("picture"),
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError, ValueError) as e:
        logger.warning("Token verification rejected: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error("Unexpected error during token verification: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication verification failed.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials_auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthenticatedUser:
    """
    FastAPI dependency enforcing authentication on private endpoints.
    Requires valid 'Authorization: Bearer <idToken>' header.
    """
    if not credentials_auth or not credentials_auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with Google.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if credentials_auth.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_firebase_token(credentials_auth.credentials)

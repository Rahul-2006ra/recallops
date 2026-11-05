import os
import ssl
import json
from pathlib import Path
import pytest
from dotenv import load_dotenv
import httpx
from hindsight_client import Hindsight
from groq import Groq

# Load environment variables securely from project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
HINDSIGHT_BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "recallops-demo")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


def get_ssl_context():
    """Load default system certificates for robust Windows TLS support."""
    ctx = ssl.create_default_context()
    ctx.load_default_certs()
    return ctx


@pytest.fixture(scope="module")
def hindsight_client():
    assert HINDSIGHT_API_KEY, "HINDSIGHT_API_KEY must be set in .env"
    client = Hindsight(base_url=HINDSIGHT_BASE_URL, api_key=HINDSIGHT_API_KEY, timeout=60.0)
    yield client
    client.close()


@pytest.fixture(scope="module")
def groq_client():
    assert GROQ_API_KEY, "GROQ_API_KEY must be set in .env"
    http_client = httpx.Client(verify=get_ssl_context())
    client = Groq(api_key=GROQ_API_KEY, http_client=http_client)
    yield client
    http_client.close()


def test_hindsight_connection_and_bank_access(hindsight_client):
    """Verify access to the existing bank without creating duplicate banks."""
    config = hindsight_client.get_bank_config(bank_id=HINDSIGHT_BANK_ID)
    assert config is not None
    assert isinstance(config, dict)
    assert config.get("bank_id") == HINDSIGHT_BANK_ID


def test_hindsight_retain_synthetic_incident(hindsight_client):
    """Store synthetic demonstration incident data into Hindsight bank."""
    content = (
        "[SYNTHETIC DEMONSTRATION DATA]\n"
        "Incident ID: DEMO-INC-001\n"
        "Machine: DEMO-M-104\n"
        "Symptom: Overheating after 30 minutes of operation.\n"
        "Diagnosis: Restricted ventilation.\n"
        "Repair action: Cleaned the ventilation path.\n"
        "Verified outcome: Successful. Temperature returned to normal during follow-up inspection."
    )
    response = hindsight_client.retain(
        bank_id=HINDSIGHT_BANK_ID,
        content=content,
        document_id="DEMO-INC-001",
        context="Synthetic maintenance verification log",
        tags=["synthetic-demo", "DEMO-M-104", "overheating"],
    )
    assert response is not None
    assert getattr(response, "success", True) is True


def test_hindsight_recall_incident(hindsight_client):
    """Recall the overheating incident from memory."""
    recall_resp = hindsight_client.recall(
        bank_id=HINDSIGHT_BANK_ID,
        query="overheating incident DEMO-M-104",
    )
    assert recall_resp is not None
    assert hasattr(recall_resp, "results")
    assert len(recall_resp.results) > 0

    recalled_texts = [r.text for r in recall_resp.results if hasattr(r, "text")]
    combined_text = " ".join(recalled_texts).lower()
    assert "demo-m-104" in combined_text
    assert "overheating" in combined_text or "ventilation" in combined_text


def test_hindsight_reflect_synthesis(hindsight_client):
    """Reflect on past machine incident, repair, and supporting evidence."""
    query = "What happened to DEMO-M-104? Which repair was successful? What evidence supports the answer?"
    reflect_resp = hindsight_client.reflect(
        bank_id=HINDSIGHT_BANK_ID,
        query=query,
        budget="low",
    )
    assert reflect_resp is not None
    text = getattr(reflect_resp, "text", "")
    assert len(text) > 0
    text_lower = text.lower()
    assert "demo-m-104" in text_lower
    assert "ventilation" in text_lower or "overheating" in text_lower


def test_groq_simple_completion(groq_client):
    """Send a simple completion to Groq using openai/gpt-oss-120b."""
    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are RecallOps industrial maintenance copilot."},
            {"role": "user", "content": "Respond strictly with: SYSTEM READY"},
        ],
        max_tokens=150,
    )
    assert completion.choices and len(completion.choices) > 0
    content = completion.choices[0].message.content
    assert "SYSTEM READY" in content


def test_groq_strict_structured_output(groq_client):
    """Validate strict JSON schema structured output using openai/gpt-oss-120b."""
    schema = {
        "type": "object",
        "properties": {
            "diagnosis": {
                "type": "string",
                "description": "Root cause diagnosis",
            },
            "confidence": {
                "type": "number",
                "description": "Confidence score between 0.0 and 1.0",
            },
            "recommended_action": {
                "type": "string",
                "description": "Prescribed maintenance action",
            },
        },
        "required": ["diagnosis", "confidence", "recommended_action"],
        "additionalProperties": False,
    }

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are RecallOps diagnostic engine. Output strictly formatted JSON matching the provided schema.",
            },
            {
                "role": "user",
                "content": "Equipment DEMO-M-104 had restricted ventilation causing overheating. Return diagnosis, confidence score, and recommended action.",
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "maintenance_diagnosis",
                "strict": True,
                "schema": schema,
            },
        },
        temperature=0.1,
    )

    raw_json = completion.choices[0].message.content
    parsed = json.loads(raw_json)

    assert isinstance(parsed, dict)
    assert "diagnosis" in parsed and isinstance(parsed["diagnosis"], str)
    assert "confidence" in parsed and isinstance(parsed["confidence"], (int, float))
    assert 0.0 <= parsed["confidence"] <= 1.0
    assert "recommended_action" in parsed and isinstance(parsed["recommended_action"], str)

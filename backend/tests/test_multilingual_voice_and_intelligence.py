import io
import wave
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.models.chat import ChatRequest
from backend.services.chat_service import chat_service
from backend.services.transcription_service import transcription_service


def generate_test_wav_bytes(duration_sec=0.5, sample_rate=16000) -> bytes:
    """Generate a valid PCM 16-bit mono WAV in memory for API testing."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        num_frames = int(duration_sec * sample_rate)
        # Empty silence frames
        wf.writeframes(b"\x00\x00" * num_frames)
    return buf.getvalue()


class TestMultilingualAudioTranscriptionEndpoint:
    """Test voice transcription endpoint with simulated WAV payloads."""

    def test_transcribe_endpoint_success(self):
        client = TestClient(app)
        wav_data = generate_test_wav_bytes(duration_sec=0.5)

        response = client.post(
            "/api/transcribe",
            files={"file": ("test.wav", wav_data, "audio/wav")},
        )
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert "language" in data
        assert data["status"] == "success"
        assert "whisper" in data["model_used"]

    def test_transcribe_endpoint_invalid_file_type(self):
        client = TestClient(app)
        response = client.post(
            "/api/transcribe",
            files={"file": ("test.txt", b"not audio data", "text/plain")},
        )
        assert response.status_code == 400


class TestMultilingualMixerGrinderTroubleshooting:
    """Test Indic script, vernacular romanized, and code-switched equipment troubleshooting with English-only responses."""

    def test_hindi_mixer_grinder_diagnosis(self):
        """Hindi in Devanagari script: मेरा मिक्सी काम नहीं कर रहा है। - Response must be English."""
        req = ChatRequest(message="मेरा मिक्सी काम नहीं कर रहा है।")
        res = chat_service.process_chat(req)

        assert res.intent == "TROUBLESHOOTING_QUERY"
        assert res.detected_language and res.detected_language.lower() in ["hindi", "hinglish"]
        assert res.equipment_detected is not None
        assert "Mixer Grinder" in res.equipment_detected.get("equipment_type", "")
        # Response must strictly be in English
        assert "Plausible Causes" in res.reply
        assert "Safety Alert" in res.reply
        has_devanagari = any("\u0900" <= c <= "\u097F" for c in res.reply)
        assert not has_devanagari, f"Expected English-only response without Devanagari, got: {res.reply}"

    def test_kannada_mixer_grinder_diagnosis(self):
        """Kannada in Kannada script: ನನ್ನ ಮಿಕ್ಸಿ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ. - Response must be English."""
        req = ChatRequest(message="ನನ್ನ ಮಿಕ್ಸಿ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ.")
        res = chat_service.process_chat(req)

        assert res.intent == "TROUBLESHOOTING_QUERY"
        assert res.detected_language and res.detected_language.lower() in ["kannada", "kannada-english"]
        assert res.equipment_detected is not None
        assert "Mixer Grinder" in res.equipment_detected.get("equipment_type", "")
        # Response must strictly be in English
        assert "Plausible Causes" in res.reply
        assert "Safety Alert" in res.reply
        has_kannada = any("\u0C80" <= c <= "\u0CFF" for c in res.reply)
        assert not has_kannada, f"Expected English-only response without Kannada script, got: {res.reply}"

    def test_hinglish_mixer_grinder_diagnosis(self):
        """Hinglish Romanized: Mera mixie work nahi kar raha. - Response must be English."""
        req = ChatRequest(message="Mera mixie work nahi kar raha.")
        res = chat_service.process_chat(req)

        assert res.intent == "TROUBLESHOOTING_QUERY"
        assert res.equipment_detected is not None
        assert "Mixer Grinder" in res.equipment_detected.get("equipment_type", "")
        assert res.detected_language and res.detected_language.lower() in ["hinglish", "hindi"]
        assert "Plausible Causes" in res.reply
        assert "Safety Alert" in res.reply

    def test_kannada_english_code_switch_diagnosis(self):
        """Kannada-English code-switching: Nanna mixie work aagta illa. - Response must be English."""
        req = ChatRequest(message="Nanna mixie work aagta illa.")
        res = chat_service.process_chat(req)

        assert res.intent == "TROUBLESHOOTING_QUERY"
        assert res.equipment_detected is not None
        assert "Mixer Grinder" in res.equipment_detected.get("equipment_type", "")
        assert res.detected_language and res.detected_language.lower() in ["kannada", "kannada-english"]
        assert "Plausible Causes" in res.reply
        assert "Safety Alert" in res.reply


class TestMultilingualContextContinuityAndLanguageSwitching:
    """Test ongoing conversation flow and language preference override."""

    def test_language_switch_to_english_on_followup(self):
        """Turn 1: Hindi query. Turn 2: User requests English explanation."""
        req1 = ChatRequest(message="मेरा मिक्सी चालू नहीं हो रहा है")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"
        assert "Plausible Causes" in res1.reply

        req2 = ChatRequest(
            message="Can you please explain what to check in English?",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.detected_language and res2.detected_language.lower() == "english"
        # Turn 2 reply should be in English
        assert any(w in res2.reply.lower() for w in ["mixer", "grinder", "power", "switch", "overload", "reset", "plug"])


class TestMultilingualCasualAndKnowledgeRedirection:
    """Test that regional language casual queries and non-equipment queries are politely handled in English."""

    def test_hindi_casual_greeting(self):
        """Hindi greeting: नमस्ते, आप कैसे हैं? - Response must be in English."""
        req = ChatRequest(message="नमस्ते, आप कैसे हैं?")
        res = chat_service.process_chat(req)

        assert res.intent == "CASUAL_GREETING"
        # Must not diagnose equipment
        assert res.equipment_detected is None
        assert "bearing wear" not in res.reply.lower()
        assert "mechanical imbalance" not in res.reply.lower()
        # Must be in English
        has_devanagari = any("\u0900" <= c <= "\u097F" for c in res.reply)
        assert not has_devanagari, f"Expected English-only response without Devanagari, got: {res.reply}"
        assert any(w in res.reply.lower() for w in ["hello", "hi", "recallops", "how can i", "assist", "help", "diagnos", "good"])

    def test_hindi_off_topic_redirection(self):
        """Hindi general knowledge: भारत की राजधानी क्या है? - Response must be in English."""
        req = ChatRequest(message="भारत की राजधानी क्या है?")
        res = chat_service.process_chat(req)

        assert res.intent in ["UNRELATED_QUERY", "OFF_TOPIC_KNOWLEDGE_REQUEST"]
        assert res.equipment_detected is None
        # Must politely redirect without mechanical diagnosis
        assert "bearing wear" not in res.reply.lower()
        assert "mechanical imbalance" not in res.reply.lower()
        # Must be in English
        has_devanagari = any("\u0900" <= c <= "\u097F" for c in res.reply)
        assert not has_devanagari, f"Expected English-only response without Devanagari, got: {res.reply}"
        assert any(w in res.reply.lower() for w in ["recallops", "equipment", "troubleshoot", "diagnos", "specialize", "assist"])

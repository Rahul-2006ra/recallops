import io
import logging
from typing import Any, Optional
from backend.services.groq_service import groq_service

logger = logging.getLogger(__name__)

SUPPORTED_AUDIO_EXTENSIONS = {
    "webm", "wav", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg"
}
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB max


class TranscriptionService:
    def __init__(self):
        self.candidate_models = ["whisper-large-v3-turbo", "whisper-large-v3"]

    def transcribe_audio(
        self,
        file_bytes: bytes,
        filename: str = "recording.webm",
        content_type: Optional[str] = None,
        language: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Transcribe audio using Groq's high-speed Whisper models.
        Returns:
            {
                "text": str,
                "language": str,
                "duration": float,
                "model_used": str,
                "status": "success"
            }
        """
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("No audio data provided.")

        if len(file_bytes) > MAX_AUDIO_SIZE_BYTES:
            raise ValueError(
                f"Audio file size ({len(file_bytes)} bytes) exceeds 25 MB limit."
            )

        # Determine file extension
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        valid_ext = ext in SUPPORTED_AUDIO_EXTENSIONS
        valid_mime = content_type and any(k in content_type.lower() for k in ["audio", "webm", "wav", "ogg", "mp4", "m4a", "mp3", "mpeg"])

        if not valid_ext and not valid_mime:
            raise ValueError(
                f"Unsupported file format '{ext or content_type}'. Supported audio formats: {', '.join(sorted(SUPPORTED_AUDIO_EXTENSIONS))}"
            )

        if not valid_ext and valid_mime:
            if "webm" in content_type:
                ext = "webm"
            elif "wav" in content_type:
                ext = "wav"
            elif "ogg" in content_type:
                ext = "ogg"
            elif "mp4" in content_type or "m4a" in content_type:
                ext = "m4a"
            elif "mp3" in content_type or "mpeg" in content_type:
                ext = "mp3"
            else:
                ext = "webm"

        safe_filename = f"audio_input.{ext or 'webm'}"
        client = groq_service.get_client()

        last_error = None
        for model in self.candidate_models:
            try:
                audio_buffer = io.BytesIO(file_bytes)
                audio_buffer.name = safe_filename

                kwargs: dict[str, Any] = {
                    "file": audio_buffer,
                    "model": model,
                    "response_format": "verbose_json",
                }
                if language:
                    kwargs["language"] = language

                response = client.audio.transcriptions.create(**kwargs)

                transcribed_text = (getattr(response, "text", "") or "").strip()
                detected_language = getattr(response, "language", "Unknown") or "Unknown"
                duration = float(getattr(response, "duration", 0.0) or 0.0)

                logger.info(
                    "Whisper transcription succeeded with model %s. Language: %s, Duration: %.2fs",
                    model,
                    detected_language,
                    duration,
                )

                return {
                    "text": transcribed_text,
                    "language": detected_language,
                    "duration": duration,
                    "model_used": model,
                    "status": "success",
                }
            except Exception as e:
                logger.warning(
                    "Whisper transcription failed with model %s: %s. Trying next candidate...",
                    model,
                    str(e),
                )
                last_error = e

        if last_error and any(k in str(last_error).lower() for k in ["invalid_media_file", "could not process file", "unsupported"]):
            raise ValueError(f"Invalid audio data: {str(last_error)}")

        raise RuntimeError(
            f"All transcription models failed. Last error: {str(last_error)}"
        )


transcription_service = TranscriptionService()

import pytest
from backend.services.chat_service import chat_service
from backend.models.chat import ChatRequest


def assert_no_mechanical_leakage(text: str, context_label: str):
    """Assert that rotary machinery boilerplate never leaks into non-industrial or resolution responses."""
    lower = text.lower()
    banned_phrases = [
        "bearing wear",
        "bearing runout",
        "mechanical imbalance",
        "cooling passage",
        "loose mounting fasteners",
        "lockout/tagout (loto)",
        "osha 1910.147",
    ]
    for banned in banned_phrases:
        assert banned not in lower, f"Leakage found in {context_label}: '{banned}' appeared in:\n{text}"


class TestP0RootCauseAndUnseenConversations:
    """Rigorous test suite verifying P0 fix for repeated generic mechanical diagnosis."""

    def test_reproduction_bluetooth_speaker_and_muted_phone(self):
        """Turn 1: Bluetooth speaker stops producing sound. Turn 2: User realizes volume muted on phone."""
        req1 = ChatRequest(message="My Bluetooth speaker suddenly stopped producing sound.")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"
        assert_no_mechanical_leakage(res1.reply, "Bluetooth speaker diagnosis")

        req2 = ChatRequest(
            message="Oh wait bro, I just realized the volume was muted on my phone 😂",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.intent == "PROBLEM_EXPLANATION_OR_CAUSE"
        assert_no_mechanical_leakage(res2.reply, "Bluetooth speaker muted phone explanation")
        lower_reply = res2.reply.lower()
        assert any(w in lower_reply for w in ["mute", "volume", "sound", "phone", "audio", "speaker"])

    def test_unseen_1_electronic_tv_loose_hdmi(self):
        """Turn 1: TV screen is black. Turn 2: HDMI cable was loose in the back."""
        req1 = ChatRequest(message="My TV screen is black but the power light is on.")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"
        assert_no_mechanical_leakage(res1.reply, "TV screen diagnosis")

        req2 = ChatRequest(
            message="Oh haha the HDMI cable was loose in the back",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.intent == "PROBLEM_EXPLANATION_OR_CAUSE"
        assert_no_mechanical_leakage(res2.reply, "TV loose HDMI explanation")
        lower = res2.reply.lower()
        assert any(w in lower for w in ["hdmi", "cable", "signal", "connect", "port"])

    def test_unseen_2_household_microwave_timer_setting(self):
        """Turn 1: Microwave isn't heating soup. Turn 2: Set timer instead of cook time."""
        req1 = ChatRequest(message="My microwave isn't heating soup at all.")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"
        assert_no_mechanical_leakage(res1.reply, "Microwave diagnosis")

        req2 = ChatRequest(
            message="My bad, I set the timer instead of cook time",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.intent == "PROBLEM_EXPLANATION_OR_CAUSE"
        assert_no_mechanical_leakage(res2.reply, "Microwave timer explanation")
        lower = res2.reply.lower()
        assert any(w in lower for w in ["timer", "cook", "heat", "setting", "mode"])

    def test_unseen_3_industrial_cnc_emergency_stop(self):
        """Turn 1: CNC milling machine spindle stopped. Turn 2: Emergency stop was accidentally pressed."""
        req1 = ChatRequest(message="CNC milling machine spindle stopped suddenly during operation.")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"

        req2 = ChatRequest(
            message="Emergency stop button was accidentally pressed by operator",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.intent == "PROBLEM_EXPLANATION_OR_CAUSE"
        lower = res2.reply.lower()
        assert any(w in lower for w in ["emergency", "stop", "e-stop", "button", "reset", "circuit", "spindle"])
        assert "bearing wear" not in lower

    def test_unseen_4_audio_headphones_balance_slider(self):
        """Turn 1: Headphones have sound only in one ear. Turn 2: Balance slider in settings all the way left."""
        req1 = ChatRequest(message="My headphones have sound only in one ear.")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"
        assert_no_mechanical_leakage(res1.reply, "Headphones diagnosis")

        req2 = ChatRequest(
            message="Never mind, balance slider in settings was all the way to the left",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.intent == "PROBLEM_EXPLANATION_OR_CAUSE"
        assert_no_mechanical_leakage(res2.reply, "Headphones balance slider explanation")
        lower = res2.reply.lower()
        assert any(w in lower for w in ["balance", "slider", "setting", "channel", "ear", "stereo", "audio"])

    def test_unseen_5_colloquial_hinglish_dashcam_switch_off(self):
        """Turn 1: Car dash camera not working. Turn 2: Arre switch off tha adapter ka bhai."""
        req1 = ChatRequest(message="Car dash camera not working at all.")
        res1 = chat_service.process_chat(req1)
        assert res1.intent == "TROUBLESHOOTING_QUERY"
        assert_no_mechanical_leakage(res1.reply, "Dash camera diagnosis")

        req2 = ChatRequest(
            message="Arre switch off tha adapter ka bhai",
            conversation_id=res1.conversation_id,
        )
        res2 = chat_service.process_chat(req2)
        assert res2.intent == "PROBLEM_EXPLANATION_OR_CAUSE"
        assert_no_mechanical_leakage(res2.reply, "Dashcam switch off explanation")
        lower = res2.reply.lower()
        assert any(w in lower for w in ["switch", "adapter", "power", "supply", "camera", "chalu", "on"])

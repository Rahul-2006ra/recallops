"""
Tests for Phase 2 Controlled Hindsight Learning Demonstration
"""

import os
import json
import pytest
from backend.config import settings
from backend.services.hindsight_service import hindsight_service

BASELINE_BANK_ID = "recallops-exp-baseline"
LEARNED_BANK_ID = "recallops-exp-learned"


def test_experiment_banks_exist_and_isolated():
    """Verify that both experiment banks exist in Hindsight Cloud and are isolated from production."""
    client = hindsight_service.get_client()

    # Both banks must exist and have valid config
    cfg_base = client.get_bank_config(BASELINE_BANK_ID)
    cfg_learned = client.get_bank_config(LEARNED_BANK_ID)

    assert cfg_base is not None
    assert cfg_learned is not None

    # Verify they are distinct from production bank
    assert BASELINE_BANK_ID != settings.HINDSIGHT_BANK_ID
    assert LEARNED_BANK_ID != settings.HINDSIGHT_BANK_ID


def test_baseline_does_not_contain_m112_and_learned_contains_m112():
    """Verify condition isolation: baseline must not recall M-112, while learned must recall M-112."""
    client = hindsight_service.get_client()
    query = "Industrial Centrifugal Pump High-frequency vibration and casing overheating after 25 minutes of operation"

    # Recall from Baseline Bank
    resp_base = client.recall(bank_id=BASELINE_BANK_ID, query=query, budget="low")
    base_mems = getattr(resp_base, "results", [])
    m112_in_base = any(
        "M-112" in getattr(m, "text", "") or getattr(m, "document_id", "") == "OUTCOME-INC-20261105-CF6B1D"
        for m in base_mems
    )
    assert not m112_in_base, "Baseline bank must NOT contain M-112 memory (Condition A isolation)."

    # Recall from Learned Bank
    resp_learned = client.recall(bank_id=LEARNED_BANK_ID, query=query, budget="low")
    learned_mems = getattr(resp_learned, "results", [])
    m112_in_learned = any(
        "M-112" in getattr(m, "text", "") or getattr(m, "document_id", "") == "OUTCOME-INC-20261105-CF6B1D"
        for m in learned_mems
    )
    assert m112_in_learned, "Learned bank MUST contain M-112 verified outcome memory (Condition B)."


def test_experiment_report_and_data_files_exist():
    """Verify that the Markdown report and raw JSON results exist and are populated."""
    report_path = os.path.join(os.path.dirname(__file__), "../../docs/hindsight-learning-experiment.md")
    json_path = os.path.join(os.path.dirname(__file__), "../../docs/experiment-results.json")

    assert os.path.exists(report_path), "docs/hindsight-learning-experiment.md must exist."
    assert os.path.exists(json_path), "docs/experiment-results.json must exist."

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "condition_a_before" in data
    assert "condition_b_after" in data
    assert len(data["condition_a_before"]) >= 1
    assert len(data["condition_b_after"]) >= 1
    assert data["condition_b_after"][0]["m112_retrieved"] is True
    assert data["condition_a_before"][0]["m112_retrieved"] is False

"""HTTP routes for health checks and EEG analysis."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.app.domain.errors import AnalysisInputError
from backend.app.domain.types import AnalysisSettings
from backend.app.processing.artifacts import parse_boolean
from backend.app.services.analysis_service import run_analysis


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/preprocess")
@router.post("/process")
async def process(
    training_file: UploadFile = File(...),
    test_file: UploadFile = File(...),
    high_pass_hz: float = Form(4.0),
    low_pass_hz: float = Form(40.0),
    epoch_tmin: float = Form(2.0),
    epoch_tmax: float = Form(6.0),
    csp_components: int = Form(4),
    fbcsp_k_best: int = Form(16),
    seed: int = Form(42),
    selected_channels: str = Form("[]"),
    use_autoreject: str = Form("false"),
) -> dict[str, Any]:
    """Parse the multipart request and delegate the numerical work to the service layer."""
    try:
        try:
            parsed_channels = json.loads(selected_channels)
            channels = tuple(str(channel) for channel in parsed_channels) if isinstance(parsed_channels, list) else ()
        except (TypeError, ValueError, json.JSONDecodeError):
            channels = ()

        settings = AnalysisSettings(
            high_pass_hz=high_pass_hz,
            low_pass_hz=low_pass_hz,
            epoch_tmin=epoch_tmin,
            epoch_tmax=epoch_tmax,
            csp_components=csp_components,
            fbcsp_k_best=fbcsp_k_best,
            seed=seed,
            selected_channels=channels,
            use_autoreject=parse_boolean(use_autoreject),
        )
        return run_analysis(
            await training_file.read(),
            await test_file.read(),
            training_file.filename or "train",
            test_file.filename or "test",
            settings,
        )
    except AnalysisInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {exc}") from exc

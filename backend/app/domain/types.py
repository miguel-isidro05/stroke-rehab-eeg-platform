"""Typed values passed between the API, processing, and model layers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass(frozen=True)
class AnalysisSettings:
    high_pass_hz: float = 4.0
    low_pass_hz: float = 40.0
    epoch_tmin: float = 2.0
    epoch_tmax: float = 6.0
    csp_components: int = 4
    fbcsp_k_best: int = 16
    seed: int = 42
    selected_channels: tuple[str, ...] = ()
    use_autoreject: bool = False


@dataclass(frozen=True)
class EegDataset:
    epochs: np.ndarray
    labels: np.ndarray
    sampling_rate: float
    channel_names: list[str]


@dataclass(frozen=True)
class PreparedDatasets:
    train: EegDataset
    test: EegDataset
    raw_train_epochs: np.ndarray
    autoreject: dict[str, Any] = field(default_factory=dict)

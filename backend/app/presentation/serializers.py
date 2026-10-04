"""Convert numerical pipeline results into the stable HTTP response contract."""

from __future__ import annotations

from typing import Any

import numpy as np
import scipy.signal

from backend.app.domain.constants import CV_FOLDS


def decimate(values: np.ndarray, point_count: int) -> list:
    if values.shape[-1] <= point_count:
        return values.tolist()
    indices = np.linspace(0, values.shape[-1] - 1, point_count).astype(int)
    return values[..., indices].tolist()


def build_analysis_response(
    *,
    raw_train: np.ndarray,
    filtered_train: np.ndarray,
    filtered_test: np.ndarray,
    sampling_rate: float,
    channel_names: list[str],
    csp_cross_validation: dict[str, Any],
    fbcsp_cross_validation: dict[str, Any],
    csp_holdout: dict[str, Any],
    fbcsp_holdout: dict[str, Any],
    autoreject: dict[str, Any],
) -> dict[str, Any]:
    """Build the response used by the current Next.js charts and metric cards."""
    displayed_channels = min(4, filtered_train.shape[1])
    raw_lines = [decimate(raw_train[0, index], 220) for index in range(displayed_channels)]
    filtered_lines = [decimate(filtered_train[0, index], 220) for index in range(displayed_channels)]
    trial_seconds = filtered_train.shape[2] / sampling_rate

    train_frequencies, train_power = scipy.signal.welch(
        filtered_train[0, 0],
        fs=sampling_rate,
        nperseg=min(256, filtered_train.shape[2]),
    )
    test_frequencies, test_power = scipy.signal.welch(
        filtered_test[0, 0],
        fs=sampling_rate,
        nperseg=min(256, filtered_test.shape[2]),
    )
    frequency_mask = (train_frequencies >= 0) & (train_frequencies <= 45)

    return {
        "fs": sampling_rate,
        "n_epochs": {"train": int(filtered_train.shape[0]), "test": int(filtered_test.shape[0])},
        "channel_names": channel_names[:displayed_channels],
        "temporal": {
            "raw": raw_lines,
            "filtered": filtered_lines,
            "n_samples": min(220, filtered_train.shape[2]),
            "duration_s": round(trial_seconds, 2),
        },
        "psd": {
            "freqs": decimate(train_frequencies[frequency_mask], 120),
            "train": decimate(train_power[frequency_mask], 120),
            "test": decimate(test_power[frequency_mask], 120),
        },
        "metrics": {
            "csp_lda": csp_cross_validation["metrics"],
            "fbcsp_lda": fbcsp_cross_validation["metrics"],
            "evaluation": {
                "method": "stratified_kfold",
                "folds": CV_FOLDS,
                "dataset": "train+test",
            },
        },
        "confusion": {
            "csp_lda": csp_cross_validation["confusion"],
            "fbcsp_lda": fbcsp_cross_validation["confusion"],
        },
        "roc": {
            "csp_lda": csp_cross_validation["roc"],
            "fbcsp_lda": fbcsp_cross_validation["roc"],
        },
        "holdout": {
            "metrics": {
                "csp_lda": csp_holdout["metrics"],
                "fbcsp_lda": fbcsp_holdout["metrics"],
            }
        },
        "preprocessing": {"autoreject": autoreject},
    }


"""Optional artifact rejection isolated from the core preprocessing path."""

from __future__ import annotations

from typing import Any

import numpy as np

from backend.app.domain.errors import AnalysisInputError


def parse_boolean(value: Any) -> bool:
    return value if isinstance(value, bool) else str(value).strip().lower() in {"1", "true", "yes", "on"}


def apply_optional_autoreject(
    train_epochs: np.ndarray,
    train_labels: np.ndarray,
    test_epochs: np.ndarray,
    test_labels: np.ndarray,
    sfreq: float,
    channel_names: list[str],
    enabled: bool,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict[str, Any]]:
    """Run AutoReject when requested and return masks for aligned raw displays."""
    if not enabled:
        keep_train = np.ones(train_epochs.shape[0], dtype=bool)
        keep_test = np.ones(test_epochs.shape[0], dtype=bool)
        return train_epochs, train_labels, test_epochs, test_labels, keep_train, keep_test, {
            "enabled": False,
            "applied": False,
            "dropped_train": 0,
            "dropped_test": 0,
            "modified_train": 0,
            "modified_test": 0,
        }

    try:
        import mne
        from autoreject import AutoReject
    except ImportError as exc:
        raise AnalysisInputError(
            "AutoReject requested but dependency is missing. Install with: pip install autoreject"
        ) from exc

    info = mne.create_info(channel_names, sfreq, ["eeg"] * len(channel_names))

    def build_epochs(data: np.ndarray):
        events = np.column_stack([
            np.arange(data.shape[0], dtype=int),
            np.zeros(data.shape[0], dtype=int),
            np.ones(data.shape[0], dtype=int),
        ])
        return mne.EpochsArray(
            data, info, events=events, event_id={"mi": 1}, tmin=0.0, baseline=None, verbose=False
        )

    try:
        train_object = build_epochs(train_epochs)
        test_object = build_epochs(test_epochs)
        rejector = AutoReject(random_state=seed, verbose=False)
        clean_train, train_log = rejector.fit_transform(train_object, return_log=True)
        clean_test, test_log = rejector.transform(test_object, return_log=True)
    except Exception as exc:
        raise AnalysisInputError(f"AutoReject failed: {exc}") from exc

    keep_train = ~train_log.bad_epochs
    keep_test = ~test_log.bad_epochs
    clean_train_labels = train_labels[keep_train]
    clean_test_labels = test_labels[keep_test]
    if clean_train.get_data().shape[0] < 10 or len(np.unique(clean_train_labels)) < 2:
        raise AnalysisInputError("AutoReject removed too many training trials")
    if clean_test.get_data().shape[0] < 2 or len(np.unique(clean_test_labels)) < 2:
        raise AnalysisInputError("AutoReject removed too many test trials")

    def count_modified(log: Any) -> int:
        labels = np.asarray(getattr(log, "labels", []))
        if labels.ndim != 2 or labels.size == 0:
            return int(np.sum(getattr(log, "bad_epochs", np.array([], dtype=bool))))
        return int(np.sum(np.any(labels != 0, axis=1)))

    return (
        clean_train.get_data(copy=True), clean_train_labels,
        clean_test.get_data(copy=True), clean_test_labels,
        keep_train, keep_test,
        {
            "enabled": True,
            "applied": True,
            "dropped_train": int(np.sum(~keep_train)),
            "dropped_test": int(np.sum(~keep_test)),
            "modified_train": count_modified(train_log),
            "modified_test": count_modified(test_log),
        },
    )


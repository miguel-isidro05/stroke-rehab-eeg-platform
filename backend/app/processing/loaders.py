"""Load EEG recordings into the canonical trials, channels, time layout."""

from __future__ import annotations

import io

import numpy as np
import scipy.io

from backend.app.domain.constants import CHANNEL_NAMES_16
from backend.app.domain.errors import AnalysisInputError
from backend.app.domain.types import EegDataset


def epoch_continuous(
    eeg: np.ndarray,
    triggers: np.ndarray,
    sfreq: float,
    trial_duration_s: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Extract trials starting at the first sample of each +1 or -1 trigger."""
    samples_per_trial = int(round(trial_duration_s * sfreq))
    minimum_gap = max(1, int(round(0.5 * sfreq)))

    def trigger_onsets(label: int) -> np.ndarray:
        indices = np.where(triggers == label)[0]
        if indices.size == 0:
            return indices
        keep = np.insert(np.diff(indices) > minimum_gap, 0, True)
        return indices[keep]

    labeled_onsets = (
        [(int(onset), 0) for onset in trigger_onsets(+1)]
        + [(int(onset), 1) for onset in trigger_onsets(-1)]
    )
    epochs: list[np.ndarray] = []
    labels: list[int] = []
    for onset, label in labeled_onsets:
        end = onset + samples_per_trial
        if end <= eeg.shape[0]:
            epochs.append(eeg[onset:end, :].T)
            labels.append(label)

    if not epochs:
        raise AnalysisInputError(
            "No valid epochs found in continuous recording; check trigger values (+1/-1)"
        )

    return np.asarray(epochs, dtype=np.float64), np.asarray(labels, dtype=np.int64)


def load_mat(raw_bytes: bytes, source: str, epoch_tmax: float = 8.0) -> EegDataset:
    """Read either the flat BR41N.IO format or the legacy nested struct format."""
    mat = scipy.io.loadmat(io.BytesIO(raw_bytes), squeeze_me=True, struct_as_record=False)
    keys = [key for key in mat if not key.startswith("__")]
    if not keys:
        raise AnalysisInputError(f"No variable found in {source}")

    if "y" in mat and "trig" in mat and "fs" in mat:
        sfreq = float(np.asarray(mat["fs"]).reshape(-1)[0])
        eeg = np.asarray(mat["y"], dtype=np.float64)
        if eeg.ndim == 1:
            eeg = eeg[:, np.newaxis]
        triggers = np.asarray(mat["trig"]).reshape(-1).astype(int)
        channel_count = eeg.shape[1]
        channel_names = (
            CHANNEL_NAMES_16[:channel_count]
            if channel_count <= len(CHANNEL_NAMES_16)
            else [f"Ch{index + 1}" for index in range(channel_count)]
        )
        epochs, labels = epoch_continuous(eeg, triggers, sfreq, epoch_tmax)
        return EegDataset(epochs, labels, sfreq, channel_names)

    struct_object = None
    for key in keys:
        candidate = mat[key]
        if hasattr(candidate, "DataEEG"):
            candidate = candidate.DataEEG
        if all(hasattr(candidate, field) for field in ("x", "y", "s")):
            struct_object = candidate
            break

    if struct_object is None:
        raise AnalysisInputError(
            f"{source}: unrecognised .mat format; expected flat keys ('fs','y','trig') "
            "or a struct with fields 'x','y','s','c'"
        )

    raw_epochs = np.asarray(struct_object.x, dtype=np.float64)
    labels = np.asarray(struct_object.y, dtype=np.int64).reshape(-1)
    sfreq = float(np.asarray(struct_object.s).reshape(-1)[0])
    raw_channels = getattr(struct_object, "c", None)
    channel_names = (
        [str(channel).strip() for channel in np.asarray(raw_channels).reshape(-1).tolist()]
        if raw_channels is not None
        else [f"Ch{index + 1}" for index in range(raw_epochs.shape[1] if raw_epochs.ndim >= 2 else 1)]
    )

    if raw_epochs.ndim != 3:
        raise AnalysisInputError(f"{source}: x must be 3D, got {raw_epochs.shape}")
    if raw_epochs.shape[2] != labels.shape[0]:
        raise AnalysisInputError(
            f"{source}: trials mismatch x={raw_epochs.shape}, y={labels.shape}"
        )

    return EegDataset(
        np.transpose(raw_epochs, (2, 1, 0)),
        labels,
        sfreq,
        channel_names,
    )


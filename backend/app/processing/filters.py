"""Pure preprocessing operations for trial-based EEG arrays."""

from __future__ import annotations

import numpy as np
from mne.filter import filter_data as mne_filter_data
from mne.filter import notch_filter as mne_notch_filter

from backend.app.domain.constants import DEFAULT_NOTCH_FREQUENCIES


def apply_notch(
    epochs: np.ndarray,
    sfreq: float,
    frequencies: tuple[float, ...] = DEFAULT_NOTCH_FREQUENCIES,
) -> np.ndarray:
    """Apply MNE's FIR notch filter to each trial."""
    nyquist = sfreq / 2.0
    valid_frequencies = [frequency for frequency in frequencies if 0 < frequency < nyquist]
    if not valid_frequencies:
        return epochs.astype(np.float64)
    output = np.empty_like(epochs, dtype=np.float64)
    for index in range(epochs.shape[0]):
        output[index] = mne_notch_filter(
            epochs[index].astype(np.float64),
            Fs=sfreq,
            freqs=valid_frequencies,
            verbose=False,
        )
    return output


def apply_bandpass(epochs: np.ndarray, sfreq: float, low: float, high: float) -> np.ndarray:
    """Apply MNE's FIR band-pass filter to each trial."""
    nyquist = sfreq / 2.0
    low_frequency = low if low > 0 else None
    high_frequency = high if high < nyquist else None
    output = np.empty_like(epochs, dtype=np.float64)
    for index in range(epochs.shape[0]):
        output[index] = mne_filter_data(
            epochs[index].astype(np.float64),
            sfreq=sfreq,
            l_freq=low_frequency,
            h_freq=high_frequency,
            method="fir",
            verbose=False,
        )
    return output


def crop_epochs(
    epochs: np.ndarray,
    sfreq: float,
    start_seconds: float,
    end_seconds: float,
) -> np.ndarray:
    """Crop epochs when the configured interval contains enough samples."""
    start = max(0, int(start_seconds * sfreq))
    end = min(epochs.shape[2], int(end_seconds * sfreq))
    return epochs[:, :, start:end] if end > start + 10 else epochs


def normalize_from_training(
    train_epochs: np.ndarray,
    test_epochs: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Apply training-set z-score statistics to both datasets."""
    mean = train_epochs.mean(axis=(0, 2), keepdims=True)
    standard_deviation = train_epochs.std(axis=(0, 2), keepdims=True) + 1e-8
    return (
        (train_epochs - mean) / standard_deviation,
        (test_epochs - mean) / standard_deviation,
    )


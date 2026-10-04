"""Filter Bank CSP feature construction."""

from __future__ import annotations

import numpy as np
import scipy.signal
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.preprocessing import StandardScaler

from backend.app.domain.constants import FBCSP_BANDS
from backend.app.models.csp import apply_csp, fit_csp


def _filter_band(epochs: np.ndarray, sampling_rate: float, low: float, high: float) -> np.ndarray:
    """Apply one zero-phase Butterworth band to every trial and channel at once."""
    sections = scipy.signal.butter(
        4,
        [low, high],
        btype="bandpass",
        fs=sampling_rate,
        output="sos",
    )
    return scipy.signal.sosfiltfilt(sections, epochs, axis=-1)


def build_fbcsp_features(
    train_epochs: np.ndarray,
    train_labels: np.ndarray,
    test_epochs: np.ndarray,
    sfreq: float,
    csp_components: int,
    best_feature_count: int,
) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Build, select, and scale subject-specific filter-bank CSP features.

    Filters and feature selection are fitted from the training partition only.
    Signal filtering is vectorized because its coefficients do not depend on labels.
    """
    train_features: list[np.ndarray] = []
    test_features: list[np.ndarray] = []
    combined_epochs = np.concatenate([train_epochs, test_epochs], axis=0)
    train_count = train_epochs.shape[0]

    for low, high in FBCSP_BANDS:
        if low <= 0 or high >= sfreq / 2:
            continue
        try:
            filtered = _filter_band(combined_epochs, sfreq, low, high)
            filtered_train = filtered[:train_count]
            filtered_test = filtered[train_count:]
            filters = fit_csp(filtered_train, train_labels, csp_components)
            train_features.append(apply_csp(filtered_train, filters))
            test_features.append(apply_csp(filtered_test, filters))
        except (ValueError, np.linalg.LinAlgError):
            # Short recordings or singular bands may be unusable; other valid
            # bands still provide a complete FBCSP representation.
            continue

    if not train_features:
        return None, None

    train_matrix = np.hstack(train_features)
    test_matrix = np.hstack(test_features)
    selected_count = min(max(1, best_feature_count), train_matrix.shape[1])
    selector = SelectKBest(f_classif, k=selected_count)
    selected_train = selector.fit_transform(train_matrix, train_labels)
    selected_test = selector.transform(test_matrix)

    # Retain a broadband CSP branch alongside the narrow-band features. This
    # makes FBCSP robust when a session contains discriminative broadband
    # structure that no single 4 Hz band captures well.
    broadband_filters = fit_csp(train_epochs, train_labels, csp_components)
    selected_train = np.hstack([
        apply_csp(train_epochs, broadband_filters),
        selected_train,
    ])
    selected_test = np.hstack([
        apply_csp(test_epochs, broadband_filters),
        selected_test,
    ])

    scaler = StandardScaler()
    return scaler.fit_transform(selected_train), scaler.transform(selected_test)

import numpy as np

from backend.app.domain.constants import FBCSP_BANDS
from backend.app.domain.types import AnalysisSettings
from backend.app.evaluation.metrics import compute_itr
from backend.app.models.csp import apply_csp
from backend.app.models.fbcsp import build_fbcsp_features
from backend.app.processing.channels import select_channels
from backend.app.processing.loaders import epoch_continuous


def test_epoch_continuous_extracts_both_motor_imagery_classes() -> None:
    eeg = np.arange(80, dtype=float).reshape(40, 2)
    triggers = np.zeros(40, dtype=int)
    triggers[2] = 1
    triggers[20] = -1

    epochs, labels = epoch_continuous(eeg, triggers, sfreq=10.0, trial_duration_s=1.0)

    assert epochs.shape == (2, 2, 10)
    assert labels.tolist() == [0, 1]


def test_select_channels_preserves_requested_order() -> None:
    epochs = np.zeros((3, 4, 20), dtype=float)

    selected, names = select_channels(
        epochs,
        source_channels=["C3", "Cz", "C4", "Pz"],
        selected_channels=["Pz", "C3"],
    )

    assert selected.shape == (3, 2, 20)
    assert names == ["Pz", "C3"]


def test_compute_itr_returns_zero_at_binary_chance_level() -> None:
    assert compute_itr(50.0, n_classes=2, trial_seconds=4.0) == 0.0


def test_default_analysis_band_is_four_to_forty_hertz() -> None:
    settings = AnalysisSettings()

    assert settings.high_pass_hz == 4.0
    assert settings.low_pass_hz == 40.0


def test_fbcsp_filter_bank_covers_and_overlaps_motor_imagery_bands() -> None:
    assert (4, 8) in FBCSP_BANDS
    assert (36, 40) in FBCSP_BANDS
    assert (10, 14) in FBCSP_BANDS


def test_csp_features_are_log_normalized_variances() -> None:
    rng = np.random.default_rng(42)
    epochs = rng.normal(size=(6, 4, 128))

    features = apply_csp(epochs, np.eye(4))

    np.testing.assert_allclose(np.exp(features).sum(axis=1), 1.0, atol=1e-8)


def test_fbcsp_features_are_scaled_from_training_statistics() -> None:
    rng = np.random.default_rng(42)
    sampling_rate = 128.0
    time = np.arange(256) / sampling_rate
    labels = np.repeat([0, 1], 10)
    train = rng.normal(scale=0.25, size=(20, 4, time.size))
    test = rng.normal(scale=0.25, size=(8, 4, time.size))
    train[labels == 0, 0] += np.sin(2 * np.pi * 10 * time)
    train[labels == 1, 1] += np.sin(2 * np.pi * 20 * time)

    train_features, test_features = build_fbcsp_features(
        train,
        labels,
        test,
        sampling_rate,
        csp_components=4,
        best_feature_count=8,
    )

    assert train_features is not None
    assert test_features is not None
    # The selected filter-bank features are augmented with four broadband CSP
    # features so FBCSP can retain useful information outside narrow bands.
    assert train_features.shape == (20, 12)
    assert test_features.shape == (8, 12)
    np.testing.assert_allclose(train_features.mean(axis=0), 0.0, atol=1e-8)

"""Application service that owns the complete EEG analysis sequence."""

from __future__ import annotations

import numpy as np

from backend.app.domain.errors import AnalysisInputError
from backend.app.domain.types import AnalysisSettings, EegDataset
from backend.app.evaluation.cross_validation import evaluate_cross_validation
from backend.app.evaluation.metrics import evaluate_holdout
from backend.app.models.csp import apply_csp, fit_csp
from backend.app.models.fbcsp import build_fbcsp_features
from backend.app.presentation.serializers import build_analysis_response
from backend.app.processing.artifacts import apply_optional_autoreject
from backend.app.processing.channels import select_channels
from backend.app.processing.filters import apply_bandpass, apply_notch, crop_epochs, normalize_from_training
from backend.app.processing.loaders import load_mat


def _select_requested_channels(dataset: EegDataset, selected: tuple[str, ...]) -> EegDataset:
    if not selected:
        return dataset
    epochs, names = select_channels(dataset.epochs, dataset.channel_names, list(selected))
    return EegDataset(epochs, dataset.labels, dataset.sampling_rate, names)


def run_analysis(
    training_bytes: bytes,
    test_bytes: bytes,
    training_name: str,
    test_name: str,
    settings: AnalysisSettings,
) -> dict:
    """Run preprocessing, both model pipelines, evaluation, and serialization."""
    train_dataset = load_mat(training_bytes, training_name, settings.epoch_tmax)
    test_dataset = load_mat(test_bytes, test_name, settings.epoch_tmax)
    if abs(train_dataset.sampling_rate - test_dataset.sampling_rate) > 1e-3:
        raise AnalysisInputError(
            f"Sampling rate mismatch: {train_dataset.sampling_rate} vs {test_dataset.sampling_rate}"
        )

    train_dataset = _select_requested_channels(train_dataset, settings.selected_channels)
    test_dataset = _select_requested_channels(test_dataset, settings.selected_channels)
    sampling_rate = train_dataset.sampling_rate
    raw_train = crop_epochs(
        train_dataset.epochs.copy(), sampling_rate, settings.epoch_tmin, settings.epoch_tmax
    )
    filtered_train = crop_epochs(
        apply_bandpass(apply_notch(train_dataset.epochs, sampling_rate), sampling_rate,
                       settings.high_pass_hz, settings.low_pass_hz),
        sampling_rate, settings.epoch_tmin, settings.epoch_tmax,
    )
    filtered_test = crop_epochs(
        apply_bandpass(apply_notch(test_dataset.epochs, sampling_rate), sampling_rate,
                       settings.high_pass_hz, settings.low_pass_hz),
        sampling_rate, settings.epoch_tmin, settings.epoch_tmax,
    )

    (
        filtered_train,
        train_labels,
        filtered_test,
        test_labels,
        keep_train,
        _,
        autoreject,
    ) = apply_optional_autoreject(
        filtered_train,
        train_dataset.labels,
        filtered_test,
        test_dataset.labels,
        sampling_rate,
        train_dataset.channel_names,
        settings.use_autoreject,
        settings.seed,
    )
    raw_train = raw_train[keep_train]
    filtered_train, filtered_test = normalize_from_training(filtered_train, filtered_test)
    trial_seconds = filtered_train.shape[2] / sampling_rate
    component_count = int(np.clip(
        settings.csp_components,
        2,
        min(filtered_train.shape[1] - 1, 8),
    ))

    csp_filters = fit_csp(filtered_train, train_labels, component_count)
    csp_train = apply_csp(filtered_train, csp_filters)
    csp_test = apply_csp(filtered_test, csp_filters)
    csp_holdout = evaluate_holdout(csp_train, train_labels, csp_test, test_labels, trial_seconds)

    fbcsp_train, fbcsp_test = build_fbcsp_features(
        filtered_train,
        train_labels,
        filtered_test,
        sampling_rate,
        component_count,
        settings.fbcsp_k_best,
    )
    fbcsp_holdout = (
        evaluate_holdout(fbcsp_train, train_labels, fbcsp_test, test_labels, trial_seconds)
        if fbcsp_train is not None and fbcsp_test is not None
        else csp_holdout
    )

    all_epochs = np.concatenate([filtered_train, filtered_test], axis=0)
    all_labels = np.concatenate([train_labels, test_labels], axis=0)
    csp_cross_validation = evaluate_cross_validation(
        all_epochs, all_labels, trial_seconds, settings.seed, "csp",
        component_count, sampling_rate, settings.fbcsp_k_best,
    )
    fbcsp_cross_validation = evaluate_cross_validation(
        all_epochs, all_labels, trial_seconds, settings.seed, "fbcsp",
        component_count, sampling_rate, settings.fbcsp_k_best,
    )

    return build_analysis_response(
        raw_train=raw_train,
        filtered_train=filtered_train,
        filtered_test=filtered_test,
        sampling_rate=sampling_rate,
        channel_names=train_dataset.channel_names,
        csp_cross_validation=csp_cross_validation,
        fbcsp_cross_validation=fbcsp_cross_validation,
        csp_holdout=csp_holdout,
        fbcsp_holdout=fbcsp_holdout,
        autoreject=autoreject,
    )

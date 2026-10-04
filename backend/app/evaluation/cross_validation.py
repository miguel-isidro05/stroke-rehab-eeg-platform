"""Cross-validation that evaluates feature builders without API dependencies."""

from __future__ import annotations

from typing import Literal

import numpy as np
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.model_selection import StratifiedKFold

from backend.app.domain.constants import CV_FOLDS
from backend.app.domain.errors import AnalysisInputError
from backend.app.evaluation.metrics import metrics_from_predictions
from backend.app.models.csp import apply_csp, fit_csp
from backend.app.models.fbcsp import build_fbcsp_features


def evaluate_cross_validation(
    epochs: np.ndarray,
    labels: np.ndarray,
    trial_seconds: float,
    seed: int,
    mode: Literal["csp", "fbcsp"],
    component_count: int,
    sfreq: float,
    fbcsp_k_best: int,
) -> dict:
    """Return out-of-fold metrics for CSP or FBCSP features."""
    unique_labels = np.unique(labels)
    class_counts = np.bincount(np.searchsorted(unique_labels, labels))
    if np.min(class_counts) < CV_FOLDS:
        raise AnalysisInputError(f"Need at least {CV_FOLDS} epochs per class for cross-validation")

    splitter = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=seed)
    expected_parts: list[np.ndarray] = []
    predicted_parts: list[np.ndarray] = []
    probability_parts: list[np.ndarray] = []

    for train_indices, validation_indices in splitter.split(np.zeros(labels.shape[0]), labels):
        train_epochs, train_labels = epochs[train_indices], labels[train_indices]
        validation_epochs, validation_labels = epochs[validation_indices], labels[validation_indices]
        if mode == "csp":
            filters = fit_csp(train_epochs, train_labels, component_count)
            train_features = apply_csp(train_epochs, filters)
            validation_features = apply_csp(validation_epochs, filters)
        else:
            train_features, validation_features = build_fbcsp_features(
                train_epochs,
                train_labels,
                validation_epochs,
                sfreq,
                component_count,
                fbcsp_k_best,
            )
            if train_features is None or validation_features is None:
                filters = fit_csp(train_epochs, train_labels, component_count)
                train_features = apply_csp(train_epochs, filters)
                validation_features = apply_csp(validation_epochs, filters)

        classifier = LinearDiscriminantAnalysis(solver="lsqr", shrinkage="auto")
        classifier.fit(train_features, train_labels)
        predicted = classifier.predict(validation_features)
        fold_probabilities = np.zeros((validation_features.shape[0], unique_labels.shape[0]))
        predicted_probabilities = classifier.predict_proba(validation_features)
        for column, label in enumerate(classifier.classes_):
            target_column = int(np.where(unique_labels == label)[0][0])
            fold_probabilities[:, target_column] = predicted_probabilities[:, column]
        expected_parts.append(validation_labels)
        predicted_parts.append(predicted)
        probability_parts.append(fold_probabilities)

    return metrics_from_predictions(
        np.concatenate(expected_parts),
        np.concatenate(predicted_parts),
        np.concatenate(probability_parts, axis=0),
        trial_seconds,
        unique_labels,
    )

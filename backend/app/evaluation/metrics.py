"""Model-independent classification metrics."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


def compute_itr(accuracy_percent: float, n_classes: int, trial_seconds: float) -> float:
    """Calculate information transfer rate in bits per minute."""
    probability = accuracy_percent / 100.0
    class_count = max(2, n_classes)
    if probability <= 1.0 / class_count or trial_seconds <= 0:
        return 0.0
    probability = float(np.clip(probability, 1.0 / class_count + 1e-6, 1.0 - 1e-6))
    bits_per_trial = (
        np.log2(class_count)
        + probability * np.log2(probability)
        + (1 - probability) * np.log2((1 - probability) / (class_count - 1))
    )
    return float(max(0.0, bits_per_trial * 60.0 / trial_seconds))


def metrics_from_predictions(
    expected: np.ndarray,
    predicted: np.ndarray,
    probabilities: np.ndarray,
    trial_seconds: float,
    labels: np.ndarray,
) -> dict[str, Any]:
    """Create the response metric, ROC, and confusion payload."""
    class_count = len(labels)
    accuracy = float(accuracy_score(expected, predicted) * 100)
    roc_auc = 0.5
    false_positive_rate: list[float] = [0.0, 1.0]
    true_positive_rate: list[float] = [0.0, 1.0]
    try:
        if class_count == 2:
            roc_auc = float(roc_auc_score(expected, probabilities[:, 1]))
            fpr, tpr, _ = roc_curve(expected, probabilities[:, 1], pos_label=labels[1])
            indices = np.linspace(0, len(fpr) - 1, min(100, len(fpr))).astype(int)
            false_positive_rate = fpr[indices].tolist()
            true_positive_rate = tpr[indices].tolist()
        else:
            roc_auc = float(roc_auc_score(expected, probabilities, multi_class="ovr", average="macro"))
    except Exception:
        # Undefined ROC values should not prevent the remaining metrics from returning.
        pass

    return {
        "metrics": {
            "accuracy": round(accuracy, 4),
            "kappa": round(float(cohen_kappa_score(expected, predicted)), 4),
            "f1": round(float(f1_score(expected, predicted, average="macro", zero_division=0)), 4),
            "precision": round(float(precision_score(expected, predicted, average="macro", zero_division=0)), 4),
            "recall": round(float(recall_score(expected, predicted, average="macro", zero_division=0)), 4),
            "roc_auc": round(roc_auc, 4),
            "itr": round(compute_itr(accuracy, class_count, trial_seconds), 2),
        },
        "roc": {"fpr": false_positive_rate, "tpr": true_positive_rate},
        "confusion": confusion_matrix(expected, predicted, labels=labels).tolist(),
    }


def evaluate_holdout(
    train_features: np.ndarray,
    train_labels: np.ndarray,
    test_features: np.ndarray,
    test_labels: np.ndarray,
    trial_seconds: float,
) -> dict[str, Any]:
    """Fit shrinkage LDA and evaluate one held-out dataset."""
    classifier = LinearDiscriminantAnalysis(solver="lsqr", shrinkage="auto")
    classifier.fit(train_features, train_labels)
    predicted = classifier.predict(test_features)
    labels = np.unique(np.concatenate([train_labels, test_labels]))
    probabilities = np.zeros((test_features.shape[0], labels.shape[0]), dtype=np.float64)
    for column, label in enumerate(classifier.classes_):
        target_column = int(np.where(labels == label)[0][0])
        probabilities[:, target_column] = classifier.predict_proba(test_features)[:, column]
    return metrics_from_predictions(test_labels, predicted, probabilities, trial_seconds, labels)


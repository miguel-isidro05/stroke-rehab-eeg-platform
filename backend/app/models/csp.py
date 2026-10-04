"""Common Spatial Patterns feature extraction."""

import numpy as np
import scipy.linalg


def fit_csp(train_epochs: np.ndarray, train_labels: np.ndarray, component_count: int) -> np.ndarray:
    """Fit regularized CSP filters and return components by channels."""
    classes = np.unique(train_labels)
    if classes.size != 2:
        raise ValueError(f"CSP requires exactly two classes, received {classes.size}")
    channel_count = train_epochs.shape[1]
    regularization = 0.10
    covariance_by_class = []
    for label in classes:
        class_epochs = train_epochs[train_labels == label]
        trial_covariances = []
        for trial in class_epochs:
            covariance = trial @ trial.T
            covariance /= np.trace(covariance) + 1e-12
            trial_covariances.append(covariance)
        covariance = np.mean(trial_covariances, axis=0)
        isotropic = np.trace(covariance) / channel_count * np.eye(channel_count)
        covariance = (1.0 - regularization) * covariance + regularization * isotropic
        covariance_by_class.append(covariance)

    first_covariance, second_covariance = covariance_by_class[0], covariance_by_class[1]
    try:
        _, vectors = scipy.linalg.eigh(first_covariance, first_covariance + second_covariance)
    except Exception:
        _, vectors = np.linalg.eigh(first_covariance)

    selected_count = int(np.clip(component_count, 2, channel_count))
    low_count = selected_count // 2
    high_count = selected_count - low_count
    indices = np.concatenate([
        np.arange(low_count),
        np.arange(vectors.shape[1] - high_count, vectors.shape[1]),
    ])
    return vectors[:, indices].T


def apply_csp(epochs: np.ndarray, filters: np.ndarray) -> np.ndarray:
    """Project trials and return normalized log-variance features."""
    features = []
    for trial in epochs:
        projected = filters @ trial
        variances = np.var(projected, axis=1)
        normalized = variances / (variances.sum() + 1e-12)
        features.append(np.log(normalized + 1e-12))
    return np.asarray(features)

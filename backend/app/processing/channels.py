"""Channel selection utilities."""

import numpy as np


def select_channels(
    epochs: np.ndarray,
    source_channels: list[str],
    selected_channels: list[str],
) -> tuple[np.ndarray, list[str]]:
    """Select available channels while preserving the requested order."""
    source_index = {channel: index for index, channel in enumerate(source_channels)}
    valid_channels = [channel for channel in selected_channels if channel in source_index]
    if not valid_channels:
        return epochs, source_channels
    indices = [source_index[channel] for channel in valid_channels]
    return epochs[:, indices, :], valid_channels


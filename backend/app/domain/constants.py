"""Shared scientific defaults for the stroke rehabilitation pipeline."""

CHANNEL_NAMES_16 = [
    "FC3", "FCz", "FC4", "C5", "C3", "C1", "Cz", "C2",
    "C4", "C6", "CP3", "CP1", "CPz", "CP2", "CP4", "Pz",
]

# Combine canonical 4 Hz bands with overlapping mu/beta bands. The overlap gives
# feature selection enough resolution to follow subject-specific spectral peaks.
FBCSP_BANDS = sorted({
    *((low, low + 4) for low in range(4, 40, 4)),
    *((low, low + 4) for low in range(8, 30, 2)),
})
DEFAULT_NOTCH_FREQUENCIES = (50.0, 60.0)
CV_FOLDS = 5

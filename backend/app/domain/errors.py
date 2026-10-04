"""Domain errors that the HTTP layer can safely expose as client errors."""


class AnalysisInputError(ValueError):
    """Raised when uploaded data or analysis settings are invalid."""


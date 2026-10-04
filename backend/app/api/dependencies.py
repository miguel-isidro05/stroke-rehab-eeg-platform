"""Runtime configuration for the HTTP application."""

import os


def cors_origins() -> list[str]:
    """Read comma-separated browser origins without affecting processing modules."""
    configured = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in configured.split(",") if origin.strip()]

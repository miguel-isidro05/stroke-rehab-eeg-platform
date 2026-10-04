"""FastAPI application bootstrap."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.dependencies import cors_origins
from backend.app.api.routes.analysis import router as analysis_router


def create_app() -> FastAPI:
    """Create the HTTP application without importing UI concerns."""
    application = FastAPI(title="Stroke Rehab BCI API", version="2.0.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(analysis_router)
    return application


app = create_app()

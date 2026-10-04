# Architecture

The application has two independent runtime boundaries: a Next.js browser client and a FastAPI analysis service. Neither side imports implementation code from the other; their shared boundary is the multipart request and JSON response exposed by `/process`.

## Runtime flow

```text
AnalysisWorkspace
  -> useAnalysis (files, settings, progress, results)
  -> analysis-client (multipart HTTP request)
  -> API route (request parsing and HTTP errors)
  -> analysis service (pipeline orchestration)
  -> processing -> models -> evaluation
  -> serializer (stable JSON contract)
  -> useAnalysis -> rendered comparison
```

Pre and post sessions run sequentially so the interface can communicate the active phase. That scheduling decision lives in the frontend hook and does not affect the numerical pipeline.

## Backend boundaries

- `backend/app/main.py`: application construction, middleware, and router registration only.
- `backend/app/api/`: converts HTTP input into domain values and domain errors into status codes.
- `backend/app/domain/`: stable types, constants, and exceptions shared by pure modules.
- `backend/app/processing/`: file loading and signal preparation. These modules never import FastAPI.
- `backend/app/models/`: CSP and FBCSP feature construction.
- `backend/app/evaluation/`: holdout metrics and cross-validation.
- `backend/app/services/analysis_service.py`: the only module that knows the complete pipeline order.
- `backend/app/presentation/serializers.py`: converts internal NumPy values into the public JSON response and limits chart payload size.

Dependencies point inward: HTTP code may call the service, while processing and model code remain unaware of HTTP and UI concerns.

## Frontend boundaries

- `src/features/analysis/analysis-workspace.tsx`: visual composition for the existing MVP flow.
- `src/features/analysis/hooks/use-analysis.ts`: state transitions and pre/post orchestration.
- `src/features/analysis/api/analysis-client.ts`: the only analysis module that performs network requests.
- `src/features/analysis/types/analysis.ts`: API and feature-level TypeScript types.
- `src/features/analysis/config/montage.ts`: immutable electrode names, coordinates, and colors.
- `src/components/ui/`: reusable primitives with no EEG or rehabilitation behavior.

The workspace may be split into smaller visual components as panels grow, but chart rendering stays in the feature and network/state logic stays outside components.

## Configuration

`NEXT_PUBLIC_API_BASE_URL` selects the API from the browser. `CORS_ORIGINS` is a comma-separated allowlist read by FastAPI. Copy `.env.example` to `.env.local` for local overrides. Secrets must not use the `NEXT_PUBLIC_` prefix.

## Contract stability

The endpoints `/health`, `/process`, and `/api/preprocess` remain public. Additive JSON fields are safe when TypeScript types and serializer tests are updated together. Renaming or removing a field requires an explicit API migration.

## Verification layers

- Unit tests protect processing shapes and numerical helpers.
- Integration tests protect routes and validation behavior.
- ESLint and the production build protect the React/TypeScript boundary.
- A manual four-file run protects the real pre/post user journey and its visual states.

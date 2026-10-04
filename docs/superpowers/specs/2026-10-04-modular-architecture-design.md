# Modular architecture design

Date: 2026-10-04

## Purpose

Reorganize the application so contributors can work on the EEG pipeline, HTTP API, and web interface independently. The refactor must preserve the current upload, configuration, training, and result flows.

The repository should make these questions easy to answer:

- Where do I add a processing step?
- Where do I add a model?
- Where do I change an API contract?
- Where do I add a chart or interface panel?
- Which tests protect each change?

## Constraints

- Preserve the current visual design and user flow.
- Preserve the `/health`, `/process`, and `/api/preprocess` endpoints.
- Preserve the existing response fields consumed by the frontend.
- Keep Python numerical code independent from FastAPI.
- Keep the TypeScript API client independent from React.
- Use English for identifiers, docstrings, code comments, and contributor documentation.
- Comments must explain intent, constraints, or extension points. They must not restate the code.
- Do not introduce a monorepo framework, state-management library, or dependency-injection framework.
- Preserve existing user changes and assets.

## Target structure

```text
stroke-rehab-web/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   └── routes/
│   │   │       └── analysis.py
│   │   ├── domain/
│   │   │   ├── constants.py
│   │   │   └── types.py
│   │   ├── evaluation/
│   │   │   ├── cross_validation.py
│   │   │   └── metrics.py
│   │   ├── models/
│   │   │   ├── csp.py
│   │   │   └── fbcsp.py
│   │   ├── presentation/
│   │   │   └── serializers.py
│   │   ├── processing/
│   │   │   ├── artifacts.py
│   │   │   ├── channels.py
│   │   │   ├── filters.py
│   │   │   └── loaders.py
│   │   └── services/
│   │       └── analysis_service.py
│   └── tests/
│       ├── unit/
│       └── integration/
├── src/
│   ├── app/
│   ├── components/
│   │   └── ui/
│   ├── features/
│   │   └── analysis/
│   │       ├── api/
│   │       │   └── analysis-client.ts
│   │       ├── components/
│   │       │   ├── charts/
│   │       │   ├── data-import-panel.tsx
│   │       │   ├── processing-panel.tsx
│   │       │   ├── results-panel.tsx
│   │       │   └── training-theatre.tsx
│   │       ├── config/
│   │       │   └── montage.ts
│   │       ├── hooks/
│   │       │   └── use-analysis.ts
│   │       ├── types/
│   │       │   └── analysis.ts
│   │       └── analysis-workspace.tsx
│   └── lib/
├── docs/
│   ├── ARCHITECTURE.md
│   └── ADDING_FEATURES.md
└── .env.example
```

## Backend responsibilities

### API layer

`backend/app/main.py` creates the FastAPI application, configures middleware, and registers routers. It contains no EEG processing logic.

`backend/app/api/routes/analysis.py` converts multipart form fields into a domain request, reads uploaded bytes, calls the analysis service, and maps known domain errors to HTTP responses.

`backend/app/api/dependencies.py` owns configuration that is specific to HTTP execution, including CORS origins and application settings.

### Domain layer

`domain/constants.py` owns the canonical channel list, frequency bands, evaluation defaults, and numerical limits that are shared across processing modules.

`domain/types.py` defines typed dataclasses for analysis settings, loaded EEG datasets, prepared datasets, model results, and complete analysis results. NumPy arrays remain internal to the backend and never appear directly in HTTP contracts.

### Processing layer

`processing/loaders.py` parses supported file formats and returns a loaded dataset. The first migration keeps the current MAT behavior. CSV and EDF support can be added through loader functions with the same return type.

`processing/channels.py` validates and selects electrodes.

`processing/filters.py` owns notch filtering, band-pass filtering, normalization, epoch cropping, and signal-shape validation.

`processing/artifacts.py` owns optional AutoReject integration and reports which epochs were removed or modified.

### Model layer

`models/csp.py` owns CSP fitting and feature extraction.

`models/fbcsp.py` owns filter-bank construction and feature selection. It may depend on CSP and filtering functions, but it must not depend on FastAPI or serializers.

New classifiers should expose a small fit-and-evaluate boundary that the analysis service can call. Adding a model must not require editing the loader or API route.

### Evaluation layer

`evaluation/metrics.py` calculates accuracy, kappa, macro F1, precision, recall, ROC AUC, confusion matrices, ROC points, and information transfer rate.

`evaluation/cross_validation.py` owns fold creation and out-of-fold predictions. It receives feature-building callables so evaluation does not contain model-specific branches for every future model.

### Service and presentation layers

`services/analysis_service.py` is the only module that knows the complete processing sequence. It validates compatible datasets, applies preprocessing, executes models, runs evaluation, and returns a typed result.

`presentation/serializers.py` converts the typed result into the existing JSON response. Downsampling for charts belongs here because it is an output-size concern, not a model concern.

## Frontend responsibilities

### API and types

`features/analysis/types/analysis.ts` contains API response types, upload roles, settings, and UI state types.

`features/analysis/api/analysis-client.ts` builds multipart requests, validates HTTP responses, and normalizes API errors. It reads `NEXT_PUBLIC_API_BASE_URL` with a localhost fallback. React components do not call `fetch` directly.

### State and orchestration

`features/analysis/hooks/use-analysis.ts` owns uploaded files, settings, dirty state, pre/post execution, results, and recoverable errors. It exposes commands and read-only state to the workspace.

`features/analysis/analysis-workspace.tsx` composes the page sections. It should remain small enough to show the entire user flow without containing chart math, HTTP code, or large component implementations.

### Components

Feature components receive typed props and render one concern:

- `data-import-panel.tsx` handles the four file inputs.
- `processing-panel.tsx` renders preprocessing and model controls.
- `training-theatre.tsx` renders the live pre/post state and montage.
- `results-panel.tsx` composes comparison and session details.
- `components/charts/` contains ROC and EEG chart implementations plus chart-only math.

Generic primitives remain under `src/components/ui`. Domain components must not be placed there.

### Configuration

`features/analysis/config/montage.ts` owns channel names, electrode coordinates, channel colors, and other immutable display configuration.

## Data flow

1. The workspace receives state and commands from `useAnalysis`.
2. File and configuration components update the hook state.
3. The hook calls `analysis-client.ts` once for the pre dataset and once for the post dataset.
4. The API route parses each request and creates an `AnalysisSettings` value.
5. The analysis service loads, prepares, models, evaluates, and serializes the session.
6. The hook stores both responses and exposes them to the results components.

The pre/post requests remain sequential because the interface uses their order to communicate progress. This can change later without changing processing modules.

## Errors

Backend modules raise specific domain exceptions for invalid files, incompatible sample rates, insufficient trials, and unavailable optional dependencies. The API route maps these exceptions to status `400`. Unexpected exceptions remain status `500` and keep a short public message.

The frontend API client converts non-success responses into `AnalysisApiError`. The hook converts connection failures into the current backend-unavailable message and clears stale results before a new run.

## Testing

Backend unit tests cover:

- Continuous epoch extraction.
- MAT loading and shape normalization.
- Channel selection.
- Filter validation and output shape.
- CSP and FBCSP feature shapes.
- Metrics and five-fold evaluation.
- Response serialization.

Backend integration tests cover `/health` and request validation without running the complete large dataset for every test.

Frontend verification covers:

- TypeScript compilation.
- ESLint.
- Production build.
- A real P1 pre/post analysis through the UI.
- Desktop and 390 px responsive layouts.
- Browser console errors.

## Contributor documentation

`docs/ARCHITECTURE.md` explains module boundaries and the runtime flow.

`docs/ADDING_FEATURES.md` contains focused examples for adding a model, preprocessing step, response field, chart, and configuration control.

The root README contains correct setup commands, environment variables, a short directory map, and links to both documents.

## Migration sequence

1. Add domain constants and types.
2. Move pure processing functions and preserve their signatures.
3. Move model and evaluation functions.
4. Introduce the service and serializer.
5. Reduce `main.py` to application setup and router registration.
6. Extract TypeScript types, immutable configuration, and the API client.
7. Extract the analysis hook.
8. Split charts and page sections.
9. Replace the legacy component with the workspace composition.
10. Add tests and contributor documentation.
11. Run static checks, backend tests, the real P1 workflow, and responsive browser checks.

Each step must leave imports resolvable. The old implementation is removed only after its replacement passes the relevant checks.

## Acceptance criteria

- `backend/app/main.py` contains application construction and router registration only.
- No processing or model module imports FastAPI.
- No React component calls `fetch`.
- No domain-specific React component remains under `src/components/ui`.
- The existing API paths and response structure continue to work.
- The current visual layout remains recognizably unchanged.
- Source comments and docstrings are in English.
- Contributor documentation identifies the exact file to change for common extensions.
- Lint, production build, backend tests, and the complete P1 workflow pass.
- The page has no horizontal overflow at 390 px.

## Non-goals

- Adding new models or signal formats during this refactor.
- Changing model metrics or scientific interpretation.
- Replacing FastAPI, Next.js, Framer Motion, MNE, or scikit-learn.
- Introducing a database, authentication, background queue, or deployment platform.
- Redesigning the interface.

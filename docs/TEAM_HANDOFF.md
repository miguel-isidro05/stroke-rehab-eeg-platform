# Stroke Rehab BCI: team handoff

Last updated: October 4, 2026

## Project summary

This repository contains a hackathon MVP for comparing motor-imagery EEG recordings before and after stroke rehabilitation. A user uploads PRE and POST training/test datasets, applies one shared preprocessing and model configuration, and receives a visual comparison of signal data and classification performance.

The MVP measures changes in EEG decodability. It does not claim to diagnose a patient or prove clinical recovery.

The working goal is:

> Develop a reproducible EEG analysis pipeline that quantifies changes in motor-imagery decoding performance before and after stroke rehabilitation.

## What is implemented

### User interface

- Four-file upload flow: PRE training, PRE test, POST training, and POST test.
- Shared controls for band-pass filtering, notch filtering, epoch timing, CSP components, and FBCSP feature selection.
- Sequential PRE and POST processing with visible progress states.
- A 16-electrode motor-cortex montage used during the training view.
- CSP-LDA and FBCSP-LDA comparison cards.
- Accuracy, Cohen's kappa, macro F1, precision, recall, ROC-AUC, confusion matrices, ROC curves, and PSD views.
- Responsive dark interface using the established indigo and emerald visual language.
- Hydration protection on the root HTML element for attributes injected by browser extensions such as LanguageTool.

### EEG and machine-learning pipeline

- Loading of the BR41N.IO flat MAT format and the legacy nested MAT structure.
- Extraction of continuous recordings into trials using `+1` and `-1` triggers.
- Fixed-channel selection for the 16-channel motor-imagery montage.
- FIR notch and band-pass filtering through MNE.
- Epoch cropping and normalization using training-set statistics.
- Optional AutoReject integration.
- CSP feature extraction.
- Filter Bank CSP with canonical and overlapping 4 Hz bands from 4 to 40 Hz, ANOVA feature selection, a broadband CSP residual branch, and training-only standardization.
- Shrinkage LDA classification.
- Holdout evaluation and five-fold stratified cross-validation.
- Compact response serialization for browser charts.

### Engineering work

- The original monolithic FastAPI file was separated into API, domain, processing, model, evaluation, service, and presentation layers.
- React network logic moved into a typed API client.
- Upload, configuration, progress, error, and result state moved into a dedicated hook.
- Analysis-specific code moved from generic UI components into `src/features/analysis/`.
- Runtime URLs and CORS origins are configurable through environment variables.
- Backend unit and route integration tests were added.
- All new source comments, docstrings, and contributor documentation are in English.

## Repository map

```text
stroke-rehab-web/
├── backend/
│   ├── app/
│   │   ├── main.py                  FastAPI application bootstrap
│   │   ├── api/                     HTTP parsing, routes, and CORS settings
│   │   ├── domain/                  Shared types, constants, and errors
│   │   ├── processing/              Loading, channels, filters, and artifacts
│   │   ├── models/                  CSP and FBCSP feature pipelines
│   │   ├── evaluation/              Metrics and cross-validation
│   │   ├── services/                Complete analysis sequence
│   │   └── presentation/            Stable JSON response construction
│   ├── tests/
│   │   ├── unit/                    Numerical and processing tests
│   │   └── integration/             FastAPI route tests
│   ├── requirements.txt             Runtime Python dependencies
│   └── requirements-dev.txt         Runtime plus test dependencies
├── src/
│   ├── app/                         Next.js layout, page, and global styles
│   ├── features/analysis/
│   │   ├── analysis-workspace.tsx   Current visual composition and charts
│   │   ├── api/analysis-client.ts   Multipart API client
│   │   ├── hooks/use-analysis.ts    PRE/POST state and orchestration
│   │   ├── types/analysis.ts        TypeScript contracts
│   │   └── config/montage.ts        Electrode positions and display colors
│   ├── components/ui/               Domain-neutral UI primitives
│   └── lib/                         Shared frontend utilities
├── public/assets/                    g.tec logo and EEG-cap image
├── docs/ARCHITECTURE.md              Layer boundaries and runtime flow
├── docs/ADDING_FEATURES.md           Extension instructions
├── docs/TEAM_HANDOFF.md              This document
├── .codex/project-memory.md          Visual constraints for coding agents
└── .env.example                      Local environment template
```

## Runtime flow

```text
AnalysisWorkspace
  -> useAnalysis
  -> analysis-client
  -> POST /process
  -> FastAPI route
  -> analysis service
  -> loader and preprocessing
  -> CSP/FBCSP models
  -> cross-validation and metrics
  -> serializer
  -> JSON response
  -> PRE/POST visual comparison
```

The browser sends PRE first and POST second. This is intentional because the interface communicates which phase is currently running. The backend processes one dataset pair per request.

## Public API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Confirms that the API is running. |
| `POST` | `/process` | Main multipart EEG analysis endpoint. |
| `POST` | `/api/preprocess` | Compatibility alias for `/process`. |

The response contract is assembled in `backend/app/presentation/serializers.py` and represented in TypeScript by `ApiResult` in `src/features/analysis/types/analysis.ts`.

## Local setup

From the `stroke-rehab-web` directory:

```bash
npm install
python -m pip install -r backend/requirements-dev.txt
cp .env.example .env.local
```

Start the backend:

```bash
python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend in a second terminal:

```bash
npm run dev
```

Open `http://localhost:3000`. The API health check is `http://localhost:8000/health`.

## Environment variables

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

`NEXT_PUBLIC_API_BASE_URL` is visible to the browser. Do not place secrets in variables with the `NEXT_PUBLIC_` prefix.

## Verification status

The following checks passed on October 4, 2026:

```bash
npm run lint
npm run build
python -m pytest backend/tests -q
```

Current result: ESLint passed, the Next.js production build and TypeScript checks passed, and all eight backend tests passed. The browser console was also checked after the hydration fix and contained no errors.

Before merging new work, run the same commands and complete one real four-file analysis with the hackathon dataset.

## Where to make changes

| Task | Primary location | Related locations |
| --- | --- | --- |
| Add a preprocessing operation | `backend/app/processing/` | `domain/types.py`, `analysis_service.py`, unit tests |
| Add or modify a model | `backend/app/models/` | `evaluation/`, `analysis_service.py`, serializer |
| Change pipeline order | `backend/app/services/analysis_service.py` | Processing and model tests |
| Add an HTTP request field | `backend/app/api/routes/analysis.py` | `domain/types.py`, `analysis-client.ts` |
| Add an API response field | `backend/app/presentation/serializers.py` | `types/analysis.ts`, UI, integration tests |
| Add a chart or analysis panel | `src/features/analysis/` | `types/analysis.ts` |
| Change upload or processing state | `src/features/analysis/hooks/use-analysis.ts` | `analysis-client.ts` |
| Change electrode positions or colors | `src/features/analysis/config/montage.ts` | Training view |
| Change API host or allowed origins | `.env.local` | `.env.example` |
| Change generic buttons or primitives | `src/components/ui/` | Keep EEG behavior outside this folder |

## Rules for teammates and coding agents

Read these files before editing:

1. `docs/TEAM_HANDOFF.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ADDING_FEATURES.md`
4. `.codex/project-memory.md` for visual work

Preserve the following decisions:

- Keep the current dark composition and indigo/emerald palette. A request to make the interface “less AI” means improving typography, spacing, card hierarchy, states, and accessibility. It does not authorize a complete redesign.
- Keep numerical processing independent from FastAPI.
- Keep browser requests in `analysis-client.ts`; React components must not call `fetch` directly.
- Keep the existing `/health`, `/process`, and `/api/preprocess` routes unless a coordinated API migration is approved.
- Keep comments and documentation in English. Comments should explain intent, constraints, or extension points instead of restating the code.
- Add or update tests with behavioral changes.
- Do not overwrite unrelated working-tree changes.

For agent assignments, use module ownership to avoid conflicts. One agent can own backend processing and models, another can own the API contract, and another can own the analysis UI. Do not assign two agents to `analysis-workspace.tsx` at the same time.

## Known limitations and next work

- The backend currently implements MAT loading. The file picker mentions CSV and EDF, but those loaders still need to be implemented before those formats are advertised as supported.
- `analysis-workspace.tsx` still contains several chart and panel implementations. The next safe frontend refactor is to extract them into `src/features/analysis/components/` without changing the current layout.
- Analysis results are held in browser memory and are not persisted.
- The current results are research-oriented metrics and have not been clinically validated.
- Optional AutoReject behavior depends on the package being available and should receive a dedicated integration test before being enabled by default.
- A full test with the official four-file hackathon dataset remains the final acceptance check after changes to processing or models.
- The Next.js development overlay reports version staleness for 16.2.4. This is informational and was not the source of the hydration error.

## Recommended next priorities

1. Add a reproducible end-to-end fixture based on a small, anonymized EEG sample.
2. Implement CSV and EDF loaders or remove those extensions from the upload copy until supported.
3. Extract charts and panels from `analysis-workspace.tsx` while preserving the current viewport behavior.
4. Add downloadable session results for judges and researchers.
5. Document the exact competition dataset fields, labels, and expected channel order.

The current codebase is ready for teammates to extend by layer. Processing changes should stay in Python modules, API changes should preserve the shared contract, and interface work should remain inside the analysis feature.

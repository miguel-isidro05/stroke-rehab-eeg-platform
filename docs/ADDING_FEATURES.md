# Adding features

Use the narrowest extension point below. Keeping changes inside one layer makes review and rollback much easier during the hackathon.

## Add a preprocessing step

1. Implement a pure array transformation in `backend/app/processing/`.
2. Add its setting to `backend/app/domain/types.py` only if it is configurable.
3. Call it from `backend/app/services/analysis_service.py` in the intended pipeline order.
4. Add a shape and validation test under `backend/tests/unit/`.
5. If exposed in the UI, add the form field in `analysis-client.ts` and its state command in `use-analysis.ts`.

Processing functions should receive explicit inputs and return data; they should not read environment variables, HTTP requests, or React state.

## Add a classifier or feature model

1. Create a module under `backend/app/models/` with small fit and transform functions.
2. Reuse `evaluation/metrics.py` for holdout scoring and extend `evaluation/cross_validation.py` for out-of-fold evaluation.
3. Register the model sequence in `analysis_service.py`.
4. Add its serialized result in `presentation/serializers.py`.
5. Extend `ApiResult` in `src/features/analysis/types/analysis.ts` and render it in the analysis feature.

Do not import FastAPI from a model. Avoid returning classifier objects through the API; return metrics, curves, and compact display data.

## Support CSV or EDF input

Add a loader in `backend/app/processing/loaders.py` that returns `EegDataset`. Dispatch by validated content or extension in the same module. The service must not contain format-specific parsing branches.

## Add an API field

For a request field, update `AnalysisSettings`, the route form parameter, and `analysis-client.ts`. For a response field, update the serializer and `ApiResult`. Add or update an integration test before changing the UI.

## Add a chart or panel

Keep EEG-specific visuals under `src/features/analysis/`. Receive typed data through props and keep derived display math local to the chart module. Generic buttons, inputs, and layout primitives belong in `src/components/ui/`; analysis panels do not.

If a component needs to call the server or coordinate both sessions, add that behavior to `analysis-client.ts` or `use-analysis.ts` instead of calling `fetch` from JSX.

## Add a configuration control

1. Add its type and default in `types/analysis.ts` and `use-analysis.ts`.
2. Expose a named update command from the hook.
3. Serialize it in `analysis-client.ts`.
4. Parse it in the API route and store it in `AnalysisSettings`.
5. Consume it in the service or the relevant processing/model module.

Changing a setting must invalidate stale results, set the dirty state, and preserve uploaded files.

## Before handing off

```bash
npm run lint
npm run build
python -m pytest backend/tests -q
```

Then run one complete four-file analysis. Check the browser console, the error state with the API stopped, and the layout at desktop width and 390 px. Update `docs/ARCHITECTURE.md` if a responsibility moved between layers.

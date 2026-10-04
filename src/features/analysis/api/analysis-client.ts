import { FIXED_CHANNELS } from "@/features/analysis/config/montage";
import type { ApiResult, Filters, HyperParameters } from "@/features/analysis/types/analysis";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface AnalysisRequest {
  trainingFile: File;
  testFile: File;
  filters: Filters;
  notchFrequencies: number[];
  hyperParameters: HyperParameters;
}

export class AnalysisApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AnalysisApiError";
  }
}

function buildAnalysisForm(request: AnalysisRequest): FormData {
  const form = new FormData();
  form.append("training_file", request.trainingFile);
  form.append("test_file", request.testFile);
  form.append("high_pass_hz", String(request.filters.highPassHz));
  form.append("low_pass_hz", String(request.filters.lowPassHz));
  form.append("notch_hz", request.notchFrequencies.join(","));
  form.append("epoch_tmin", String(request.hyperParameters.epochTmin));
  form.append("epoch_tmax", String(request.hyperParameters.epochTmax));
  form.append("csp_components", String(request.hyperParameters.cspComponents));
  form.append("fbcsp_k_best", String(request.hyperParameters.fbcspKBest));
  form.append("seed", "42");
  form.append("selected_channels", JSON.stringify(FIXED_CHANNELS));
  return form;
}

/** Run one analysis phase. React state remains the caller's responsibility. */
export async function runAnalysis(request: AnalysisRequest): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/process`, {
      method: "POST",
      body: buildAnalysisForm(request),
    });
  } catch {
    throw new AnalysisApiError("Backend unavailable — start the FastAPI server");
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new AnalysisApiError(body || `Analysis failed with HTTP ${response.status}`, response.status);
  }
  return response.json() as Promise<ApiResult>;
}


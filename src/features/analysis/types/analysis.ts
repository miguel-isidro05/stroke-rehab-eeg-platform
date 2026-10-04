export type FileRole = "pre-train" | "pre-test" | "post-train" | "post-test";
export type ProcessingPhase = "idle" | "pre" | "post";
export type DetailTab = "pre" | "post";

export interface UploadedFile {
  role: FileRole;
  file: File;
}

export interface Filters {
  highPassHz: number;
  lowPassHz: number;
}

export interface HyperParameters {
  epochTmin: number;
  epochTmax: number;
  cspComponents: number;
  fbcspKBest: number;
}

export interface ApiMetric {
  accuracy: number;
  kappa: number;
  f1: number;
  precision: number;
  recall: number;
  roc_auc: number;
}

export interface ApiResult {
  fs: number;
  n_epochs: { train: number; test: number };
  channel_names: string[];
  temporal: {
    raw: number[][];
    filtered: number[][];
    n_samples: number;
    duration_s: number;
    events?: { t: number; label: string }[];
  };
  temporal_test?: {
    raw: number[][];
    filtered: number[][];
    n_samples: number;
    duration_s: number;
    events?: { t: number; label: string }[];
  };
  psd: { freqs: number[]; train: number[]; test: number[] };
  metrics: {
    csp_lda: ApiMetric;
    fbcsp_lda: ApiMetric;
    evaluation?: { method: string; folds: number; dataset?: string };
  };
  confusion: { csp_lda: number[][]; fbcsp_lda: number[][] };
  roc: {
    csp_lda: { fpr: number[]; tpr: number[] };
    fbcsp_lda: { fpr: number[]; tpr: number[] };
  };
}

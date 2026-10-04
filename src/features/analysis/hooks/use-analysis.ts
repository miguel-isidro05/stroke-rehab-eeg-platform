"use client";

import { useState } from "react";

import { runAnalysis } from "@/features/analysis/api/analysis-client";
import type {
  ApiResult,
  DetailTab,
  FileRole,
  Filters,
  HyperParameters,
  ProcessingPhase,
  UploadedFile,
} from "@/features/analysis/types/analysis";

const REQUIRED_FILE_ROLES: FileRole[] = ["pre-train", "pre-test", "post-train", "post-test"];

export function useAnalysis() {
  const [files, setFiles] = useState<Partial<Record<FileRole, UploadedFile>>>({});
  const [preResult, setPreResult] = useState<ApiResult | null>(null);
  const [postResult, setPostResult] = useState<ApiResult | null>(null);
  const [processing, setProcessing] = useState<ProcessingPhase>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [processKey, setProcessKey] = useState(0);
  const [filters, setFilters] = useState<Filters>({ highPassHz: 4, lowPassHz: 40 });
  const [notchFrequencies, setNotchFrequencies] = useState<number[]>([50, 60]);
  const [hyperParameters, setHyperParameters] = useState<HyperParameters>({
    epochTmin: 2,
    epochTmax: 6,
    cspComponents: 4,
    fbcspKBest: 16,
  });
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("pre");

  const allFilesLoaded = REQUIRED_FILE_ROLES.every(role => files[role]);
  const bothProcessed = Boolean(preResult && postResult);
  const currentStep = !allFilesLoaded ? 1 : !bothProcessed ? 2 : 3;

  function resetResults() {
    setPreResult(null);
    setPostResult(null);
    setApiError(null);
  }

  function setFile(role: FileRole, file: File) {
    setFiles(previous => ({ ...previous, [role]: { role, file } }));
    resetResults();
    setIsConfigDirty(false);
  }

  function markDirty() {
    resetResults();
    setIsConfigDirty(true);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(previous => previous[key] === value ? previous : { ...previous, [key]: value });
    markDirty();
  }

  function setHyperParameter<K extends keyof HyperParameters>(key: K, value: HyperParameters[K]) {
    setHyperParameters(previous => previous[key] === value ? previous : { ...previous, [key]: value });
    markDirty();
  }

  function toggleNotchFrequency(frequency: number) {
    setNotchFrequencies(previous => previous.includes(frequency)
      ? previous.filter(value => value !== frequency)
      : [...previous, frequency].sort((left, right) => left - right));
    markDirty();
  }

  async function processAnalysis() {
    if (!allFilesLoaded) return;
    resetResults();
    try {
      setProcessing("pre");
      const pre = await runAnalysis({
        trainingFile: files["pre-train"]!.file,
        testFile: files["pre-test"]!.file,
        filters,
        notchFrequencies,
        hyperParameters,
      });
      setProcessing("post");
      const post = await runAnalysis({
        trainingFile: files["post-train"]!.file,
        testFile: files["post-test"]!.file,
        filters,
        notchFrequencies,
        hyperParameters,
      });
      setPreResult(pre);
      setPostResult(post);
      setProcessKey(key => key + 1);
      setIsConfigDirty(false);
      setDetailTab("pre");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
      setPreResult(null);
      setPostResult(null);
    } finally {
      setProcessing("idle");
    }
  }

  return {
    files,
    preResult,
    postResult,
    processing,
    apiError,
    processKey,
    filters,
    notchFrequencies,
    hyperParameters,
    isConfigDirty,
    detailTab,
    allFilesLoaded,
    bothProcessed,
    currentStep,
    setFile,
    setFilter,
    setHyperParameter,
    toggleNotchFrequency,
    setDetailTab,
    processAnalysis,
  };
}

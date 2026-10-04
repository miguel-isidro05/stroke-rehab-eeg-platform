"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { FIXED_CHANNELS, MONTAGE_POINTS, channelColor } from "@/features/analysis/config/montage";
import { useAnalysis } from "@/features/analysis/hooks/use-analysis";
import type {
  ApiMetric,
  ApiResult,
  FileRole,
  UploadedFile,
} from "@/features/analysis/types/analysis";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Upload, Check, Zap, Loader2,
  AlertCircle, Activity, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(2)} MB`;
}
function perfTier(acc: number): { label: string; cls: string } {
  if (acc >= 85) return { label: "Excellent", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" };
  if (acc >= 75) return { label: "Good",      cls: "bg-blue-500/10 text-blue-300 border-blue-500/20"         };
  if (acc >= 65) return { label: "Fair",      cls: "bg-amber-500/10 text-amber-400 border-amber-500/20"      };
  if (acc >= 55) return { label: "Below Avg", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20"   };
  return               { label: "Chance",    cls: "bg-red-500/10 text-red-400 border-red-500/20"             };
}

// ─── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ children, accent = "indigo" }: { children: ReactNode; accent?: "indigo" | "emerald" }) {
  return (
    <span className={cn(
      "text-[11px] font-semibold tracking-[0.02em]",
      accent === "emerald" ? "text-emerald-300/80" : "text-slate-300",
    )}>
      {children}
    </span>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────────
function DropZone({ role, label, file, onFile }: {
  role: FileRole; label: string; file: UploadedFile | null;
  onFile: (role: FileRole, f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const loaded = Boolean(file);
  return (
    <label className={cn(
      "group relative flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-[border-color,background-color,transform] duration-150 active:scale-[0.995]",
      drag   ? "border-indigo-400/40 bg-indigo-500/[0.05]" :
      loaded ? "border-emerald-500/25 bg-emerald-500/[0.03]" :
               "border-white/[0.08] bg-[#0c0e17] hover:border-indigo-400/25 hover:bg-indigo-500/[0.025]",
    )}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(role, f); }}
    >
      <input type="file" accept=".mat,.csv,.edf" className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(role, f); }} />

      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
        loaded ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/[0.07] bg-white/[0.03]",
      )}>
        {loaded
          ? <Check className="h-3.5 w-3.5 text-emerald-400" />
          : <Upload className="h-3 w-3 text-slate-600 group-hover:text-slate-500" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-[0.01em] text-slate-300">{label}</p>
        {loaded ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-300">{file!.file.name}</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-slate-500 group-hover:text-slate-400">
            Drop a file or browse · MAT, CSV, EDF
          </p>
        )}
      </div>

      {loaded && (
        <span className="shrink-0 font-mono text-[10px] text-slate-500">{fmtBytes(file!.file.size)}</span>
      )}
    </label>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, unit, onChange, step = 1 }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void; step?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-slate-300">{value}{unit && ` ${unit}`}</span>
      </div>
      <div className="relative h-px rounded-full bg-white/[0.08]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500/40 transition-all" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          aria-label={label}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 h-4 w-full -translate-y-1.5 cursor-pointer opacity-0" />
      </div>
    </div>
  );
}

// ─── Metrics Card ─────────────────────────────────────────────────────────────
function MetricsCard({ m, label, accentColor }: { m: ApiMetric; label: string; accentColor: string }) {
  const tier = perfTier(m.accuracy);
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0c0e17] shadow-[0_8px_28px_rgba(0,0,0,0.14)]">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
        <span className="text-xs font-semibold tracking-[0.01em] text-slate-300">{label}</span>
        <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider", tier.cls)}>
          {tier.label}
        </span>
      </div>
      <div className="px-4 pt-3 pb-4">
        <div className="mb-0.5 flex items-baseline gap-1">
          <span className="text-[2.25rem] font-light tabular-nums leading-none text-slate-50">{m.accuracy.toFixed(2)}</span>
          <span className="text-sm text-slate-600">%</span>
        </div>
        <div className="mb-4 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accentColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, m.accuracy)}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </div>
        <div className="grid grid-cols-5 gap-x-2 gap-y-2.5 border-t border-white/[0.04] pt-3">
          {([
            ["κ",         m.kappa.toFixed(3)],
            ["ROC AUC",   m.roc_auc.toFixed(3)],
            ["F1",        m.f1.toFixed(3)],
            ["Prec",      m.precision.toFixed(3)],
            ["Recall",    m.recall.toFixed(3)],
          ] as const).map(([name, val]) => (
            <div key={name} className="text-center">
              <p className="font-mono text-[11px] tabular-nums text-slate-200">{val}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-widest text-slate-600">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Delta Chip ───────────────────────────────────────────────────────────────
function DeltaChip({ delta, format = "dec" }: { delta: number; format?: "pct" | "dec" }) {
  const pos = delta > 0.0005;
  const neg = delta < -0.0005;
  const str = format === "pct"
    ? `${pos ? "+" : ""}${delta.toFixed(1)}%`
    : `${pos ? "+" : ""}${delta.toFixed(3)}`;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums",
      pos ? "bg-emerald-500/10 text-emerald-300" :
      neg ? "bg-red-500/10 text-red-400" :
            "bg-white/[0.04] text-slate-600",
    )}>
      {pos ? <TrendingUp className="h-2.5 w-2.5" /> : neg ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
      {str}
    </span>
  );
}

// ─── Comparison Panel ─────────────────────────────────────────────────────────
function ComparisonPanel({ pre, post }: { pre: ApiResult; post: ApiResult }) {
  const rows: { label: string; key: keyof ApiMetric; fmt: "pct" | "dec" }[] = [
    { label: "Accuracy",  key: "accuracy",  fmt: "pct" },
    { label: "κ Kappa",   key: "kappa",     fmt: "dec" },
    { label: "ROC AUC",   key: "roc_auc",   fmt: "dec" },
    { label: "F1 Macro",  key: "f1",        fmt: "dec" },
    { label: "Precision", key: "precision", fmt: "dec" },
    { label: "Recall",    key: "recall",    fmt: "dec" },
  ];

  function fmt(v: number, format: "pct" | "dec") {
    return format === "pct" ? `${v.toFixed(2)}%` : v.toFixed(4);
  }

  const pipes = [
    { key: "csp_lda" as const,   label: "CSP + LDA",   accent: "rgba(99,102,241,0.70)" },
    { key: "fbcsp_lda" as const, label: "FBCSP + LDA", accent: "rgba(251,146,60,0.70)"  },
  ];

  return (
    <div className="space-y-4">
      {pipes.map(pipe => {
        const mPre  = pre.metrics[pipe.key];
        const mPost = post.metrics[pipe.key];
        const preTier  = perfTier(mPre.accuracy);
        const postTier = perfTier(mPost.accuracy);

        return (
          <div key={pipe.key} className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0c0e17] shadow-[0_8px_28px_rgba(0,0,0,0.14)]">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
              <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: pipe.accent }} />
              <span className="text-xs font-semibold tracking-[0.01em] text-slate-300">{pipe.label}</span>
            </div>

            {/* Accuracy comparison */}
            <div className="grid grid-cols-[1fr_72px_1fr] gap-3 px-4 py-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <SectionLabel>Pre-Rehab</SectionLabel>
                  <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider", preTier.cls)}>{preTier.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-light tabular-nums leading-none text-slate-100">{mPre.accuracy.toFixed(1)}</span>
                  <span className="text-xs text-slate-600">%</span>
                </div>
                <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.div className="h-full rounded-full bg-indigo-500/40"
                    initial={{ width: 0 }} animate={{ width: `${Math.min(100, mPre.accuracy)}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }} />
                </div>
              </div>

              <div className="flex items-center justify-center">
                <DeltaChip delta={mPost.accuracy - mPre.accuracy} format="pct" />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <SectionLabel accent="emerald">Post-Rehab</SectionLabel>
                  <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider", postTier.cls)}>{postTier.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-light tabular-nums leading-none text-slate-100">{mPost.accuracy.toFixed(1)}</span>
                  <span className="text-xs text-slate-600">%</span>
                </div>
                <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.div className="h-full rounded-full"
                    style={{ background: pipe.accent }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(100, mPost.accuracy)}%` }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }} />
                </div>
              </div>
            </div>

            {/* Detailed table */}
            <div className="border-t border-white/[0.04] px-4 pb-3 pt-2.5">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Metric</th>
                    <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pre</th>
                    <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Post</th>
                    <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {rows.map(({ label, key, fmt: f }) => {
                    const vPre  = mPre[key]  as number;
                    const vPost = mPost[key] as number;
                    return (
                      <tr key={key}>
                        <td className="py-1.5 text-[11px] font-medium text-slate-500">{label}</td>
                        <td className="py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-500">{fmt(vPre, f)}</td>
                        <td className="py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-200">{fmt(vPost, f)}</td>
                        <td className="py-1.5 text-right">
                          <DeltaChip delta={vPost - vPre} format={f} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ROC Chart ────────────────────────────────────────────────────────────────
function RocChart({ result }: { result: ApiResult }) {
  const W = 400; const H = 200;
  const ML = 30; const MT = 10; const MB = 24;
  const plotW = W - ML - 10; const plotH = H - MT - MB;

  function rocPath(fpr: number[], tpr: number[]) {
    return fpr.map((f, i) => {
      const x = ML + f * plotW;
      const y = MT + (1 - tpr[i]) * plotH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0c0e17]">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ height: `${H}px`, width: "100%" }}>
        {Array.from({ length: 5 }, (_, i) => (
          <line key={i} x1={ML} y1={MT + (i / 4) * plotH} x2={ML + plotW} y2={MT + (i / 4) * plotH}
            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        ))}
        <path d={`M ${ML},${MT + plotH} L ${ML + plotW},${MT}`} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
        <motion.path d={rocPath(result.roc.csp_lda.fpr, result.roc.csp_lda.tpr)}
          fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeOpacity="0.85"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }} />
        <motion.path d={rocPath(result.roc.fbcsp_lda.fpr, result.roc.fbcsp_lda.tpr)}
          fill="none" stroke="#fb923c" strokeWidth="1.6" strokeOpacity="0.85"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }} />
        <text x={ML + 4} y={MT + 14} fontSize="9" fill="rgba(255,255,255,0.20)" fontFamily="ui-monospace,monospace">TPR</text>
        <text x={ML + plotW / 2} y={H - 4} textAnchor="middle" fontSize="9"
          fill="rgba(255,255,255,0.18)" fontFamily="ui-monospace,monospace">FPR</text>
        <g transform={`translate(${ML + 8},${MT + plotH - 32})`}>
          <line x1="0" y1="6"  x2="10" y2="6"  stroke="#60a5fa" strokeWidth="1.8" />
          <text x="13" y="10" fontSize="8" fill="rgba(255,255,255,0.35)" fontFamily="ui-monospace,monospace">
            CSP · AUC {result.metrics.csp_lda.roc_auc.toFixed(3)}
          </text>
          <line x1="0" y1="19" x2="10" y2="19" stroke="#fb923c" strokeWidth="1.6" />
          <text x="13" y="23" fontSize="8" fill="rgba(255,255,255,0.35)" fontFamily="ui-monospace,monospace">
            FBCSP · AUC {result.metrics.fbcsp_lda.roc_auc.toFixed(3)}
          </text>
        </g>
      </svg>
    </div>
  );
}

// ─── Session Detail ───────────────────────────────────────────────────────────
function SessionDetail({ result, phase }: {
  result: ApiResult;
  phase: "pre" | "post";
}) {
  const accentColor = phase === "pre" ? "rgba(99,102,241,0.70)" : "rgba(52,211,153,0.70)";

  return (
    <div className="space-y-5">
      {/* Classification metrics */}
      <div>
        <p className="mb-3 text-xs font-semibold text-slate-300">
          Classification performance
          {result.metrics.evaluation?.folds ? (
            <span className="ml-2 font-normal tracking-normal normal-case text-slate-600">
              ({result.metrics.evaluation.folds}-fold CV)
            </span>
          ) : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricsCard m={result.metrics.csp_lda}   label="CSP + LDA"   accentColor={accentColor} />
          <MetricsCard m={result.metrics.fbcsp_lda} label="FBCSP + LDA" accentColor="rgba(251,146,60,0.70)" />
        </div>
      </div>

      {/* ROC */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-300">ROC curves</p>
        <RocChart result={result} />
      </div>

      {/* Info strip */}
      <div className="flex items-center gap-3 border-t border-white/[0.04] pt-3 font-mono text-[9px] text-slate-600">
        <span>{result.n_epochs.train} train trials</span>
        <span>·</span>
        <span>{result.n_epochs.test} test trials</span>
        <span>·</span>
        <span>{result.fs} Hz</span>
        <span>·</span>
        <span>{result.temporal.duration_s}s epoch</span>
      </div>
    </div>
  );
}

// ─── Live training view ──────────────────────────────────────────────────────
function TrainingTheatre({ phase }: { phase: "pre" | "post" }) {
  const isPost = phase === "post";
  const accent = isPost ? "#34d399" : "#818cf8";
  const phaseLabel = isPost ? "Post-rehabilitation" : "Pre-rehabilitation";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3 }}
      className="border-t border-white/[0.06] bg-black"
      aria-live="polite"
      aria-label={`Training in progress: ${phaseLabel}`}
    >
      <div className="grid min-h-[380px] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative min-h-[260px] overflow-hidden border-b border-white/[0.06] lg:min-h-[420px] lg:border-r lg:border-b-0">
          <Image
            src="/assets/eeg-cap-portrait.png"
            alt="Person wearing a g.tec EEG electrode cap"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 54vw"
            className="object-cover object-[26%_center] grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/80" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent px-5 pb-5 pt-20 sm:px-7 sm:pb-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 motion-reduce:animate-none" style={{ backgroundColor: accent }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    Training active
                  </span>
                </div>
                <p className="text-xl font-medium tracking-[-0.02em] text-white sm:text-2xl">{phaseLabel}</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                  Filtering signals, extracting spatial features and validating both classifiers.
                </p>
              </div>
              <span className="rounded border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-[10px] text-slate-300 backdrop-blur-sm">
                Phase {isPost ? "2" : "1"} of 2
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.02em] text-slate-200">10–10 electrode montage</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">16 motor-cortex channels selected</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
              Active channels
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[430px] flex-1 items-center justify-center py-3">
            <svg
              viewBox="0 0 420 390"
              role="img"
              aria-label="Top view of the 16 selected EEG electrodes"
              className="h-auto w-full max-h-[320px] overflow-visible"
            >
              <defs>
                <radialGradient id="head-fill" cx="50%" cy="42%" r="62%">
                  <stop offset="0%" stopColor="#111827" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#030407" stopOpacity="0.96" />
                </radialGradient>
              </defs>
              <path d="M190 39 L210 13 L230 39" fill="none" stroke="#475569" strokeWidth="2" />
              <ellipse cx="210" cy="202" rx="157" ry="164" fill="url(#head-fill)" stroke="#334155" strokeWidth="2" />
              <path d="M55 164 C28 168 27 229 57 236" fill="none" stroke="#334155" strokeWidth="2" />
              <path d="M365 164 C392 168 393 229 363 236" fill="none" stroke="#334155" strokeWidth="2" />
              <path d="M93 201 C126 178 163 169 210 169 C257 169 294 178 327 201" fill="none" stroke="#1e293b" strokeDasharray="4 7" />
              <path d="M118 267 C148 245 177 237 210 237 C243 237 272 245 302 267" fill="none" stroke="#1e293b" strokeDasharray="4 7" />
              <path d="M210 77 V342" stroke="#1e293b" strokeDasharray="4 7" />

              {MONTAGE_POINTS.map(({ label, x, y }) => (
                <g key={label}>
                  <circle cx={x} cy={y} r="20" fill="#080b12" stroke={accent} strokeWidth="1.6" opacity="0.98" />
                  <circle cx={x} cy={y} r="24" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.18" className="animate-pulse motion-reduce:animate-none" />
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={label.length > 2 ? "10" : "11"}
                    fontWeight="600"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4">
            {[
              { label: "Pre dataset", state: isPost ? "Complete" : "Processing", done: isPost },
              { label: "Post dataset", state: isPost ? "Processing" : "Queued", done: false },
            ].map(item => (
              <div key={item.label} className="rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">{item.label}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {item.done
                    ? <Check className="h-3 w-3 text-emerald-400" />
                    : <Loader2 className={cn("h-3 w-3", item.state === "Processing" ? "animate-spin motion-reduce:animate-none" : "text-slate-700")} style={item.state === "Processing" ? { color: accent } : undefined} />}
                  <span className="font-mono text-[10px] text-slate-300">{item.state}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Step Rail ────────────────────────────────────────────────────────────────
function StepRail({ currentStep }: { currentStep: number }) {
  const steps = [
    { n: 1, label: "Data Import"   },
    { n: 2, label: "Configuration" },
    { n: 3, label: "Analysis"      },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map(({ n, label }, idx) => {
        const done   = n < currentStep;
        const active = n === currentStep;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "inline-flex h-[3px] w-3 rounded-full transition-all duration-500",
                  done ? "bg-emerald-500/50" : active ? "bg-indigo-400/70" : "bg-white/[0.08]",
                )} />
                <span className={cn(
                  "whitespace-nowrap text-[10px] font-semibold tracking-[0.03em] transition-colors duration-500",
                  done ? "text-emerald-400/60" : active ? "text-indigo-300/90" : "text-slate-600",
                )}>
                  {done ? <Check className="inline h-2.5 w-2.5 -mt-px" /> : null}
                  {label}
                </span>
              </div>
            </div>
            {idx < 2 && (
              <div className={cn(
                "mx-2 h-px w-5 transition-all duration-700 sm:mx-4 sm:w-12",
                n < currentStep ? "bg-emerald-500/20" : "bg-white/[0.05]",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnalysisWorkspace() {
  const {
    files,
    preResult,
    postResult,
    processing,
    apiError,
    processKey,
    filters,
    notchFrequencies: notchFreqs,
    hyperParameters: hyperParams,
    isConfigDirty,
    detailTab,
    allFilesLoaded,
    bothProcessed,
    currentStep,
    setFile: onFile,
    setFilter,
    setHyperParameter: setHyper,
    toggleNotchFrequency,
    setDetailTab,
    processAnalysis: handleProcess,
  } = useAnalysis();
  const [activeConfigTab, setActiveConfigTab] = useState<"filters" | "hyperparams">("filters");

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-[#05050c] text-slate-100">
      <div className="pointer-events-none fixed inset-0" style={{
        background: "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.05), transparent 70%)",
      }} />

      <div className="relative w-full px-4 py-6 sm:px-6 lg:px-10">

        {/* ── Header ──────────────────────────────────────────── */}
        <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="mb-10">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5 font-mono sm:gap-3">
              <span className="text-[9px] uppercase tracking-[0.22em] text-indigo-400/60">BR41N.IO</span>
              <span className="text-[9px] text-slate-500">·</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-slate-700">Hackathon 2026</span>
              <span className="text-[9px] text-slate-500">·</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-slate-700">Motor Imagery BCI</span>
            </div>
            <div className="relative h-[42px] w-[168px] shrink-0 overflow-hidden opacity-80 sm:h-[48px] sm:w-[192px]">
              <Image
                src="/assets/gtec-logo.png"
                alt="g.tec Brain-Computer Interfaces and Neurotechnology"
                fill
                priority
                sizes="192px"
                className="object-contain object-left sm:object-right"
              />
            </div>
          </div>

          <h1 className="text-[2.5rem] font-medium leading-[1.08] tracking-[-0.035em] text-slate-50 sm:text-[3rem]">
            Stroke<br className="sm:hidden" />{" "}
            <span className="font-light text-slate-400">Rehabilitation</span>{" "}
            <span className="text-indigo-400">Analysis</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Compare motor imagery EEG classification before and after rehabilitation.
          </p>
          <div className="mt-6 border-b border-white/[0.05] pb-6">
            <StepRail currentStep={currentStep} />
          </div>
        </motion.header>

        {/* ── Step 1: Upload ───────────────────────────────────── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="mb-3">

          <div className="rounded-lg border border-white/[0.08] bg-[#090a12] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className={cn(
                  "inline-block h-[3px] w-4 rounded-full",
                  allFilesLoaded ? "bg-emerald-500/60" : "bg-indigo-400/60",
                )} />
                <span className="text-xs font-semibold tracking-[0.02em] text-slate-300">
                  Data import
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-600">
                {Object.keys(files).length}/4 files
              </span>
            </div>

            <div className="p-5">
              <div className="grid gap-5 lg:grid-cols-2">
                {/* PRE column */}
                <div className="space-y-2">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-[2px] w-3 rounded-full bg-indigo-400/50" />
                    <SectionLabel>Pre-rehabilitation</SectionLabel>
                  </div>
                  <DropZone role="pre-train" label="Training set" file={files["pre-train"] ?? null} onFile={onFile} />
                  <DropZone role="pre-test"  label="Test set"     file={files["pre-test"]  ?? null} onFile={onFile} />
                </div>

                {/* POST column — left border acts as divider on lg */}
                <div className="space-y-2 lg:border-l lg:border-white/[0.05] lg:pl-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-[2px] w-3 rounded-full bg-emerald-400/50" />
                    <SectionLabel accent="emerald">Post-rehabilitation</SectionLabel>
                  </div>
                  <DropZone role="post-train" label="Training set" file={files["post-train"] ?? null} onFile={onFile} />
                  <DropZone role="post-test"  label="Test set"     file={files["post-test"]  ?? null} onFile={onFile} />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Step 2: Configure & Run ──────────────────────────── */}
        <AnimatePresence>
          {allFilesLoaded && (
            <motion.section key="s2"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mb-3">

              <div className="rounded-lg border border-white/[0.08] bg-[#090a12] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "inline-block h-[3px] w-4 rounded-full",
                      bothProcessed ? "bg-emerald-500/60" : "bg-indigo-400/60",
                    )} />
                    <span className="text-xs font-semibold tracking-[0.02em] text-slate-300">
                      Signal processing
                    </span>
                    {isConfigDirty && (
                      <span className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                        Settings changed
                      </span>
                    )}
                  </div>

                  <button onClick={handleProcess} disabled={processing !== "idle"}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-semibold tracking-[0.04em] transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.98]",
                      processing !== "idle"
                        ? "cursor-wait border-indigo-500/10 bg-indigo-500/[0.04] text-indigo-400/40"
                        : "border-indigo-500/25 bg-indigo-500/10 text-indigo-200 hover:border-indigo-400/40 hover:bg-indigo-500/18 hover:text-indigo-100",
                    )}>
                    {processing === "pre"  && <><Loader2 className="h-3 w-3 animate-spin" />Processing pre…</>}
                    {processing === "post" && <><Loader2 className="h-3 w-3 animate-spin" />Processing post…</>}
                    {processing === "idle" && <><Zap className="h-3 w-3" />Run analysis</>}
                  </button>
                </div>

                <div className="p-5">
                  <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
                    {/* Left: tabs + sliders */}
                    <div className="space-y-4">
                      {/* Tab switcher */}
                      <div className="flex rounded-sm border border-white/[0.06] bg-white/[0.01] p-[3px] gap-[3px]">
                        {(["filters", "hyperparams"] as const).map(tab => (
                          <button key={tab} onClick={() => setActiveConfigTab(tab)}
                            className={cn(
                              "min-h-8 flex-1 rounded-sm py-1.5 text-[10px] font-semibold tracking-[0.03em] transition-all",
                              activeConfigTab === tab
                                ? "border border-indigo-400/25 bg-indigo-500/12 text-indigo-200"
                                : "text-slate-600 hover:text-slate-400",
                            )}>
                            {tab === "filters" ? "Filters" : "Model settings"}
                          </button>
                        ))}
                      </div>

                      {activeConfigTab === "filters" ? (
                        <div className="space-y-4">
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-slate-400">Notch filter</p>
                            <div className="flex gap-2">
                              {[40, 50, 60].map(hz => {
                                const active = notchFreqs.includes(hz);
                                return (
                                  <button
                                    key={hz}
                                    onClick={() => toggleNotchFrequency(hz)}
                                    className={cn(
                                      "min-h-8 rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                                      active
                                        ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                                        : "border-white/[0.06] bg-white/[0.01] text-slate-500 hover:border-white/10 hover:text-slate-400",
                                    )}
                                  >{hz} Hz</button>
                                );
                              })}
                            </div>
                          </div>
                          <Slider label="High-pass" value={filters.highPassHz} min={0}  max={20} unit="Hz" step={0.5} onChange={v => setFilter("highPassHz", v)} />
                          <Slider label="Low-pass"  value={filters.lowPassHz}  min={10} max={80} unit="Hz" step={0.5} onChange={v => setFilter("lowPassHz",  v)} />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Slider label="Epoch tmin"     value={hyperParams.epochTmin}     min={0} max={4}  unit="s" step={0.1} onChange={v => setHyper("epochTmin",     Number(v.toFixed(1)))} />
                          <Slider label="Epoch tmax"     value={hyperParams.epochTmax}     min={4} max={8}  unit="s" step={0.1} onChange={v => setHyper("epochTmax",     Number(v.toFixed(1)))} />
                          <Slider label="CSP components" value={hyperParams.cspComponents} min={2} max={8}  unit=""  step={1}   onChange={v => setHyper("cspComponents", Math.round(v))} />
                          <Slider label="FBCSP k-best"   value={hyperParams.fbcspKBest}    min={4} max={24} unit=""  step={1}   onChange={v => setHyper("fbcspKBest",    Math.round(v))} />
                        </div>
                      )}
                    </div>

                    {/* Right: channel grid */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-300">Electrode montage</p>
                        <span className="font-mono text-[9px] text-slate-600">{FIXED_CHANNELS.length} channels · read-only</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {FIXED_CHANNELS.map((ch, i) => (
                          <div key={ch} className="rounded-sm border border-white/[0.06] bg-white/[0.015] py-1.5 text-center font-mono text-[10px]"
                            style={{ color: channelColor(i) }}>
                            {ch}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {processing !== "idle" && (
                    <TrainingTheatre key={processing} phase={processing} />
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Error banner ─────────────────────────────────────── */}
        <AnimatePresence>
          {apiError && (
            <motion.div key="err"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="mb-3 flex items-start gap-3 rounded border border-red-500/15 bg-red-500/[0.05] px-4 py-3 text-[12px] text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Step 3: Results ──────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {bothProcessed && (
            <motion.section key={`s3-${processKey}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3">

              {/* ── Summary + Comparison ───────────────────────── */}
              <div className="rounded-lg border border-white/[0.08] bg-[#090a12] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block h-[3px] w-4 rounded-full bg-indigo-400/60" />
                    <span className="text-xs font-semibold tracking-[0.02em] text-slate-300">
                      Rehabilitation outcome
                    </span>
                  </div>
                </div>

                {/* Summary stats */}
                <div className="border-b border-white/[0.04] px-5 py-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: "Pre trials",   value: `${preResult!.n_epochs.train + preResult!.n_epochs.test}` },
                      { label: "Post trials",  value: `${postResult!.n_epochs.train + postResult!.n_epochs.test}` },
                      { label: "Sample rate",  value: `${preResult!.fs} Hz` },
                      { label: "Epoch",        value: `${preResult!.temporal.duration_s}s` },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-white/[0.07] bg-[#0c0e17] px-3 py-3">
                        <p className="text-[10px] font-medium text-slate-500">{label}</p>
                        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-slate-200">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <ComparisonPanel pre={preResult!} post={postResult!} />
                </div>
              </div>

              {/* ── Detailed analysis (tabbed) ─────────────────── */}
              <div className="rounded-lg border border-white/[0.08] bg-[#090a12] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Activity className="h-3.5 w-3.5 text-slate-600" />
                    <span className="text-xs font-semibold tracking-[0.02em] text-slate-300">
                      Session detail
                    </span>
                  </div>
                  {/* Tab switcher */}
                  <div className="flex rounded-sm border border-white/[0.06] bg-white/[0.01] p-[3px] gap-[3px]">
                    {(["pre", "post"] as const).map(tab => (
                      <button key={tab} onClick={() => setDetailTab(tab)}
                        className={cn(
                          "min-h-8 rounded-sm px-3 py-1 text-[10px] font-semibold tracking-[0.03em] transition-all",
                          detailTab === tab
                            ? tab === "pre"
                              ? "border border-indigo-400/25 bg-indigo-500/12 text-indigo-200"
                              : "border border-emerald-400/25 bg-emerald-500/12 text-emerald-200"
                            : "text-slate-600 hover:text-slate-400",
                        )}>
                        {tab === "pre" ? "Pre-Rehab" : "Post-Rehab"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <AnimatePresence mode="wait">
                    <motion.div key={detailTab}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}>
                      <SessionDetail
                        result={detailTab === "pre" ? preResult! : postResult!}
                        phase={detailTab}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Footer ───────────────────────────────────────────── */}
        <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] pt-5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-800">
          <span>BR41N.IO · Stroke Rehabilitation BCI · 2026</span>
          <span>.mat · .csv · .edf</span>
        </motion.footer>

      </div>
    </div>
    </MotionConfig>
  );
}

"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ActivitySquare,
  SlidersHorizontal,
  UploadCloud,
  Waves,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
interface UploadedFile {
  file: File;
  role: "training" | "test";
}

interface FilterSettings {
  notchHz: "off" | "50" | "60";
  highPassHz: number;
  lowPassHz: number;
  windowSeconds: number;
}

const CHANNEL_OPTIONS = ["C3", "C4", "Cz", "F3", "F4", "P3", "P4", "O1", "O2"];
const DISPLAY_CHANNELS = ["C3", "C4", "Cz", "F3"];

function createSignalPoints(length: number, scale: number, phase: number) {
  return Array.from({ length }, (_, i) => {
    const t = i / (length - 1);
    const wave =
      Math.sin((t * 8 + phase) * Math.PI) * 0.7 +
      Math.sin((t * 19 + phase * 1.3) * Math.PI) * 0.25 +
      Math.sin((t * 42 + phase * 0.8) * Math.PI) * 0.08;
    return wave * scale;
  });
}

function buildPolyline(points: number[], width: number, height: number, yOffset = 0) {
  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = yOffset + height / 2 - value * (height * 0.35);
      return `${x},${y}`;
    })
    .join(" ");
}

function createPsdCurve(length: number, seed: number) {
  return Array.from({ length }, (_, index) => {
    const x = index / (length - 1);
    const alphaPeak = Math.exp(-Math.pow((x - 0.28) / 0.12, 2)) * 0.9;
    const betaPeak = Math.exp(-Math.pow((x - 0.58) / 0.18, 2)) * 0.5;
    const noise = (Math.sin(index * 1.7 + seed) + Math.cos(index * 0.5 + seed * 0.3)) * 0.03;
    return Math.max(0.05, 0.15 + alphaPeak + betaPeak + noise);
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DropCard({
  role,
  label,
  uploadedFile,
  onFileSelected,
}: {
  role: "training" | "test";
  label: string;
  uploadedFile: UploadedFile | null;
  onFileSelected: (role: "training" | "test", file: File) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <label
      className={cn(
        "relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 transition-all",
        "bg-slate-900/70 text-slate-100",
        isDragging
          ? "border-cyan-300 bg-slate-800 shadow-[0_0_0_1px_rgba(103,232,249,0.6)]"
          : "border-slate-700 hover:border-slate-500",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const droppedFile = event.dataTransfer.files?.[0];
        if (!droppedFile) return;
        onFileSelected(role, droppedFile);
      }}
    >
      <input
        type="file"
        accept=".mat,.csv,.edf"
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (!selectedFile) return;
          onFileSelected(role, selectedFile);
        }}
      />

      <UploadCloud className="mb-3 h-8 w-8 text-cyan-300" />
      <p className="text-base font-semibold">{label}</p>
      <p className="mt-1 text-center text-xs text-slate-400">
        Drag & drop or click to browse
      </p>
      <p className="mt-1 text-xs text-slate-500">Accepted: .mat, .csv, .edf</p>

      {uploadedFile ? (
        <div className="mt-4 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Loaded successfully
          </div>
          <p className="mt-1 truncate">{uploadedFile.file.name}</p>
          <p className="text-emerald-300/80">{formatFileSize(uploadedFile.file.size)}</p>
        </div>
      ) : (
        <div className="mt-4 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            File required
          </div>
          <p className="mt-1">Please upload this dataset before processing.</p>
        </div>
      )}
    </label>
  );
}

export function AnimatedAIChat() {
  const [trainingFile, setTrainingFile] = useState<UploadedFile | null>(null);
  const [testFile, setTestFile] = useState<UploadedFile | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["C3", "C4"]);
  const [filters, setFilters] = useState<FilterSettings>({
    notchHz: "60",
    highPassHz: 4,
    lowPassHz: 40,
    windowSeconds: 5,
  });
  const [hasProcessed, setHasProcessed] = useState(false);

  const canProcess = Boolean(trainingFile && testFile);
  const baseSeed = (trainingFile?.file.size ?? 1000) + (testFile?.file.size ?? 1700);

  const temporalSeriesByChannel = useMemo(
    () =>
      DISPLAY_CHANNELS.map((_, channelIndex) =>
        createSignalPoints(
          220,
          0.8 + ((baseSeed + channelIndex * 23) % 9) / 18,
          ((baseSeed + channelIndex * 13) % 17) / 11,
        ),
      ),
    [baseSeed],
  );
  const temporalFilteredByChannel = useMemo(
    () =>
      temporalSeriesByChannel.map((channel) =>
        channel.map((value, index) => {
          const previous = channel[index - 1] ?? value;
          const next = channel[index + 1] ?? value;
          return (previous + value * 2 + next) / 4;
        }),
      ),
    [temporalSeriesByChannel],
  );
  const psdTraining = useMemo(() => createPsdCurve(120, baseSeed / 6000), [baseSeed]);
  const psdTest = useMemo(() => createPsdCurve(120, baseSeed / 5000 + 0.35), [baseSeed]);
  const temporalPolylinesRaw = useMemo(
    () =>
      temporalSeriesByChannel.map((points, index) =>
        buildPolyline(points, 980, 54, index * 72 + 22),
      ),
    [temporalSeriesByChannel],
  );
  const temporalPolylinesFiltered = useMemo(
    () =>
      temporalFilteredByChannel.map((points, index) =>
        buildPolyline(points, 980, 54, index * 72 + 22),
      ),
    [temporalFilteredByChannel],
  );
  const psdTrainingPolyline = useMemo(
    () => buildPolyline(psdTraining, 980, 220),
    [psdTraining],
  );
  const psdTestPolyline = useMemo(
    () => buildPolyline(psdTest, 980, 220),
    [psdTest],
  );
  const temporalStats = useMemo(
    () => ({
      snr: (8.2 + (baseSeed % 20) / 10).toFixed(1),
      variance: (0.42 + (baseSeed % 13) / 100).toFixed(2),
      quality: hasProcessed ? `${(82 + (baseSeed % 11)).toFixed(0)}%` : "--",
    }),
    [baseSeed, hasProcessed],
  );

  function handleFileSelected(role: "training" | "test", file: File) {
    if (role === "training") setTrainingFile({ role, file });
    if (role === "test") setTestFile({ role, file });
    setHasProcessed(false);
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((previous) => {
      if (previous.includes(channel)) return previous.filter((item) => item !== channel);
      return [...previous, channel];
    });
  }

  const isStepOneDone = Boolean(trainingFile && testFile);
  const isStepTwoDone = hasProcessed;
  const currentStep = !isStepOneDone ? 1 : !isStepTwoDone ? 2 : 3;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            <ActivitySquare className="h-3.5 w-3.5" />
            Stroke Rehab BCI Workbench
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Flujo guiado por pasos
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Primero sube los archivos, luego configura filtros y al final revisa gráficos.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <StepBadge step={1} active={currentStep === 1} done={isStepOneDone} label="Subir Training + Test" />
            <StepBadge step={2} active={currentStep === 2} done={isStepTwoDone} label="Configurar y procesar" />
            <StepBadge step={3} active={currentStep === 3} done={false} label="Visualizar resultados" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Paso 1: Carga de archivos
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <DropCard role="training" label="Training Data" uploadedFile={trainingFile} onFileSelected={handleFileSelected} />
            <DropCard role="test" label="Test Data" uploadedFile={testFile} onFileSelected={handleFileSelected} />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Paso 2: Configuración y procesamiento
            </h2>
            <button
              type="button"
              onClick={() => setHasProcessed(true)}
              disabled={!isStepOneDone}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                isStepOneDone
                  ? "bg-gradient-to-r from-violet-400 to-cyan-300 text-slate-950 hover:brightness-110"
                  : "cursor-not-allowed bg-slate-700 text-slate-400",
              )}
            >
              <Sparkles className="h-4 w-4" />
              Process & visualize
            </button>
          </div>

          {!isStepOneDone ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              Completa el Paso 1 cargando ambos archivos para desbloquear esta sección.
            </p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
              <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <div className="mb-5 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-violet-300" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Processing Controls
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-slate-400">
                      <Filter className="h-3.5 w-3.5" />
                      Notch Filter
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["off", "50", "60"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setFilters((prev) => ({ ...prev, notchHz: option }))}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-xs",
                            filters.notchHz === option
                              ? "border-violet-400 bg-violet-400/20 text-violet-100"
                              : "border-slate-700 bg-slate-800 text-slate-300",
                          )}
                        >
                          {option === "off" ? "Off" : `${option} Hz`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <RangeControl
                    label="High-pass (Hz)"
                    min={0}
                    max={20}
                    value={filters.highPassHz}
                    onChange={(value) => setFilters((prev) => ({ ...prev, highPassHz: value }))}
                  />
                  <RangeControl
                    label="Low-pass (Hz)"
                    min={10}
                    max={80}
                    value={filters.lowPassHz}
                    onChange={(value) => setFilters((prev) => ({ ...prev, lowPassHz: value }))}
                  />
                  <RangeControl
                    label="Window size (s)"
                    min={1}
                    max={12}
                    value={filters.windowSeconds}
                    onChange={(value) => setFilters((prev) => ({ ...prev, windowSeconds: value }))}
                  />

                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-400">Channels</p>
                    <div className="grid grid-cols-3 gap-2">
                      {CHANNEL_OPTIONS.map((channel) => (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => toggleChannel(channel)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs",
                            selectedChannels.includes(channel)
                              ? "border-violet-400 bg-violet-500/20 text-violet-100"
                              : "border-slate-700 bg-slate-800 text-slate-300",
                          )}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
                Ajusta los filtros y presiona <strong>Process & visualize</strong> para continuar al Paso 3.
              </div>
            </div>
          )}
        </div>

        {isStepTwoDone && (
          <div className="mt-6 space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Paso 3: Resultados
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                  <Waves className="h-4 w-4 text-violet-300" />
                  Temporal view
                </h3>
                <p className="text-xs text-slate-400">
                  Window: {filters.windowSeconds}s | Channels: {selectedChannels.join(", ")}
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-300 bg-slate-100 p-2 shadow-inner">
                <svg viewBox="0 0 1000 320" className="h-72 w-full min-w-[760px]">
                  <defs>
                    <clipPath id="clipTemporal">
                      <rect x="40" y="16" width="940" height="286" />
                    </clipPath>
                  </defs>
                  <rect x="0" y="0" width="1000" height="320" fill="#f8fafc" />
                  {Array.from({ length: 12 }, (_, index) => (
                    <line
                      key={index}
                      x1={40 + index * 85}
                      y1="16"
                      x2={40 + index * 85}
                      y2="302"
                      stroke="#d1d5db"
                      strokeWidth="1"
                    />
                  ))}
                  {Array.from({ length: 8 }, (_, index) => (
                    <line
                      key={`h-${index}`}
                      x1="40"
                      y1={16 + index * 41}
                      x2="980"
                      y2={16 + index * 41}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  <line x1="40" y1="16" x2="40" y2="302" stroke="#111827" strokeWidth="1.2" />
                  <line x1="40" y1="302" x2="980" y2="302" stroke="#111827" strokeWidth="1.2" />
                  {DISPLAY_CHANNELS.map((channel, index) => (
                    <text
                      key={`${channel}-label`}
                      x="8"
                      y={56 + index * 72}
                      fill="#111827"
                      fontSize="12"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {channel}
                    </text>
                  ))}
                  <g clipPath="url(#clipTemporal)">
                    {temporalPolylinesRaw.map((linePoints, index) => (
                      <motion.polyline
                        key={`raw-${index}`}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="1.8"
                        points={linePoints}
                        initial={{ pathLength: 0.1, opacity: 0.2 }}
                        animate={{ pathLength: 1, opacity: 0.8 }}
                        transition={{ duration: 1.2, ease: "easeInOut", delay: index * 0.04 }}
                      />
                    ))}
                    {temporalPolylinesFiltered.map((linePoints, index) => (
                      <motion.polyline
                        key={`filtered-${index}`}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="1.4"
                        points={linePoints}
                        initial={{ pathLength: 0.1, opacity: 0.15 }}
                        animate={{ pathLength: 1, opacity: 0.7 }}
                        transition={{ duration: 1.4, ease: "easeInOut", delay: index * 0.05 + 0.08 }}
                      />
                    ))}
                  </g>
                  <motion.line
                    x1="40"
                    y1="16"
                    x2="40"
                    y2="302"
                    stroke="#7c3aed"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    animate={{
                      x1: [40, 980, 40],
                      x2: [40, 980, 40],
                      opacity: [0.2, 0.55, 0.2],
                    }}
                    transition={{ duration: 7, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
                  />
                </svg>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Raw (MNE-like)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Filtered
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  Scan cursor
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                  <BarChart3 className="h-4 w-4 text-violet-300" />
                  Frequency view
                </h3>
                <p className="text-xs text-slate-400">
                  Notch: {filters.notchHz === "off" ? "off" : `${filters.notchHz} Hz`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 shadow-inner">
                <svg viewBox="0 0 1000 240" className="h-56 w-full">
                  <rect x="0" y="0" width="1000" height="240" fill="#f8fafc" />
                  {Array.from({ length: 5 }, (_, index) => (
                    <line
                      key={`freq-grid-${index}`}
                      x1="40"
                      y1={24 + index * 46}
                      x2="980"
                      y2={24 + index * 46}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  {Array.from({ length: 10 }, (_, index) => (
                    <line
                      key={`freq-v-${index}`}
                      x1={40 + index * 94}
                      y1="24"
                      x2={40 + index * 94}
                      y2="208"
                      stroke="#d1d5db"
                      strokeWidth="1"
                    />
                  ))}
                  <line x1="40" y1="24" x2="40" y2="208" stroke="#111827" strokeWidth="1.2" />
                  <line x1="40" y1="208" x2="980" y2="208" stroke="#111827" strokeWidth="1.2" />
                  <motion.polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    points={psdTrainingPolyline}
                    initial={{ pathLength: 0.05, opacity: 0.25 }}
                    animate={{ pathLength: 1, opacity: hasProcessed ? 0.9 : 0.65 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                  <motion.polyline
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    points={psdTestPolyline}
                    initial={{ pathLength: 0.05, opacity: 0.2 }}
                    animate={{ pathLength: 1, opacity: hasProcessed ? 0.85 : 0.55 }}
                    transition={{ duration: 1.35, ease: "easeOut", delay: 0.12 }}
                  />
                </svg>
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Train PSD
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  Test PSD
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard title="Data readiness" value={canProcess ? "100%" : "50%"} />
              <MetricCard title="Temporal quality" value={temporalStats.quality} />
              <MetricCard
                title="SNR / Variance"
                value={hasProcessed ? `${temporalStats.snr} dB / ${temporalStats.variance}` : "--"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({
  step,
  label,
  active,
  done,
}: {
  step: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs",
        done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
        active && !done && "border-violet-500/50 bg-violet-500/10 text-violet-200",
        !active && !done && "border-slate-700 bg-slate-800/70 text-slate-400",
      )}
    >
      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
      </span>
      {label}
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-medium text-slate-200">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700"
      />
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-violet-200">{value}</p>
    </div>
  );
}

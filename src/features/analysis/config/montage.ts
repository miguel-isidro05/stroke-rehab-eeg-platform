export const FIXED_CHANNELS = [
  "FC3", "FCz", "FC4", "C5", "C3", "C1", "Cz", "C2",
  "C4", "C6", "CP3", "CP1", "CPz", "CP2", "CP4", "Pz",
] as const;

export const CHANNEL_COLORS = [
  "#60a5fa", "#34d399", "#a78bfa", "#fb923c",
  "#f472b6", "#facc15", "#22d3ee", "#f87171",
] as const;

export const MONTAGE_POINTS = [
  { label: "FC3", x: 140, y: 122 },
  { label: "FCz", x: 210, y: 108 },
  { label: "FC4", x: 280, y: 122 },
  { label: "C5", x: 84, y: 202 },
  { label: "C3", x: 134, y: 198 },
  { label: "C1", x: 176, y: 194 },
  { label: "Cz", x: 210, y: 192 },
  { label: "C2", x: 244, y: 194 },
  { label: "C4", x: 286, y: 198 },
  { label: "C6", x: 336, y: 202 },
  { label: "CP3", x: 142, y: 266 },
  { label: "CP1", x: 180, y: 260 },
  { label: "CPz", x: 210, y: 258 },
  { label: "CP2", x: 240, y: 260 },
  { label: "CP4", x: 278, y: 266 },
  { label: "Pz", x: 210, y: 326 },
] as const;

export function channelColor(index: number): string {
  return CHANNEL_COLORS[index] ?? `hsl(${(index * 47) % 360} 85% 68%)`;
}


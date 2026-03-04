import type { SafetySignalLevel } from "@/lib/safetySignals";

type Props = {
  level: SafetySignalLevel;
  label: string;
};

function toneClass(level: SafetySignalLevel) {
  if (level === "blocked") {
    return "border-red-300 bg-red-50 text-red-700";
  }
  if (level === "watch") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

export function SafetySignalBadge({ level, label }: Props) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass(
        level,
      )}`}
    >
      {label}
    </span>
  );
}

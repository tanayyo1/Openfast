type BarMeterProps = {
  label: string;
  value: number;
  max?: number;
};

export function BarMeter({ label, value, max = 100 }: BarMeterProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = (clamped / max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-semibold text-muted-foreground">{value}</p>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

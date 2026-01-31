type SparklineProps = {
  points: number[];
  className?: string;
};

export function Sparkline({ points, className }: SparklineProps) {
  if (points.length === 0) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const width = 120;
  const height = 36;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const d = points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "h-9 w-28"}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  );
}

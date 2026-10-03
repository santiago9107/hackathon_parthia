/**
 * Tiny SVG trend line with an optional shaded reference range.
 * Hand-written like the rest of the charts (no chart library).
 */
export function Sparkline({
  values,
  range,
  width = 120,
  height = 36,
  label,
}: {
  values: { x: string; y: number }[];
  range?: { low?: number; high?: number };
  width?: number;
  height?: number;
  /** Accessible description, e.g. "INR trend: 2.4, 2.6, 2.8, 3.1, 3.4". */
  label: string;
}) {
  if (values.length === 0) return null;
  const ys = values.map((v) => v.y);
  const lo = Math.min(...ys, range?.low ?? Infinity);
  const hi = Math.max(...ys, range?.high ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (values.length === 1 ? width / 2 : 4 + (i * (width - 8)) / (values.length - 1));
  const y = (v: number) => height - 3 - ((v - min) / (max - min)) * (height - 6);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v.y).toFixed(1)}`).join(" ");
  const bandTop = range?.high !== undefined ? y(range.high) : 0;
  const bandBottom = range?.low !== undefined ? y(range.low) : height;
  const last = values[values.length - 1];
  const outside = (range?.high !== undefined && last.y > range.high) || (range?.low !== undefined && last.y < range.low);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      {range && <rect x="0" y={bandTop} width={width} height={Math.max(0, bandBottom - bandTop)} fill="#eef5f3" />}
      <path d={path} fill="none" stroke="#2e8c83" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={v.x + i} cx={x(i)} cy={y(v.y)} r={i === values.length - 1 ? 3 : 1.8} fill={i === values.length - 1 ? (outside ? "#b5473a" : "#0e5c56") : "#2e8c83"} />
      ))}
    </svg>
  );
}

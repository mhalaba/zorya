type Props = { level?: string; className?: string };

/** Cartographic mark of Fundacja Terra Incognita. Keep upright - it is not a compass widget. */
const NEEDLE: Record<string, string> = {
  info: "#AF593C",
  watch: "#C56A3A",
  priority: "#C24E3C",
};

export function StarMark({ level = "info", className }: Props) {
  const needle = NEEDLE[level] ?? NEEDLE.info;
  return (
    <svg className={`star ${className ?? ""}`} data-level={level} viewBox="0 0 100 100" aria-hidden>
      <g className="mark-line" stroke="#E8D8C8" strokeWidth="1.75" strokeLinecap="square" fill="none">
        <circle cx="50" cy="50" r="36" />
        <path d="M11.5 50 H88.5" />
        <path d="M50 14 V8.4 M72.26 21.51 L75 18.01 M72.26 78.49 L75 81.99" />
      </g>
      <path className="mark-needle" fill={needle} d="M50 13.05 L53.05 47.35 L50 44.7 L46.95 47.35 Z" />
      <path
        className="mark-bird"
        fill="#E8D8C8"
        fillRule="evenodd"
        d="M50 87.4 L39.25 59.3 A6.85 6.85 0 0 0 45.65 50 A6.85 6.85 0 0 1 50 51.56 A6.85 6.85 0 0 1 54.35 50 A6.85 6.85 0 0 0 60.75 59.3 Z M45.27 53.25 a1.08 1.08 0 1 1 2.16 0 a1.08 1.08 0 1 1 -2.16 0 M52.57 53.25 a1.08 1.08 0 1 1 2.16 0 a1.08 1.08 0 1 1 -2.16 0"
      />
    </svg>
  );
}

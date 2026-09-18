type Props = { level?: string; className?: string };

export function StarMark({ level = "info", className }: Props) {
  return (
    <svg className={`star ${className ?? ""}`} data-level={level} viewBox="0 0 32 32" aria-hidden>
      <path
        d="M16 2.4 17.85 12.2 27.6 8.2 20.2 16 27.6 23.8 17.85 19.8 16 29.6 14.15 19.8 4.4 23.8 11.8 16 4.4 8.2 14.15 12.2Z"
        fill="#E0A100"
      />
      <circle className="core" cx="16" cy="16" r="2.35" />
    </svg>
  );
}

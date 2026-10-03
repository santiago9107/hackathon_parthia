/**
 * The Parthia mark: three record lines enter from the left and merge into one
 * line that ends in a node (the reconciled list), with one small accent dot
 * (a finding surfaced for a clinician).
 */
export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0E5C56" />
      <g fill="none" stroke="#F7F4EE" strokeWidth="3" strokeLinecap="round">
        <path d="M12 17 C24.5 17 25.5 32 36.5 32" />
        <path d="M12 32 H36.5" />
        <path d="M12 47 C24.5 47 25.5 32 36.5 32" />
      </g>
      <circle cx="44.5" cy="32" r="8" fill="#F7F4EE" />
      <circle cx="44.5" cy="32" r="3.6" fill="#C9962B" />
    </svg>
  );
}
export function Wordmark({ size = "md", suffix }: { size?: "sm" | "md" | "lg"; suffix?: string }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl";
  const mark = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark className={mark} />
      <span className={`font-serif ${text} tracking-tight leading-none`}>
        <span className="text-navy font-semibold">Parthia</span>{" "}
        <span className="text-brand-700 font-medium">Health</span>
        {suffix ? <span className="text-ink-muted font-medium"> · {suffix}</span> : null}
      </span>
    </span>
  );
}

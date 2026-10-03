export function LeafMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0E5C56" />
      <path
        d="M32 14 C46 14, 46 33, 32 46 C18 33, 18 14, 32 14 Z"
        fill="#F7F4EE"
      />
      <path d="M32 20 L32 41" stroke="#0E5C56" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 30 C36 27, 38 26, 40 24" stroke="#0E5C56" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <path d="M32 35 C28 32, 26 31, 24 29" stroke="#0E5C56" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <circle cx="46" cy="16" r="3.5" fill="#C9962B" />
    </svg>
  );
}

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl";
  const mark = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <span className="inline-flex items-center gap-2.5">
      <LeafMark className={mark} />
      <span className={`font-serif ${text} tracking-tight leading-none`}>
        <span className="text-navy font-semibold">Parthia</span>{" "}
        <span className="text-brand-700 font-medium">Health</span>
      </span>
    </span>
  );
}

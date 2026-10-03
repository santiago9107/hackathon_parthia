/**
 * A rubber duck for the closing slide. Drawn as an SVG so it stays sharp on a
 * projector, and it bobs gently on the water unless the viewer has asked for
 * reduced motion.
 */
export function Duck({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <style>{`
.pt-duck { animation: pt-duck-bob 3.2s ease-in-out infinite; transform-origin: 50% 80%; }
.pt-wave { animation: pt-wave-slide 4s linear infinite; }
@keyframes pt-duck-bob { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-7px) rotate(2deg); } }
@keyframes pt-wave-slide { from { transform: translateX(0); } to { transform: translateX(-60px); } }
@media (prefers-reduced-motion: reduce) { .pt-duck, .pt-wave { animation: none; } }
`}</style>
      <svg viewBox="0 0 220 190" role="img" aria-label="A rubber duck floating on water" className="h-auto w-full">
        <g className="pt-duck">
          <path d="M156 116c18-4 28-18 26-34 12 14 10 36-14 50z" fill="#FFD23F" />
          <ellipse cx="102" cy="122" rx="64" ry="38" fill="#FFD23F" />
          <path d="M92 120c16-18 42-14 50 4-12 12-38 12-50-4z" fill="#F5B800" />
          <circle cx="74" cy="74" r="27" fill="#FFD23F" />
          <ellipse cx="48" cy="80" rx="17" ry="8.5" fill="#FF8A00" />
          <path d="M34 82c8 5 20 5 28 0" stroke="#C25E00" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="70" cy="67" r="4.4" fill="#2b2a28" />
          <circle cx="71.4" cy="65.6" r="1.4" fill="#fff" />
          <circle cx="80" cy="84" r="5.5" fill="#FF9F6B" fillOpacity=".55" />
        </g>
        <g className="pt-wave" fill="none" strokeLinecap="round">
          <path d="M-20 156q15-10 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0" stroke="#2dd4bf" strokeWidth="6" />
          <path d="M-35 172q15-8 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0" stroke="#5eead4" strokeOpacity=".55" strokeWidth="5" />
        </g>
      </svg>
    </div>
  );
}

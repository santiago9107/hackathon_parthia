import { Mark } from "./Wordmark";

/**
 * iOS has no install prompt, so the "Add to Home Screen" moment has to be
 * designed. Three steps, each with a small illustration of what to tap.
 */
export function IOSInstallGuide() {
  return (
    <ol className="space-y-4">
      <Step n={1} title="Tap the Share button" body="It's the square with an arrow at the bottom of Safari (or at the top on iPad).">
        <div className="flex h-14 w-full items-center justify-around rounded-xl bg-[#f2f2f7] px-4 text-[#8e8e93]">
          <ChevronLeft />
          <ChevronLeft flipped />
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a84ff] text-white ring-4 ring-[#0a84ff]/25">
            <ShareIcon />
          </span>
          <BookIcon />
          <TabsIcon />
        </div>
      </Step>
      <Step n={2} title="Choose “Add to Home Screen”" body="Scroll the list of actions if you don't see it right away.">
        <div className="w-full overflow-hidden rounded-xl bg-[#f2f2f7] text-[15px] text-[#1c1c1e]">
          <div className="flex items-center justify-between border-b border-black/5 bg-white px-4 py-2.5">
            <span>Add Bookmark</span>
            <span className="text-[#8e8e93]">📖</span>
          </div>
          <div className="flex items-center justify-between bg-[#0a84ff]/10 px-4 py-2.5 font-medium ring-2 ring-inset ring-[#0a84ff]/60">
            <span>Add to Home Screen</span>
            <span className="text-[#1c1c1e]">
              <PlusSquareIcon />
            </span>
          </div>
          <div className="flex items-center justify-between bg-white px-4 py-2.5">
            <span>Markup</span>
            <span className="text-[#8e8e93]">✎</span>
          </div>
        </div>
      </Step>
      <Step n={3} title="Tap “Add”" body="Parthia Health appears on your Home Screen and opens full-screen, like any other app.">
        <div className="w-full rounded-xl bg-[#f2f2f7] p-3">
          <div className="flex items-center justify-between text-[15px]">
            <span className="text-[#0a84ff]">Cancel</span>
            <span className="font-semibold text-[#1c1c1e]">Add to Home Screen</span>
            <span className="rounded-md bg-[#0a84ff]/10 px-1.5 font-semibold text-[#0a84ff] ring-2 ring-[#0a84ff]/60">Add</span>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-white p-2.5">
            <Mark className="h-11 w-11" />
            <div>
              <p className="text-[15px] font-medium text-[#1c1c1e]">Parthia</p>
              <p className="text-xs text-[#8e8e93]">parthia.health</p>
            </div>
          </div>
        </div>
      </Step>
    </ol>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 font-serif text-sm font-semibold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{body}</p>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 11v9h14v-9" />
    </svg>
  );
}
function ChevronLeft({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${flipped ? "-scale-x-100" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" /><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" />
    </svg>
  );
}
function TabsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="7" width="13" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}
function PlusSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8" /><path d="M8 12h8" />
    </svg>
  );
}

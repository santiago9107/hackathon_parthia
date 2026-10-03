import type { Tribute } from "@/lib/agents/roster";

/**
 * Sponsor marks stay text-first until an official, unmodified asset is added.
 * This keeps the badge legible and avoids recreating a sponsor logo.
 */
export function SponsorLogo({ name }: { name: Tribute | string }) {
  return <span className="inline-flex items-center gap-1.5"><span aria-hidden className="grid h-4 w-4 place-items-center rounded bg-gold-500 text-[9px] font-bold text-navy">{name.slice(0, 1)}</span><span>{name}</span></span>;
}

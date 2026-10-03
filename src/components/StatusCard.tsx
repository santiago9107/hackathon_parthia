import Link from "next/link";
import type { DomainIndicator } from "@/lib/types";
import { LEVEL_STYLES, LevelBadge } from "./Badges";
import { Card } from "./PageHeader";
import { AppIcon, type AppIconName } from "./AppIcon";

const DOMAIN_LINKS: Record<DomainIndicator["domain"], { href: string; icon: AppIconName }> = {
  "medication-safety": { href: "/medications/", icon: "medication" },
  physical: { href: "/passport/clinical/", icon: "physical" },
  "mental-health": { href: "/trends/", icon: "mental" },
  nutrition: { href: "/trends/", icon: "nutrition" },
};

export function StatusCard({ indicator }: { indicator: DomainIndicator }) {
  const link = DOMAIN_LINKS[indicator.domain];
  return (
    <Card accent={LEVEL_STYLES[indicator.level].accent} className="flex flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><AppIcon name={link.icon} className="h-4 w-4" /></span>
          <h3 className="font-serif text-lg font-semibold text-navy">{indicator.label}</h3>
        </div>
        <LevelBadge level={indicator.level} />
      </div>
      {indicator.metric && <p className="text-2xl font-semibold tracking-tight text-ink">{indicator.metric}</p>}
      <p className="mt-1.5 text-sm font-medium leading-snug text-ink-soft">{indicator.headline}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{indicator.detail}</p>
      <Link href={link.href} className="mt-auto pt-4 text-sm font-semibold text-brand-700 hover:text-brand-900">
        See details →
      </Link>
    </Card>
  );
}

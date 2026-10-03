/** Text helpers: KB placeholder filling and the forbidden-phrase scan. */
import language from "../../config/language.json";

const PATTERNS = [
  ...language.forbidden_patterns.map((p) => new RegExp(p, "i")),
  ...language.must_not_say.map((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")),
];

/** Returns every forbidden pattern found in `text` (empty = clean). */
export function forbiddenPhrases(text: string): string[] {
  return PATTERNS.filter((re) => re.test(text)).map((re) => re.source);
}

/** Replace KB placeholders such as [drug], [value], [MRA]. Throws if any placeholder remains. */
export function fill(template: string, values: Record<string, string>): string {
  const out = template.replace(/\[([^\]]+)\]/g, (whole, key: string) => values[key] ?? whole);
  const left = out.match(/\[[^\]]+\]/g);
  if (left) throw new Error(`Unfilled placeholder(s) ${left.join(", ")} in: ${template}`);
  return out;
}

export function fmt(value: number, unit: string): string {
  const v = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  return unit === "%" ? `${v}%` : `${v} ${unit}`;
}

export function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

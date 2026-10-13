export type Item = {
  id: string; // hash of canonical URL
  url: string;
  title: string;
  source: string;
  tier: number;
  published: number; // ms epoch
  text: string; // short snippet for the model
  also: string[]; // other sources covering the same story
};

export const TZ = "America/Los_Angeles";

/** Local parts of a moment in `tz` (date string, hour, weekday). */
export function local(ms: number, tz = TZ) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(ms).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: p.weekday as string };
}

/** Freshness window: 24h, or 72h on Mondays (covers the weekend). */
export function windowMs(now: number) {
  return (local(now).weekday === "Mon" ? 72 : 24) * 3600_000;
}

export function fmtTime(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(ms);
}

export function canonical(raw: string) {
  try {
    const u = new URL(raw);
    u.protocol = "https:";
    u.hostname = u.hostname.replace(/^(www|m)\./, "");
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (/^(utm_|ref$|source$|fbclid|gclid)/.test(k)) u.searchParams.delete(k);
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

/** FNV-1a; stable short id, not security sensitive. */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const strip = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);

/** Collapse same-URL and near-identical-title items; keep the most primary source. */
export function dedupe(items: Item[]): Item[] {
  const out: (Item & { w: Set<string> })[] = [];
  const sorted = [...items].sort((a, b) => a.tier - b.tier || a.published - b.published);
  for (const it of sorted) {
    const w = words(it.title);
    const dup = out.find((o) => {
      if (o.id === it.id) return true;
      const inter = [...w].filter((x) => o.w.has(x)).length;
      return w.size >= 3 && inter / (w.size + o.w.size - inter) >= 0.6;
    });
    if (dup) {
      if (dup.source !== it.source && !dup.also.includes(it.source)) dup.also.push(it.source);
    } else out.push({ ...it, also: [...it.also], w });
  }
  return out.map(({ w, ...it }) => it);
}

export function matchesAny(text: string, terms: string[]) {
  const t = text.toLowerCase();
  return terms.some((k) => t.includes(k.toLowerCase()));
}

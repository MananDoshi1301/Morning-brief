import { config } from "./config.ts";
import type { Item } from "./util.ts";

export type Judged = Item & {
  summary: string; why: string; score: number; unconfirmed: boolean; topic: string;
  paper?: { problem: string; idea: string; practice: string };
  incident?: { trigger: string; failure: string; lesson: string };
  release?: { changed: string; consequence: string };
  related?: { title: string; url: string; source: string }[]; // same event, other outlets
};
type Run = (model: string, input: unknown) => Promise<unknown>;

const SYSTEM = `You curate a morning brief for a software engineer on a database transactions team at a large enterprise database company in the Bay Area. They read research papers on databases and distributed systems and care most about engineering at scale: how real systems are built, run, break and get fixed.
Score HIGH (impact 7-10): database and storage internals, transactions, concurrency control, replication, consensus, query processing; how companies scale systems (architecture, migrations, sharding, caching, queues, performance work with numbers); outages and postmortems with a cause; deep kernel, compiler or AI-infrastructure engineering.
Score LOW (impact 0-3): version or release announcements that only list changes or say "X.Y released" with no engineering detail; product launches, pricing, funding, hiring, company news, opinion or career pieces without technical substance; consumer tech; anything about investing or markets.
For each numbered item, return ONLY a JSON array of objects:
{"i": <item number>, "relevance": 0-10, "novelty": 0-10, "impact": 0-10, "unconfirmed": true|false, "topic": "1-2 word label such as Transactions, Storage, Kernels, Research, Postmortem", "summary": "1-2 plain sentences in your own words", "why": "one line: why it matters to this reader"}
For research papers (source arXiv) also add "problem", "idea" and "practice": one plain sentence each on the problem, the key idea, and the practical implication.
For incident postmortems, add "trigger", "failure" and "lesson" (one sentence each) ONLY if the text states all three; otherwise omit them.
For software releases, add "changed" (what changed) and "consequence" (the engineering consequence for someone running it), one sentence each.
Rules: use only facts in the given text; never invent numbers, names or dates. Score hype, listicles, beginner tutorials and marketing low. "unconfirmed" is true for rumors or anonymous single-source reports.`;

/** Pull the first JSON array out of a model reply. */
export function parseJudgements(reply: unknown): any[] {
  if (Array.isArray(reply)) return reply;
  const s = typeof reply === "string" ? reply : JSON.stringify(reply ?? "");
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  try { const arr = JSON.parse(s.slice(a, b + 1)); if (Array.isArray(arr) && arr.length) return arr; } catch {}
  // Small models often write "[1]\n{...}\n\n[2]\n{...}": fall back to every flat {...} object that has an item number.
  return (s.match(/\{[^{}]*\}/g) ?? []).flatMap((o) => { try { const j = JSON.parse(o); return j && j.i != null ? [j] : []; } catch { return []; } });
}

const clamp = (n: unknown) => Math.max(0, Math.min(10, Number(n) || 0));

/** Weighted score plus a nudge for primary sources and your thumbs. */
export function score(j: any, tier: number, sourceVotes: number) {
  const base = 0.4 * clamp(j.relevance) + 0.2 * clamp(j.novelty) + 0.4 * clamp(j.impact);
  const tierBonus = tier === 1 ? 0.8 : tier === 2 ? 0.4 : 0;
  return base + tierBonus + Math.max(-2, Math.min(2, sourceVotes * 0.25));
}

export async function judge(run: Run, items: Item[], votes: Record<string, number>, notes: string[]) {
  const out: Judged[] = [];
  const BATCH = 8;
  for (let s = 0; s < items.length; s += BATCH) {
    const batch = items.slice(s, s + BATCH);
    const user = batch.map((it, i) => `${i + 1}. [${it.source}] ${it.title}\n${it.text}`).join("\n\n");
    try {
      const res: any = await run(config.llmModel, {
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
        max_tokens: 1800,
        temperature: 0.2,
      });
      const parsed = parseJudgements(res?.response);
      if (!parsed.length) notes.push(`model reply unparsable on ${batch.length} items: ${JSON.stringify(res?.response ?? res).slice(0, 300)}`);
      for (const j of parsed) {
        const it = batch[Number(j.i) - 1];
        if (!it || !j.summary || !j.why) continue; // no "why it matters" line, no slot in the brief
        out.push({
          ...it, summary: String(j.summary), why: String(j.why), unconfirmed: j.unconfirmed === true,
          topic: String(j.topic || "").slice(0, 24),
          ...(j.problem && j.idea && j.practice ? { paper: { problem: String(j.problem), idea: String(j.idea), practice: String(j.practice) } } : {}),
          ...(j.trigger && j.failure && j.lesson ? { incident: { trigger: String(j.trigger), failure: String(j.failure), lesson: String(j.lesson) } } : {}),
          ...(j.changed && j.consequence ? { release: { changed: String(j.changed), consequence: String(j.consequence) } } : {}),
          score: score(j, it.tier, votes[it.source] ?? 0),
        });
      }
    } catch (e) {
      notes.push(`model failed on ${batch.length} items (${(e as Error).message})`);
    }
  }
  return out;
}

const EVENTS = `You find news stories that report the same event. List A holds stories already shown in recent issues. List B holds today's stories, numbered.
Two stories are the same event when they cover the same incident, outage, release, paper, announcement or company action, even if worded differently.
Return ONLY JSON: {"same": [[B numbers that are one event], ...], "old": [B numbers that repeat an event from list A]}. Leave out stories with no match. When unsure, they are different.`;

/** Validated groups of 1-based B numbers; anything malformed means "no duplicates". */
export function parseEvents(reply: unknown, n: number): { same: number[][]; old: number[] } {
  const s = typeof reply === "string" ? reply : JSON.stringify(reply ?? "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  const ok = (x: unknown) => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= n;
  try {
    const j = JSON.parse(s.slice(a, b + 1));
    const same = (Array.isArray(j.same) ? j.same : []).map((g: unknown) => Array.isArray(g) ? [...new Set(g.map(Number).filter(ok))] : []).filter((g: number[]) => g.length > 1);
    const old = (Array.isArray(j.old) ? j.old : []).map(Number).filter(ok);
    return { same, old };
  } catch { return { same: [], old: [] }; }
}

/** One card per event: the best-scored story keeps the slot, the rest become "also covered" links; repeats of earlier issues go. */
export async function mergeEvents(run: Run, judged: Judged[], earlier: string[], notes: string[]) {
  const head = judged.slice(0, 40); // already sorted best-first; the tail can't reach the brief anyway
  if (head.length < 2) return judged;
  let ev: { same: number[][]; old: number[] };
  try {
    const res: any = await run(config.llmModel, {
      messages: [{ role: "system", content: EVENTS }, { role: "user", content:
        `List A:\n${earlier.map((t) => `- ${t}`).join("\n") || "(none)"}\n\nList B:\n${head.map((t, i) => `${i + 1}. ${t.title}`).join("\n")}` }],
      max_tokens: 300, temperature: 0,
    });
    ev = parseEvents(res?.response, head.length);
  } catch (e) { notes.push(`event grouping skipped (${(e as Error).message})`); return judged; }
  const drop = new Set(ev.old.map((i) => i - 1));
  for (const g of ev.same) {
    const [keep, ...rest] = g.map((i) => i - 1).filter((i) => !drop.has(i)).sort((x, y) => x - y);
    if (keep === undefined) continue;
    for (const r of rest) {
      const o = head.at(r)!;
      (head.at(keep)!.related ??= []).push({ title: o.title, url: o.url, source: o.source });
      drop.add(r);
    }
  }
  return judged.filter((_, i) => !drop.has(i));
}

const INSIGHT = `Below are today's top stories for a database and distributed-systems engineer. If two or more are genuinely connected (same system, same company, or one plainly affects the other), write ONE or TWO plain sentences stating that connection using only facts given. Otherwise there is no insight.
Return ONLY JSON: {"insight": "<sentences>", "refs": [<item numbers>]} or {"insight": null}. Never stretch for a link.`;

/** Accept an insight only if it cites at least two real items; anything else means "no insight". */
export function parseInsight(reply: unknown, n: number): { text: string; refs: number[] } | null {
  const s = typeof reply === "string" ? reply : JSON.stringify(reply ?? "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(s.slice(a, b + 1));
    const refs = [...new Set<number>((j.refs ?? []).map(Number))].filter((r) => Number.isInteger(r) && r >= 1 && r <= n);
    return typeof j.insight === "string" && j.insight.trim() && refs.length >= 2 ? { text: j.insight.trim().slice(0, 400), refs } : null;
  } catch { return null; }
}

export async function insight(run: Run, top: Judged[]) {
  if (top.length < 2) return null;
  try {
    const res: any = await run(config.llmModel, {
      messages: [{ role: "system", content: INSIGHT },
        { role: "user", content: top.map((t, i) => `${i + 1}. ${t.title}\n${t.summary}`).join("\n\n") }],
      max_tokens: 300, temperature: 0.2,
    });
    return parseInsight(res?.response, top.length);
  } catch { return null; } // optional: the brief ships without it
}

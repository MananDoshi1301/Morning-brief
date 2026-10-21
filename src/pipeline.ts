import { config } from "./config.ts";
import { insight, judge } from "./llm.ts";
import type { MarketEnv } from "./markets.ts";
import { plain, render } from "./render.ts";
import { toUi } from "./ui.ts";
import { fetchSource } from "./sources.ts";
import { dedupe, local, matchesAny, windowMs, type Item } from "./util.ts";

// No Worker-only imports here: scripts/run-brief.ts runs this in Node with REST-backed DB/AI.
export interface PipelineEnv extends MarketEnv {
  DB: D1Database;
  AI: Ai;
  BASE_URL: string; // e.g. https://morning-brief.<you>.workers.dev
  ACCESS_KEY: string; // guards /run and feedback links
}

export type Send = (subject: string, html: string) => Promise<void>;

async function seenIds(db: D1Database, ids: string[], today: string) {
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const r = await db.prepare(`SELECT id FROM items WHERE brief_date <> ? AND id IN (${chunk.map(() => "?").join(",")})`)
      .bind(today, ...chunk).all<{ id: string }>();
    r.results.forEach((x) => seen.add(x.id));
  }
  return seen;
}

const sectionOf = new Map(config.sources.map((s) => [s.id, "section" in s && s.section ? s.section : "core"]));

export async function buildBrief(env: PipelineEnv, now = Date.now(), force = false, send?: Send) {
  const date = local(now).date;
  const claim = await env.DB.prepare(
    `INSERT INTO briefs (date, status, created) VALUES (?, 'running', ?)
     ON CONFLICT(date) DO UPDATE SET status='running', created=excluded.created
     WHERE briefs.status = 'failed' OR ?`,
  ).bind(date, now, force ? 1 : 0).run();
  if (!claim.meta.changes) return { date, skipped: true }; // cron fired twice, or already sent

  try {
    const since = now - windowMs(now);
    const missing: string[] = [];

    // fetch → normalize
    const fetched = await Promise.all(config.sources.map(async (s) => {
      try {
        const items = await fetchSource(s, since);
        return "filter" in s && s.filter ? items.filter((i) => matchesAny(`${i.title} ${i.text}`, config.topics)) : items;
      } catch (e) {
        missing.push(`${s.id} (${(e as Error).message})`);
        return [] as Item[];
      }
    }));
    const all = fetched.flat().filter((i) => !matchesAny(i.title, config.muted));

    // dedupe (within today, then against past briefs)
    const unique = dedupe(all);
    const seen = await seenIds(env.DB, unique.map((i) => i.id), date);
    const candidates = unique.filter((i) => !seen.has(i.id))
      .sort((a, b) => a.tier - b.tier || b.published - a.published)
      .slice(0, config.maxLlmItems);

    // score + summarize
    const votes = Object.fromEntries((await env.DB.prepare(
      `SELECT source, SUM(vote) v FROM feedback GROUP BY source`).all<{ source: string; v: number }>())
      .results.map((r) => [r.source, r.v]));
    const judged = (await judge((m, i) => env.AI.run(m as any, i as any), candidates, votes, missing))
      .filter((j) => j.score >= config.minScore)
      .sort((a, b) => b.score - a.score);
    const of = (sec: string) => judged.filter((j) => sectionOf.get(j.source) === sec);
    const core = of("core").slice(0, config.caps.core);
    const ai = of("ai").slice(0, config.caps.ai);
    const industry = of("industry").slice(0, config.caps.industry);
    const marketNews = of("markets").slice(0, config.caps.markets);
    const top = [...core, ...ai, ...industry, ...marketNews].sort((a, b) => b.score - a.score).slice(0, config.caps.top);

    const connection = await insight((m, i) => env.AI.run(m as any, i as any), top);
    // ponytail: markets are off until investing comes back; fetchMarkets in markets.ts still works, call it here to restore.
    const markets = { macro: [], earnings: [], filings: [], missing: [] as string[] };

    // render + store (the app reads `data`; the email is `html`)
    const brief = { date, top, core, ai, industry, marketNews, markets, missing };
    const html = render(brief, env.BASE_URL, env.ACCESS_KEY);
    const data = toUi({ date, generatedAt: Date.now(), window: { from: since, to: now }, sourcesChecked: config.sources.length, core, ai, industry, marketNews, judged, top, markets, missing, insight: connection });
    const shown = new Set([...core, ...ai, ...industry, ...marketNews].map((c) => c.id));
    await env.DB.batch([
      ...judged.map((j) => env.DB.prepare(
        `INSERT OR IGNORE INTO items (id, brief_date, url, title, source, topic, published, summary, why, score, shown)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(j.id, date, j.url, j.title, j.source, j.topic, j.published, j.summary, j.why, j.score, shown.has(j.id) ? 1 : 0)),
      env.DB.prepare(`DELETE FROM briefs_fts WHERE date = ?`).bind(date),
      env.DB.prepare(`INSERT INTO briefs_fts (date, body) VALUES (?, ?)`).bind(date, plain(brief)),
      env.DB.prepare(`UPDATE briefs SET status='built', html=?, data=?, missing=?, created=? WHERE date=?`)
        .bind(html, JSON.stringify(data), JSON.stringify(missing), data.generatedAt, date),
    ]);

    await send?.(`Morning Brief · ${date}`, html);
    await env.DB.prepare(`UPDATE briefs SET status='sent', sent=? WHERE date=?`).bind(Date.now(), date).run();
    return { date, items: core.length, missing };
  } catch (e) {
    await env.DB.prepare(`UPDATE briefs SET status='failed', error=? WHERE date=?`)
      .bind(String(e), date).run();
    throw e;
  }
}

// JSON API for the reader app. Auth is checked by the caller (index.ts).
import { config } from "./config.ts";
import type { Env } from "./index.ts";
import { esc } from "./util.ts";
import { lists, saveList } from "./settings.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

type BriefRow = { date: string; status: string; data: string | null; error: string | null; created: number; sent: number | null };

function briefOf(r: BriefRow) {
  if (r.data) return { ...JSON.parse(r.data), status: r.status === "sent" ? "sent" : r.status, sentAt: r.sent };
  // Failed or still running: no stored issue, only what is known about the attempt.
  return {
    date: r.date, status: r.status === "running" ? "running" : "failed", error: r.error ?? "The run stopped before the brief was built.",
    generatedAt: r.created, sentAt: null, window: { from: r.created, to: r.created }, sourcesChecked: 0, missing: [],
    top: [], sections: { core: [], ai: null, industry: null }, deepRead: null, markets: null,
  };
}

export async function api(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const db = env.DB;

  const m = url.pathname.match(/^\/api\/brief\/(latest|\d{4}-\d{2}-\d{2})$/);
  if (m && req.method === "GET") {
    const row = m[1] === "latest"
      ? await db.prepare(`SELECT * FROM briefs ORDER BY date DESC LIMIT 1`).first<BriefRow>()
      : await db.prepare(`SELECT * FROM briefs WHERE date = ?`).bind(m[1]).first<BriefRow>();
    if (!row) return json({ error: "no_brief" }, 404);
    const brief = briefOf(row);
    const ids = [...(brief.sections.core ?? []), ...(brief.sections.ai ?? []), ...(brief.sections.industry ?? []), ...(brief.markets?.news ?? [])]
      .map((s: { id: string }) => s.id);
    const items: Record<string, { saved: boolean; vote: number; read: boolean }> = {};
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      const r = await db.prepare(`SELECT id, saved, vote, read FROM items WHERE id IN (${chunk.map(() => "?").join(",")})`)
        .bind(...chunk).all<{ id: string; saved: number; vote: number; read: number }>();
      for (const x of r.results) items[x.id] = { saved: !!x.saved, vote: x.vote, read: !!x.read };
    }
    const savedTotal = (await db.prepare(`SELECT COUNT(*) n FROM items WHERE saved = 1`).first<{ n: number }>())?.n ?? 0;
    return json({ brief, items, savedTotal });
  }

  if (url.pathname === "/api/archive") {
    const q = url.searchParams.get("q")?.trim() ?? "";
    const rows = (await db.prepare(`SELECT * FROM briefs ORDER BY date DESC LIMIT 120`).all<BriefRow>()).results;
    let hits: Map<string, string> | null = null;
    if (q) {
      // FTS phrase-per-word query; markers swapped to <mark> after escaping so stored text can't inject HTML.
      const match = q.replace(/"/g, "").split(/\s+/).filter(Boolean).map((w) => `"${w}"`).join(" ");
      const r = await db.prepare(`SELECT date, snippet(briefs_fts, 1, char(1), char(2), '…', 14) s FROM briefs_fts WHERE briefs_fts MATCH ? LIMIT 60`)
        .bind(match).all<{ date: string; s: string }>();
      hits = new Map(r.results.map((x) => [x.date, esc(x.s).replace(/\u0001/g, "<mark>").replace(/\u0002/g, "</mark>")]));
    }
    const issues = rows.filter((r) => !hits || hits.has(r.date)).map((r) => {
      const b = briefOf(r);
      const lead = b.sections.core?.find((s: { id: string }) => s.id === b.top[0]?.id)?.title ?? b.sections.core?.[0]?.title ?? null;
      return { date: r.date, status: b.status, generatedAt: b.generatedAt, missing: b.missing.length, lead, error: b.status === "failed" ? b.error : null, snippet: hits?.get(r.date) ?? null };
    });
    return json({ issues });
  }

  if (url.pathname === "/api/saved") {
    const r = await db.prepare(
      `SELECT id, url, title, source, topic, published, brief_date AS briefDate, read FROM items WHERE saved = 1 ORDER BY saved_at DESC`,
    ).all<Record<string, unknown>>();
    return json({ items: r.results.map((x) => ({ ...x, read: !!x.read, saved: true })) });
  }

  const it = url.pathname.match(/^\/api\/items\/([\w-]+)$/);
  if (it && req.method === "POST") {
    const id = it[1];
    const body = (await req.json().catch(() => null)) as { saved?: boolean; read?: boolean; vote?: number; reason?: string } | null;
    const row = await db.prepare(`SELECT source FROM items WHERE id = ?`).bind(id).first<{ source: string }>();
    if (!row) return json({ error: "Unknown item" }, 404);
    if (!body) return json({ error: "Expected a JSON body" }, 400);
    const ops: D1PreparedStatement[] = [];
    if (typeof body.saved === "boolean")
      ops.push(db.prepare(`UPDATE items SET saved = ?, saved_at = ? WHERE id = ?`).bind(body.saved ? 1 : 0, body.saved ? Date.now() : null, id));
    if (typeof body.read === "boolean") ops.push(db.prepare(`UPDATE items SET read = ? WHERE id = ?`).bind(body.read ? 1 : 0, id));
    if (body.vote === 1 || body.vote === -1 || body.vote === 0) {
      // One vote per item: replacing it keeps source weights honest.
      ops.push(db.prepare(`UPDATE items SET vote = ? WHERE id = ?`).bind(body.vote, id));
      ops.push(db.prepare(`DELETE FROM feedback WHERE item_id = ?`).bind(id));
      if (body.vote) ops.push(db.prepare(`INSERT INTO feedback (item_id, source, vote, created) VALUES (?,?,?,?)`).bind(id, row.source, body.vote, Date.now()));
    }
    if (typeof body.reason === "string")
      ops.push(db.prepare(`UPDATE feedback SET reason = ? WHERE item_id = ?`).bind(body.reason.slice(0, 80), id));
    if (!ops.length) return json({ error: "Nothing to change" }, 400);
    await db.batch(ops);
    return json({ ok: true });
  }

  // Add or remove a source: {add: {id, url, section, tier, filter}} or {remove: id}.
  if (url.pathname === "/api/sources" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as any, L = await lists(db);
    if (typeof body.remove === "string") {
      const sources = L.sources.filter((s) => s.id !== body.remove);
      if (sources.length === L.sources.length) return json({ error: "No such source" }, 404);
      await saveList(db, "sources", sources);
      return json({ sources });
    }
    const a = body.add ?? {}, id = String(a.id ?? "").trim().slice(0, 60);
    if (!id || L.sources.some((s) => s.id.toLowerCase() === id.toLowerCase())) return json({ error: id ? "A source with that name exists" : "Give the source a name" }, 400);
    let feed: URL;
    try { feed = new URL(String(a.url)); if (!/^https?:$/.test(feed.protocol)) throw 0; } catch { return json({ error: "The URL must start with http:// or https://" }, 400); }
    if (!["core", "ai", "industry"].includes(a.section)) return json({ error: "Pick a section" }, 400);
    const tier = [1, 2, 3].includes(Number(a.tier)) ? Number(a.tier) as 1 | 2 | 3 : 2;
    // Check it's a feed before it can break a morning's build.
    const r = await fetch(feed, { headers: { "user-agent": "Mozilla/5.0 morning-brief" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    const head = r?.ok ? (await r.text()).slice(0, 4000) : "";
    if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(head)) return json({ error: r?.ok ? "That URL isn't an RSS or Atom feed" : `Couldn't fetch it (${r?.status ?? "no response"})` }, 400);
    const sources = [...L.sources, { id, kind: "feed" as const, url: feed.href, tier, section: a.section, ...(a.filter ? { filter: true } : {}) }];
    await saveList(db, "sources", sources);
    return json({ sources });
  }

  // Add or remove an interest keyword or muted word: {list: "topics" | "muted", add | remove: word}.
  if (url.pathname === "/api/topics" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as any, L = await lists(db);
    const key = body.list === "muted" ? "muted" : "topics";
    const word = String(body.add ?? body.remove ?? "").trim().toLowerCase().slice(0, 40);
    if (word.length < 2) return json({ error: "Too short" }, 400);
    const next = body.add ? [...new Set([...L[key], word])] : L[key].filter((w) => w !== word);
    await saveList(db, key, next);
    return json({ [key]: next });
  }

  if (url.pathname === "/api/config") {
    const L = await lists(db);
    return json({
      watchlist: config.watchlist.map((w) => ({ ticker: w.ticker, names: w.names })),
      sources: L.sources, topics: L.topics, muted: L.muted,
      delivery: { time: config.deliveryLabel, email: env.EMAIL_TO },
    });
  }

  return json({ error: "Not found" }, 404);
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJudgements, score } from "../src/llm.ts";
import { parseFeed } from "../src/sources.ts";
import { canonical, dedupe, hash, local, windowMs, type Item } from "../src/util.ts";

const item = (over: Partial<Item>): Item => ({
  id: hash(over.url ?? "x"), url: "https://a.com/x", title: "t", source: "s", tier: 2,
  published: 0, text: "", also: [], ...over,
});

test("canonical strips tracking, www, fragment, trailing slash", () => {
  assert.equal(canonical("http://www.example.com/post/?utm_source=hn&id=3#top"), "https://example.com/post?id=3");
});

test("dedupe keeps the primary source and notes the others", () => {
  const out = dedupe([
    item({ url: "https://news.com/a", title: "PostgreSQL 19 released with async IO", source: "HN", tier: 3, id: "1" }),
    item({ url: "https://postgresql.org/a", title: "PostgreSQL 19 Released with Async IO!", source: "PostgreSQL", tier: 1, id: "2" }),
    item({ url: "https://lwn.net/b", title: "Linux 7.1 scheduler changes", source: "LWN", id: "3" }),
  ]);
  assert.equal(out.length, 2);
  const pg = out.find((i) => i.id === "2")!;
  assert.deepEqual(pg.also, ["HN"]);
});

test("parses RSS and Atom", () => {
  const rss = `<rss><channel><item><title>A &amp; B</title><link>https://x.com/a?utm_medium=rss</link>
    <pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;hello&lt;/p&gt;</description></item></channel></rss>`;
  const [r] = parseFeed(rss, { id: "X", tier: 2 });
  assert.equal(r.url, "https://x.com/a");
  assert.equal(r.title, "A & B");
  assert.equal(r.published, Date.parse("2026-10-12T10:00:00Z"));

  const atom = `<feed><entry><title type="html">v1.2.0</title><link rel="alternate" href="https://github.com/o/r/releases/tag/v1.2.0"/>
    <updated>2026-10-12T09:00:00Z</updated><content type="html">notes</content></entry></feed>`;
  const [a] = parseFeed(atom, { id: "R", tier: 1 });
  assert.equal(a.url, "https://github.com/o/r/releases/tag/v1.2.0");
  assert.equal(a.text, "notes");
});

test("model reply parsing tolerates prose around the JSON", () => {
  assert.equal(parseJudgements('Sure! [{"i":1,"summary":"s","why":"w"}] hope this helps').length, 1);
  assert.deepEqual(parseJudgements("no json"), []);
  assert.deepEqual(parseJudgements(`[1]\n{"i": 1, "why": "w"}\n\n[2]\n{"i": 2, "why": "x"}`).map((j) => j.i), [1, 2]);
  assert.ok(score({ relevance: 10, novelty: 10, impact: 10 }, 1, 0) > score({ relevance: 10, novelty: 10, impact: 10 }, 3, 0));
});

test("PT time: DST cron gating and Monday window", () => {
  assert.equal(local(Date.parse("2026-10-12T13:00:00Z")).hour, 6); // PDT
  assert.equal(local(Date.parse("2026-12-14T14:00:00Z")).hour, 6); // PST
  assert.equal(windowMs(Date.parse("2026-10-12T13:00:00Z")), 72 * 3600_000); // Monday
  assert.equal(windowMs(Date.parse("2026-10-13T13:00:00Z")), 24 * 3600_000);
});

test("UI data: markets are news, calendar and filings only; watchlist links stories without repeating them", async () => {
  const { toUi } = await import("../src/ui.ts");
  const now = Date.parse("2026-10-13T06:04:00-07:00");
  const j = (id: string, title: string) => ({ id, url: `https://x.com/${id}`, title, source: "S", tier: 1, published: now, text: "", also: [],
    summary: "s", why: "w", score: 8, unconfirmed: false, topic: "T" });
  const shown = j("a", "Oracle ships a new release"), notShown = j("b", "Nvidia earnings preview"), ai = j("c", "vLLM adds a new scheduler");
  const d = toUi({
    date: "2026-10-13", generatedAt: now, window: { from: now - 24 * 3600_000, to: now }, sourcesChecked: 1,
    core: [shown], ai: [ai], industry: [], marketNews: [], judged: [shown, notShown, ai], top: [ai, shown], missing: [],
    markets: { macro: [{ name: "Consumer Price Index", date: "2026-10-13" }], earnings: [{ ticker: "ORCL", name: "Oracle", time: "After Close" }],
      filings: [{ ticker: "ORCL", form: "4", date: "2026-10-12", url: "https://sec.gov/x" }], missing: [] },
  });
  const orcl = d.markets.watchlist.find((w) => w.ticker === "ORCL")!;
  assert.equal(orcl.filings.length, 1);
  assert.equal(orcl.mentions[0].inBrief, true);
  assert.equal(d.markets.watchlist.find((w) => w.ticker === "NVDA")!.mentions[0].inBrief, false);
  assert.equal(d.markets.calendar[1].timing, "After the close");
  assert.ok(!JSON.stringify(d.markets).match(/"(price|pct|quotes)"/)); // no prices anywhere
  assert.deepEqual(d.top.map((t) => t.section), ["AI & infra", "Core tech"]);
  assert.equal(d.sections.ai[0].id, "c");
  assert.deepEqual(d.sections.industry, []);
});

test("insight is kept only when it cites two or more real Top 5 items", async () => {
  const { parseInsight } = await import("../src/llm.ts");
  assert.deepEqual(parseInsight('{"insight":"A and B share X.","refs":[1,3]}', 5), { text: "A and B share X.", refs: [1, 3] });
  assert.equal(parseInsight('{"insight":"Only one.","refs":[2]}', 5), null);
  assert.equal(parseInsight('{"insight":"Out of range.","refs":[1,9]}', 5), null);
  assert.equal(parseInsight('{"insight":null}', 5), null);
  assert.equal(parseInsight("no json here", 5), null);
});

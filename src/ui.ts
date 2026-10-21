// The JSON the reader app renders. One stored copy per issue, so past issues never change.
import { config } from "./config.ts";
import type { Judged } from "./llm.ts";
import type { Markets } from "./markets.ts";

const SOURCE_TYPE = { 1: "Primary source", 2: "Blog or established outlet", 3: "Community discussion" } as Record<number, string>;
const MACRO_WHY: [string, string][] = [
  ["Consumer Price Index", "Inflation print; the main input to rate expectations."],
  ["Employment Situation", "Monthly jobs report; moves yields and the dollar."],
  ["Personal Income and Outlays", "Includes PCE, the Fed's preferred inflation gauge."],
  ["Producer Price Index", "Upstream inflation; a lead on consumer prices."],
  ["Gross Domestic Product", "Growth estimate for the quarter."],
  ["FOMC", "Fed rate decision and statement."],
  ["Job Openings", "Labor demand (JOLTS)."],
  ["Unemployment Insurance Weekly Claims", "Weekly layoff signal."],
];
const FORM_EXPLAIN: Record<string, string> = {
  "4": "Insider transaction report by an officer, director or 10% owner.",
  "8-K": "Current report of a material event; open the filing for the specific item.",
  "SC 13D": "A holder crossed 5% with intent to influence.",
  "SC 13G": "A passive holder crossed 5%.",
};
const EARNINGS_TIME: Record<string, string> = { "Before Open": "Before the open", "After Close": "After the close" };

const story = (j: Judged) => ({
  id: j.id, url: j.url, title: j.title, source: j.source, sourceType: SOURCE_TYPE[j.tier], tier: j.tier,
  published: j.published || null, topic: j.topic, summary: j.summary, why: j.why,
  unconfirmed: j.unconfirmed, also: j.also, related: j.related ?? [],
  ...(j.paper ? { kind: "paper", paper: j.paper } : {}),
  ...(j.incident ? { incident: j.incident } : {}),
  ...(j.release ? { release: j.release } : {}),
});

export function toUi(a: {
  date: string; generatedAt: number; window: { from: number; to: number }; sourcesChecked: number;
  core: Judged[]; ai: Judged[]; industry: Judged[]; marketNews: Judged[]; judged: Judged[]; top: Judged[]; markets: Markets; missing: string[];
  insight?: { text: string; refs: number[] } | null;
}) {
  const m = a.markets;
  const shown = new Set([...a.core, ...a.ai, ...a.industry, ...a.marketNews].map((j) => j.id));
  const label = new Map<string, string>([...a.ai.map((j) => [j.id, "AI & infra"] as const), ...a.industry.map((j) => [j.id, "Industry"] as const), ...a.marketNews.map((j) => [j.id, "Markets"] as const)]);

  return {
    date: a.date, status: "built" as string, generatedAt: a.generatedAt, sentAt: null as number | null,
    window: a.window, sourcesChecked: a.sourcesChecked, missing: a.missing,
    top: a.top.map((t) => ({ id: t.id, section: label.get(t.id) ?? "Core tech" })),
    // refs are 1-based Top 5 ranks; null means no connection worth stating
    insight: a.insight ?? null,
    sections: { core: a.core.map(story), ai: a.ai.map(story), industry: a.industry.map(story) },
    deepRead: null,
    markets: {
      news: a.marketNews.map(story),
      calendar: [
        ...m.macro.map((x) => ({ name: x.name, type: "macro", timing: null, why: MACRO_WHY.find(([k]) => x.name.includes(k))?.[1] ?? null })),
        ...m.earnings.map((e) => ({ name: `${e.name} (${e.ticker})`, type: "earnings", timing: EARNINGS_TIME[e.time] ?? "Time not announced", why: null })),
      ],
      // Per watchlist company: filings, plus stories that name it (linked, not repeated, when already in the brief).
      watchlist: config.watchlist.map((w) => ({
        ticker: w.ticker, company: w.names[0],
        filings: m.filings.filter((f) => f.ticker === w.ticker).map((f) => ({ ...f, explain: FORM_EXPLAIN[f.form] ?? null })),
        mentions: a.judged
          .filter((j) => w.names.some((nm) => `${j.title} ${j.summary}`.includes(nm)))
          .slice(0, 3)
          .map((j) => ({ id: j.id, title: j.title, url: j.url, source: j.source, inBrief: shown.has(j.id) })),
      })),
      explainer: null,
    },
  };
}
export type UiBrief = ReturnType<typeof toUi>;

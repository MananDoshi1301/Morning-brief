// Market facts that aren't prices: today's scheduled releases and earnings, and SEC filings.
// Market *news* stories come from the regular source list (sources with section: "markets").
import { config } from "./config.ts";
import { local } from "./util.ts";

export type Filing = { ticker: string; form: string; date: string; url: string };
export type Markets = {
  macro: { name: string; date: string }[];
  earnings: { ticker: string; name: string; time: string }[];
  filings: Filing[];
  missing: string[];
};
export type MarketEnv = { TWELVE_DATA_KEY?: string; FRED_KEY: string; SEC_USER_AGENT: string };

async function json(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${new URL(url).host}`);
  const j: any = await r.json();
  if (j?.status === "error") throw new Error(`${new URL(url).host}: ${j.message}`);
  return j;
}

async function macroToday(env: MarketEnv, today: string) {
  const j = await json(
    `https://api.stlouisfed.org/fred/releases/dates?api_key=${env.FRED_KEY}&file_type=json` +
      `&realtime_start=${today}&realtime_end=${today}&include_release_dates_with_no_data=true`,
  );
  return (j.release_dates as any[])
    .filter((r) => r.date === today && config.macroReleases.some((n) => r.release_name.includes(n)))
    .map((r) => ({ name: r.release_name as string, date: r.date as string }));
}

async function earningsToday(env: MarketEnv, today: string) {
  if (!env.TWELVE_DATA_KEY) throw new Error("TWELVE_DATA_KEY not set");
  const j = await json(
    `https://api.twelvedata.com/earnings_calendar?start_date=${today}&end_date=${today}&apikey=${env.TWELVE_DATA_KEY}`,
  );
  const watch = new Set(config.watchlist.map((w) => w.ticker));
  const notable = new Set([...watch, ...config.earningsWatch]);
  return Object.values(j.earnings ?? {}).flat()
    .filter((e: any) => notable.has(e.symbol))
    .map((e: any) => ({ ticker: e.symbol, name: e.name, time: e.time }))
    .sort((a, b) => Number(watch.has(b.ticker)) - Number(watch.has(a.ticker)));
}

async function filings(env: MarketEnv, sinceDate: string): Promise<Filing[]> {
  const out: Filing[] = [];
  for (const w of config.watchlist) {
    const cik = String(w.cik).padStart(10, "0");
    const j = await json(`https://data.sec.gov/submissions/CIK${cik}.json`, { "User-Agent": env.SEC_USER_AGENT });
    const r = j.filings.recent;
    for (let i = 0; i < r.form.length && r.filingDate[i] >= sinceDate; i++) {
      if (!config.filingForms.includes(r.form[i])) continue;
      const acc = r.accessionNumber[i].replace(/-/g, "");
      out.push({
        ticker: w.ticker, form: r.form[i], date: r.filingDate[i],
        url: `https://www.sec.gov/Archives/edgar/data/${w.cik}/${acc}/${r.primaryDocument[i]}`,
      });
    }
  }
  return out;
}

/** Each part fails independently; failures are reported, never filled in. */
export async function fetchMarkets(env: MarketEnv, now: number, since: number): Promise<Markets> {
  const today = local(now).date;
  const missing: string[] = [];
  const attempt = async <T>(name: string, f: () => Promise<T>, empty: T): Promise<T> => {
    try { return await f(); } catch (e) { missing.push(`${name} (${(e as Error).message})`); return empty; }
  };
  const [macro, earnings, fil] = await Promise.all([
    attempt("FRED release calendar", () => macroToday(env, today), []),
    attempt("Earnings calendar", () => earningsToday(env, today), []),
    attempt("SEC EDGAR", () => filings(env, local(since).date), [] as Filing[]),
  ]);
  return { macro, earnings, filings: fil, missing };
}

// Weekday pipeline run outside the Worker (Free plan crons get ~10 ms CPU).
// Talks to the same D1 and Workers AI over Cloudflare's REST API. No email: read the brief in the app.
// Usage: node --experimental-strip-types scripts/run-brief.ts   (FORCE=1 to skip the time gate and rebuild today)
import { buildBrief, refreshVideos, type PipelineEnv } from "../src/pipeline.ts";
import { local } from "../src/util.ts";

const need = (k: string) => process.env[k] || (() => { throw new Error(`missing env ${k}`); })();
const api = `https://api.cloudflare.com/client/v4/accounts/${need("CF_ACCOUNT_ID")}`;
const headers = { authorization: `Bearer ${need("CF_API_TOKEN")}`, "content-type": "application/json" };

async function cf(path: string, body: unknown) {
  const res = await fetch(api + path, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null) as any;
  if (!res.ok || !json?.success) throw new Error(`${path}: ${res.status} ${JSON.stringify(json?.errors ?? json)}`);
  return json.result;
}

const dbPath = `/d1/database/${need("D1_DATABASE_ID")}/query`;
function prepare(sql: string, params: unknown[] = []) {
  const exec = async () => (await cf(dbPath, { sql, params }))[0] as { results: any[]; meta: any };
  return {
    bind: (...p: unknown[]) => prepare(sql, p),
    first: async () => (await exec()).results[0] ?? null,
    all: exec,
    run: exec,
    exec,
  };
}
type Stmt = ReturnType<typeof prepare>;
// ponytail: batch runs one request per statement and isn't atomic like real D1 batch; fine for one daily run.
const DB = { prepare, batch: async (stmts: Stmt[]) => { const out = []; for (const s of stmts) out.push(await s.exec()); return out; } };

const AI = { run: async (model: string, input: unknown) => ({ response: (await cf(`/ai/run/${model}`, input)).response }) };

const env = {
  DB, AI,
  FRED_KEY: need("FRED_KEY"), SEC_USER_AGENT: need("SEC_USER_AGENT"), TWELVE_DATA_KEY: process.env.TWELVE_DATA_KEY,
  ACCESS_KEY: need("ACCESS_KEY"), BASE_URL: need("BASE_URL"),
} as unknown as PipelineEnv;

const now = Date.now(), force = process.env.FORCE === "1";
const { hour, weekday } = local(now);
// Both UTC crons fire; only the one landing at 5 AM PT (5 not 6: GitHub cron often starts late) runs.
if (!force && (weekday === "Sat" || weekday === "Sun" || hour !== 5)) {
  console.log(`skip: ${weekday} ${hour}:00 PT`);
  process.exit(0);
}
console.log(JSON.stringify(await buildBrief(env, now, force), null, 2));
console.log(JSON.stringify(await refreshVideos(env.DB)));

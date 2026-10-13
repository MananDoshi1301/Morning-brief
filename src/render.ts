import type { Judged } from "./llm.ts";
import type { Markets } from "./markets.ts";
import { esc, fmtTime } from "./util.ts";

export type Brief = { date: string; top: Judged[]; core: Judged[]; marketNews: Judged[]; markets: Markets; missing: string[] };

function item(it: Judged, fb: (id: string, v: string) => string) {
  const also = it.also.length ? ` · also covered by ${esc(it.also.join(", "))}` : "";
  return `<article>
  <h3><a href="${esc(it.url)}">${esc(it.title)}</a></h3>
  <p class="meta">${esc(it.source)} · ${fmtTime(it.published)}${also}${it.unconfirmed ? ' · <b class="warn">unconfirmed</b>' : ""}</p>
  <p>${esc(it.summary)}</p>
  <p class="why">→ ${esc(it.why)}</p>
  <p class="fb"><a href="${fb(it.id, "up")}">👍</a> <a href="${fb(it.id, "down")}">👎</a> <a href="${fb(it.id, "save")}">Save</a></p>
</article>`;
}

export function render(b: Brief, base: string, key: string) {
  const fb = (id: string, v: string) => `${base}/fb?id=${id}&v=${v}&k=${encodeURIComponent(key)}`;
  const m = b.markets;
  const li = (xs: string[], empty: string) => (xs.length ? `<ul>${xs.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p class="meta">${empty}</p>`);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Brief · ${b.date}</title><style>
body{margin:0;background:#fbfaf7;color:#1d1d1b;font:16px/1.55 -apple-system,system-ui,Segoe UI,sans-serif}
main{max-width:680px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:32px 0 8px;padding-bottom:4px;border-bottom:2px solid #e6e1d6}
h3{font-size:1rem;margin:0 0 2px}a{color:#1f5fbf;text-decoration:none}a:hover{text-decoration:underline}
article{padding:12px 0;border-bottom:1px solid #eee9df}article p{margin:4px 0}
.meta{color:#6b675e;font-size:.85rem}.why{color:#2c4a2c}.fb{font-size:.85rem}.fb a{margin-right:10px}
.warn{color:#a35a00}ol{padding-left:20px}ol li{margin:6px 0}
</style></head><body><main>
<h1>Morning Brief</h1><p class="meta">${b.date} · <a href="${base}/#brief-${b.date}">Open in the app</a> · <a href="${base}/#archive">Past issues</a></p>

<h2>Top ${b.top.length} today</h2>
${b.top.length ? `<ol>${b.top.map((t) => `<li><a href="${esc(t.url)}">${esc(t.title)}</a> — ${esc(t.why)}</li>`).join("")}</ol>` : `<p class="meta">Nothing cleared the bar today.</p>`}

<h2>Core tech &amp; engineering</h2>
${b.core.map((it) => item(it, fb)).join("") || `<p class="meta">Nothing cleared the bar today.</p>`}

<h2>Markets &amp; investing</h2>
<p class="meta">News and scheduled events only. Not investment advice.</p>
${b.marketNews.map((it) => item(it, fb)).join("") || `<p class="meta">No market news cleared the bar today.</p>`}

<h3 style="margin-top:20px">Today's calendar</h3>
${li([...m.macro.map((x) => `Macro: ${esc(x.name)}`), ...m.earnings.map((e) => `Earnings: ${esc(e.ticker)} (${esc(e.name)})${e.time ? `, ${esc(e.time)}` : ""}`)], "No tracked macro releases or watched earnings today.")}

<h3 style="margin-top:20px">Watchlist SEC filings</h3>
${li(m.filings.map((f) => `${esc(f.ticker)} · <a href="${esc(f.url)}">${esc(f.form)}</a> · ${f.date}`), "No 8-K, 13D/G or Form 4 filings for watchlist names.")}

${b.missing.length ? `<h2>Missing today</h2><p class="meta">${b.missing.map(esc).join("<br>")}</p>` : ""}
</main></body></html>`;
}

/** Plain-text version for search indexing. */
export function plain(b: Brief) {
  return [...b.core, ...b.marketNews].map((i) => `${i.title}\n${i.summary}\n${i.why}`).join("\n\n");
}

// Morning Brief reader. Vanilla JS, hash routes, reads the Worker's /api.
// When /api is unreachable it falls back to window.MB_DEMO and says so on every screen.
(() => {
  "use strict";
  const TZ = "America/Los_Angeles";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: preference lasts this visit only */ } },
  };

  // ---------- icons (16px stroke) ----------
  const P = {
    today: '<path d="M4 5h16v15H4z"/><path d="M4 9h16M9 3v4M15 3v4"/>',
    archive: '<path d="M3 5h18v4H3z"/><path d="M5 9v10h14V9M10 13h4"/>',
    saved: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    watch: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
    sources: '<path d="M4 6h16M4 12h10M4 18h7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
    up: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.3 6.9a2 2 0 0 1-2 1.8H7"/>',
    down: '<path d="M7 13V4H4v9zM7 13l4 8c1.5 0 2.5-1 2.5-2.5V15H19a2 2 0 0 0 2-2.3l-1.3-6.9a2 2 0 0 0-2-1.8H7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    key: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h1M11 10h1M15 10h1M8 14h8"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  };
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

  // ---------- formatting ----------
  const fmtParts = (ms, o) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o }).format(ms);
  const tTime = (ms) => fmtParts(ms, { hour: "numeric", minute: "2-digit" });
  const tDay = (ms) => fmtParts(ms, { weekday: "short", month: "short", day: "numeric" });
  const tDayTime = (ms) => `${fmtParts(ms, { month: "short", day: "numeric" })}, ${tTime(ms)}`;
  const longDate = (d) => fmtParts(Date.parse(`${d}T12:00:00-07:00`), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const shortDate = (d) => fmtParts(Date.parse(`${d}T12:00:00-07:00`), { weekday: "short", month: "short", day: "numeric" });
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

  // ---------- state ----------
  const S = { mode: "loading", variant: "normal", brief: null, cfg: null, items: {}, archive: null, saved: null, route: "today", viewing: null, error: null };

  async function getJSON(path, opt) {
    const r = await fetch(path, { credentials: "same-origin", ...opt });
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) throw Object.assign(new Error("no api"), { noApi: true });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status, body: j });
    return j;
  }

  // Demo variants exist so every interface state can be reviewed without a backend.
  function demoBrief() {
    const b = structuredClone(window.MB_DEMO.brief);
    const v = S.variant;
    if (v === "sparse") {
      b.sections.core = b.sections.core.slice(0, 2);
      b.insight = null; // no connection worth stating, so the opener omits it
      // Edge cases worth seeing: a very long headline and a source that gave no publication time.
      Object.assign(b.sections.core[0], { title: "Postgres hackers converge on a plan for 64-bit transaction IDs after a multi-year debate over on-disk compatibility, pg_upgrade paths and the cost of widening every tuple header", published: null, also: [] });
      b.sections.ai = [];
      b.sections.industry = null;
      b.deepRead = null;
      b.top = b.top.filter((t) => ["c1", "c2"].includes(t.id));
      b.missing.push("arXiv (HTTP 503)", "Earnings calendar (TWELVE_DATA_KEY not set)");
      b.markets.news = [];
      b.markets.calendar = b.markets.calendar.filter((e) => e.type !== "earnings");
      b.markets.watchlist.forEach((w) => { w.mentions = []; w.filings = []; });
      b.markets.explainer = null;
    }
    if (v === "failed") {
      Object.assign(b, { status: "failed", sentAt: null, error: "The model step failed after 3 retries (Workers AI returned 429). Nothing was emailed." });
      b.sections = { core: [], ai: null, industry: null }; b.top = []; b.deepRead = null;
    }
    return b;
  }
  const demoCfg = () => {
    const c = structuredClone(window.MB_DEMO.config);
    if (S.variant === "empty") c.watchlist = [];
    return c;
  };

  async function load() {
    S.mode = "loading"; render();
    try {
      const [b, c] = await Promise.all([
        getJSON(S.viewing ? `/api/brief/${S.viewing}` : "/api/brief/latest").catch((e) => { if (e.status === 404) return null; throw e; }),
        getJSON("/api/config"),
      ]);
      S.mode = "live"; S.cfg = c;
      S.brief = b?.brief ?? null; S.items = b?.items ?? {}; S.savedTotal = b?.savedTotal ?? null;
    } catch (e) {
      if (e.status === 403) { S.mode = "locked"; render(); return; }
      if (!window.MB_DEMO) { S.mode = "error"; S.error = e.message; render(); return; }
      S.mode = "demo";
      S.brief = S.variant === "empty" ? null : demoBrief();
      S.cfg = demoCfg();
      try { S.items = JSON.parse(store.get("mb-demo-items") || "{}"); } catch { S.items = {}; }
    }
    render();
  }

  // ---------- actions (save / read / vote) ----------
  async function act(id, patch, toast) {
    const prev = { ...(S.items[id] || {}) };
    S.items[id] = { ...prev, ...patch };
    paintActions(id);
    if (S.mode === "demo") {
      store.set("mb-demo-items", JSON.stringify(S.items));
      say(`${toast} · prototype, not sent anywhere`);
      return;
    }
    try {
      await getJSON(`/api/items/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      say(toast);
    } catch (e) {
      S.items[id] = prev; paintActions(id);
      say(`Couldn't save that change (${e.message}). Try again.`);
    }
  }
  let toastT;
  function say(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- components ----------
  const allStories = (b) => [...(b?.sections.core || []), ...(b?.sections.ai || []), ...(b?.sections.industry || []), ...(b?.markets?.news || [])];

  function actionsHTML(s) {
    const st = S.items[s.id] || {};
    return `<div class="actions" data-for="${esc(s.id)}">
      <a class="act" href="${esc(s.url)}" target="_blank" rel="noopener">${ic("ext")}Open source<span class="vh"> (opens ${esc(host(s.url))} in a new tab)</span></a>
      <button class="act" data-act="save" aria-pressed="${!!st.saved}">${ic("saved")}<span>${st.saved ? "Saved" : "Save"}</span></button>
      <button class="act" data-act="up" aria-pressed="${st.vote === 1}" aria-label="More like this">${ic("up")}</button>
      <button class="act down" data-act="down" aria-pressed="${st.vote === -1}" aria-label="Less like this">${ic("down")}</button>
      <button class="act" data-act="details" aria-expanded="false">${ic("info")}<span>Source details</span></button>
    </div>
    <div class="reasons" data-reasons="${esc(s.id)}" hidden>Optional reason:
      ${["Not relevant to me", "Already knew this", "Weak source", "Too shallow"].map((r) => `<button data-act="reason" data-reason="${esc(r)}">${esc(r)}</button>`).join("")}
    </div>
    <dl class="details" data-details="${esc(s.id)}" hidden>
      <dt>Source</dt><dd>${esc(s.source)}${s.sourceType ? ` (${esc(s.sourceType)})` : ""}</dd>
      <dt>Link</dt><dd>${esc(s.url)}</dd>
      <dt>Published</dt><dd>${s.published ? `${esc(tDayTime(s.published))} PT` : "Not given by the source"}</dd>
      ${s.also?.length ? `<dt>Also covered by</dt><dd>${esc(s.also.join(", "))}</dd>` : ""}
    </dl>`;
  }
  function paintActions(id) {
    $$(`.actions[data-for="${CSS.escape(id)}"]`).forEach((el) => {
      const st = S.items[id] || {};
      const save = $('[data-act="save"]', el);
      const deep = save.classList.contains("save-btn");
      save.setAttribute("aria-pressed", String(!!st.saved)); $("span", save).textContent = st.saved ? (deep ? "Saved for later" : "Saved") : (deep ? "Save for later" : "Save");
      $('[data-act="up"]', el).setAttribute("aria-pressed", String(st.vote === 1));
      $('[data-act="down"]', el).setAttribute("aria-pressed", String(st.vote === -1));
    });
    const nb = $("#nav-saved-count"); if (nb) nb.textContent = savedCount() || "";
  }
  function savedCount() {
    const ids = new Set(Object.entries(S.items).filter(([, x]) => x.saved).map(([id]) => id));
    if (S.mode === "demo" && S.variant !== "empty")
      window.MB_DEMO.saved.forEach((s) => { if (S.items[s.id]?.saved !== false) ids.add(s.id); });
    if (S.mode === "live" && S.savedTotal != null) return Math.max(S.savedTotal, ids.size);
    return ids.size;
  }

  // Section identity: one shared system, numbered in reading order, each with a muted accent (CSS).
  const SEC = {
    core: { n: "01", title: "Core tech &amp; engineering" },
    ai: { n: "02", title: "AI &amp; infrastructure" },
    industry: { n: "03", title: "Industry &amp; culture" },
    markets: { n: "04", title: "Markets &amp; investing" },
    deep: { n: "05", title: "One deep read" },
  };
  const pub = (ms) => (ms ? `<time datetime="${new Date(ms).toISOString()}">${esc(tDayTime(ms))} PT</time>` : `<span class="muted">publication time not given</span>`);
  // Real publisher icon from the story's own domain; hidden if it doesn't load. Never shown for fictional prototype links.
  const fav = (url) => (S.mode === "live" && host(url) ? `<img class="fav" src="https://icons.duckduckgo.com/ip3/${esc(host(url))}.ico" alt="" width="14" height="14" loading="lazy" onerror="this.remove()">` : "");
  const whyHTML = (why) => `<p class="story-why"><b>Why it matters:</b> ${esc(why)}</p>`;

  // Paper / incident / release detail stays one tap away; every story keeps the same shape.
  function notesHTML(s) {
    const rows = s.paper ? [["Problem", s.paper.problem], ["Key idea", s.paper.idea], ["In practice", s.paper.practice]]
      : s.incident ? [["Trigger", s.incident.trigger], ["Failure", s.incident.failure], ["Lesson", s.incident.lesson]]
      : s.release ? [["What changed", s.release.changed], ["Consequence", s.release.consequence]] : null;
    if (!rows) return "";
    return `<details class="notes"><summary>${s.paper ? "Paper" : s.incident ? "Incident" : "Release"} notes</summary><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></details>`;
  }
  const kickerHTML = (s, pre = "") => `<div class="kicker">${pre}${s.topic ? `<span class="topic">${esc(s.topic)}</span>` : ""}${s.unconfirmed ? `<span class="chip flag" title="Single-source or unconfirmed report">Unconfirmed</span>` : ""}</div>`;
  const metaHTML = (s) => `<p class="story-meta">${esc(s.source || "Unknown source")}${s.published ? ` · ${esc(tTime(s.published))}` : ""}${s.also?.length ? ` · also ${esc(s.also.join(", "))}` : ""}</p>`;

  function storyHTML(s, lead = false) {
    return `<article class="story${lead ? " is-lead" : ""}" id="s-${esc(s.id)}" data-id="${esc(s.id)}" tabindex="-1">
      ${kickerHTML(s, lead ? `<span class="topic">Lead ·</span>` : "")}
      <h3 class="story-title"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
      <p class="story-sum">${esc(s.summary || s.paper?.idea || "")}</p>
      ${whyHTML(s.why)}
      ${notesHTML(s)}
      <div class="story-foot">${metaHTML(s)}${actionsHTML(s)}</div>
    </article>`;
  }

  const notice = (kind, icon, html) => `<div class="notice ${kind}" role="${kind === "bad" ? "alert" : "note"}">${ic(icon)}<div>${html}</div></div>`;
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function storySection(id, list, skip) {
    const items = (list || []).filter((s) => s.id !== skip);
    return items.length ? `<section class="sec" id="sec-${id}" aria-labelledby="h-${id}"><div class="ed-h"><h2 id="h-${id}">${SEC[id].title}</h2></div>${items.map((s) => storyHTML(s)).join("")}</section>` : "";
  }

  // Calendar order: the trading day, then anything without a published time.
  const SLOT = { "Before the open": 0, null: 1, "After the close": 2, "Time not announced": 3 };
  const slotName = (e) => e.timing || "Today"; // release calendars give a date, not a time

  function marketsHTML(b, skip) {
    const m = b.markets;
    if (!m) return "";
    const cal = (m.calendar || []).slice().sort((a, c) => (SLOT[a.timing] ?? 1) - (SLOT[c.timing] ?? 1));
    const filings = (m.watchlist || []).flatMap((w) => w.filings.map((f) => ({ ...f, company: w.company })));
    const news = (m.news || []).filter((s) => s.id !== skip);
    if (!cal.length && !filings.length && !news.length) return "";
    const row = (tag, body, note) => `<li><span class="tk num">${esc(tag)}</span><span>${body}${note ? `<span class="note">${esc(note)}</span>` : ""}</span></li>`;
    return `<section class="sec" id="sec-markets" aria-labelledby="h-markets"><div class="ed-h"><h2 id="h-markets">${SEC.markets.title}</h2><small>News and events</small></div>
      ${cal.length ? `<p class="sub-h">On the calendar today</p><ul class="rows">${cal.map((e) => row(e.type === "earnings" ? "EARN" : "MACRO", `${esc(e.name)}${e.timing ? ` · ${esc(slotName(e))}` : ""}`, e.why)).join("")}</ul>` : ""}
      ${filings.length ? `<p class="sub-h">Watchlist filings</p><ul class="rows">${filings.map((f) => row(f.ticker, `<a href="${esc(f.url)}" target="_blank" rel="noopener">Form ${esc(f.form)}</a> · ${esc(f.date)}`, f.explain)).join("")}</ul>` : ""}
      ${news.map((s) => storyHTML(s)).join("")}
    </section>`;
  }

  function readMinutes(b) {
    const words = allStories(b).reduce((w, s) => w + `${s.title} ${s.summary || ""} ${s.why}`.split(/\s+/).length, 0)
      + (b.markets ? 80 : 0) + (b.deepRead ? 60 : 0);
    return Math.max(1, Math.round(words / 230));
  }

  function todayPage() {
    const b = S.brief;
    const mast = (title, meta, extra = "") => `<header class="mast ed-mast"><div class="ed-top"><h1>${title}</h1>${toolsHTML}</div><p class="ed-meta">${meta}</p>${extra}</header>`;
    if (!b) return mast("Morning Brief", S.mode === "demo" ? "Prototype · empty state" : "No issue yet")
      + emptyBrief("No brief yet", `The first issue is built at ${esc(S.cfg?.delivery?.time || "5:00 AM PT")} on the next weekday.`);
    const archived = S.viewing && S.viewing !== S.latestDate;
    const broken = b.status === "failed" || b.status === "running";
    const lead = allStories(b).find((x) => x.id === b.top?.[0]?.id);
    const n = allStories(b).length;
    const meta = broken ? `Run started ${esc(tTime(b.generatedAt))} PT`
      : `<b>${count(n, "story", "stories")}</b> · ${readMinutes(b)} min read · ready at ${esc(tTime(b.generatedAt))} PT${S.mode === "demo" ? " · sample issue" : ""}`;
    const status = b.status === "running" ? notice("", "info", "<b>Today's brief is being built.</b> Reload in a few minutes.")
      : b.status === "failed" ? notice("bad", "alert", `<b>This brief failed to generate.</b> ${esc(b.error || "")} Retry from GitHub Actions → Morning Brief → Run workflow.`) : "";
    const ins = b.insight && !broken ? `<div class="ed-thread"><span>Today's thread</span>${esc(b.insight.text)}</div>` : "";
    const arch = archived ? notice("", "archive", `<b>Archived issue</b> from ${esc(shortDate(b.date))}, shown as published. <a href="#today">Go to today's brief</a>`) : "";
    return `<div class="ed">${mast(esc(longDate(b.date)), meta, arch + status + ins)}`
      + (broken ? "" : `${lead ? `<section class="sec" id="sec-top" aria-label="Lead story">${storyHTML(lead, true)}</section>` : ""}
        ${storySection("core", b.sections.core, lead?.id)}${storySection("ai", b.sections.ai, lead?.id)}${storySection("industry", b.sections.industry, lead?.id)}${marketsHTML(b, lead?.id)}
        ${n ? "" : `<p class="none">No stories in this issue.</p>`}
        ${archived ? "" : `<section class="done" id="done"><span class="done-check" aria-hidden="true">${ic("check")}</span><h2>You're caught up.</h2><p>The next brief arrives on the next weekday at 5 AM.</p></section>`}
        <p class="ed-foot">${b.sourcesChecked ? `${b.sourcesChecked - (b.missing || []).length} of ${b.sourcesChecked} sources fetched` : ""}${b.missing?.length ? ` · <span class="warn">unavailable: ${esc(b.missing.map((x) => x.split(" (")[0]).join(", "))}</span>` : ""}</p>`)
      + `</div>`;
  }
  const AUTH_ERR = { expired: "That sign-in took too long. Try again.", failed: "GitHub didn't complete the sign-in. Try again.", denied: "That GitHub account doesn't have access to this brief." };
  const signIn = () => {
    const err = AUTH_ERR[new URLSearchParams(location.search).get("auth")];
    return `<section class="signin">
      <p class="caps">Private brief</p>
      <h1>Your morning, in five minutes.</h1>
      <p class="signin-sub">Databases, systems, AI infrastructure and markets, read, ranked and summarized before 6 AM each weekday.</p>
      ${err ? `<p class="signin-err" role="alert">${err}</p>` : ""}
      <a class="signin-btn" href="/auth/github"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>Sign in with GitHub</a>
      <p class="signin-alt">Have the morning email? Its link signs you in too. This browser stays signed in for a year.</p>
    </section>`;
  };
  const emptyBrief = (h, p) => `<div class="empty"><h2>${h}</h2><p>${p}</p></div>`;

  async function archivePage() {
    let list, q = S.archiveQ || "";
    if (S.mode === "demo") list = S.variant === "empty" ? [] : window.MB_DEMO.archive.filter((i) => !q || (i.lead || "").toLowerCase().includes(q.toLowerCase()));
    else { try { list = (await getJSON(`/api/archive${q ? `?q=${encodeURIComponent(q)}` : ""}`)).issues; } catch (e) { return notice("bad", "alert", `<b>Couldn't load the archive.</b> ${esc(e.message)}`); } }
    const body = !list.length
      ? q ? emptyBrief("No matches", `No past issue mentions “${esc(q)}”. Try a shorter term or a project name.`)
          : emptyBrief("No past issues yet", "Issues appear here after each weekday run. Every issue is kept exactly as it was published.")
      : list.map((i) => `<div class="issue">
          <div class="d">${esc(shortDate(i.date))}<small>Generated ${i.generatedAt ? esc(tTime(i.generatedAt)) + " PT" : "–"}</small></div>
          <div>${i.lead ? `<p class="lead"><a href="#brief-${esc(i.date)}">${i.snippet ? i.snippet : esc(i.lead)}</a></p>` : `<p class="lead"><a href="#brief-${esc(i.date)}">Issue for ${esc(shortDate(i.date))}</a></p>`}
          <p class="sub">${i.status === "failed" ? `<span class="st bad">Generation failed</span>${i.error ? `<span>${esc(i.error)}</span>` : ""}` : `<span class="st ok">Delivered</span>`}
            ${i.missing ? `<span class="st warn">${i.missing} ${i.missing === 1 ? "source" : "sources"} unavailable</span>` : i.status !== "failed" ? "<span>All sources fetched</span>" : ""}</p></div></div>`).join("");
    return `<header class="page-head"><h1>Archive</h1><p>Every past issue, kept as it was published. Search covers headlines, summaries and why-it-matters lines.</p></header>
      <form class="toolbar" id="archive-form" role="search"><label class="vh" for="archive-q">Search past issues</label>
        <input type="search" id="archive-q" value="${esc(q)}" placeholder="Search past issues, e.g. MVCC or io_uring"><button class="icon-btn" type="submit">${ic("search")}<span>Search</span></button></form>
      ${body}`;
  }

  async function savedPage() {
    let list;
    if (S.mode === "demo") {
      list = S.variant === "empty" ? [] : window.MB_DEMO.saved.map((s) => ({ ...s, ...(S.items[s.id] || {}) }));
      const extra = allStories(S.brief).filter((s) => S.items[s.id]?.saved && !list.some((x) => x.id === s.id)).map((s) => ({ ...s, briefDate: S.brief.date, ...S.items[s.id] }));
      list = [...extra, ...list].filter((s) => s.saved !== false);
    } else { try { list = (await getJSON("/api/saved")).items; } catch (e) { return notice("bad", "alert", `<b>Couldn't load saved items.</b> ${esc(e.message)}`); } }
    const f = S.savedFilter || { topic: "", source: "", showRead: true };
    const topics = [...new Set(list.map((s) => s.topic).filter(Boolean))].sort();
    const sources = [...new Set(list.map((s) => s.source))].sort();
    const shown = list.filter((s) => (!f.topic || s.topic === f.topic) && (!f.source || s.source === f.source) && (f.showRead || !s.read));
    const opt = (vals, cur) => vals.map((v) => `<option ${v === cur ? "selected" : ""}>${esc(v)}</option>`).join("");
    return `<header class="page-head"><h1>Saved for later</h1><p>Your reading list. Saved items also feed the weekend review once it's turned on.</p></header>
      ${list.length ? `<div class="toolbar" id="saved-filters">
        <label for="f-topic">Topic <select id="f-topic"><option value="">All</option>${opt(topics, f.topic)}</select></label>
        <label for="f-source">Source <select id="f-source"><option value="">All</option>${opt(sources, f.source)}</select></label>
        <label for="f-read"><input type="checkbox" id="f-read" ${f.showRead ? "checked" : ""}> Show read items</label></div>` : ""}
      ${!list.length ? emptyBrief("Nothing saved yet", "Use Save on any story in the brief to keep it here for later.")
        : !shown.length ? emptyBrief("No saved items match", "Change the filters above to see the rest of your list.")
        : shown.map((s) => `<div class="issue" data-saved="${esc(s.id)}">
          <div class="d">${esc(shortDate(s.briefDate))}<small>${s.read ? "Read" : "Unread"}</small></div>
          <div><p class="lead"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></p>
          <p class="sub">${s.topic ? `<span class="chip">${esc(s.topic)}</span>` : ""}<span>${esc(s.source)}</span>
            <button class="jump" data-act="read" data-id="${esc(s.id)}">${s.read ? "Mark unread" : "Mark read"}</button>
            <button class="jump" data-act="unsave" data-id="${esc(s.id)}">Remove</button></p></div></div>`).join("")}`;
  }

  function readOnlyNote() {
    return notice("", "info", `<b>These settings come from <code>src/config.ts</code>.</b> Edit that file and deploy to change them; changes apply to future briefs, not past issues. In-app editing isn't connected yet.`);
  }

  function watchlistPage() {
    const c = S.cfg, wl = c?.watchlist || [];
    const latest = Object.fromEntries((S.brief?.markets?.watchlist || []).map((w) => [w.ticker, w]));
    return `<header class="page-head"><h1>Watchlist</h1><p>Companies checked every morning for SEC filings and for news that names them. No prices.</p></header>
      <div style="margin-top:var(--s4)">${readOnlyNote()}</div>
      ${!wl.length ? emptyBrief("No watchlist configured", "Add companies to <code>watchlist</code> in <code>src/config.ts</code>. Until then the brief skips watchlist filings and news.")
        : `<div class="group"><h2>Tracked companies <span class="meta">${wl.length}</span></h2>
          ${wl.map((w) => { const x = latest[w.ticker]; const nf = x?.filings.length || 0, nm = x?.mentions.length || 0;
            return `<div class="srow"><div><b>${esc(w.ticker)}</b> <span class="h">${esc((w.names || []).join(", "))}</span></div>
            <div class="st">${!x ? "Not in the latest brief" : nf || nm ? `${nf} ${nf === 1 ? "filing" : "filings"}, ${nm} ${nm === 1 ? "story" : "stories"} in the latest brief` : "Quiet in the latest brief"}</div></div>`; }).join("")}
          <p class="applies">Stories match on the names listed next to each ticker.</p></div>`}`;
  }
  function sourcesPage() {
    const c = S.cfg;
    const missing = (S.brief?.missing || []).map((m) => m.split(" (")[0]);
    const groups = [
      ["Official announcements & releases", (s) => s.tier === 1 && s.kind !== "arxiv" && s.section !== "markets"],
      ["Markets: regulators & company newsrooms", (s) => s.section === "markets"],
      ["Research", (s) => s.kind === "arxiv"],
      ["Engineering blogs & established outlets", (s) => s.tier === 2 && s.section !== "markets"],
      ["Technical communities", (s) => s.tier === 3],
    ];
    const prio = { 1: "Highest priority (primary)", 2: "Standard priority", 3: "Lower priority (community)" };
    return `<header class="page-head"><h1>Sources &amp; topics</h1><p>Where stories come from and what the brief looks for. Primary sources outrank outlets, which outrank forums.</p></header>
      <div style="margin-top:var(--s4)">${readOnlyNote()}</div>
      ${groups.map(([name, fn]) => { const list = (c?.sources || []).filter(fn); return list.length ? `<div class="group"><h2>${esc(name)} <span class="meta">${list.length}</span></h2>
        ${list.map((s) => { const down = missing.includes(s.id); return `<div class="srow"><div>${esc(s.id)}<br><span class="h">${esc(s.url ? host(s.url) : s.kind === "hn" ? `news.ycombinator.com, ${s.minPoints}+ points` : (s.categories || []).join(", "))}${s.filter ? " · topic-filtered" : ""}</span></div>
          <div class="st ${down ? "bad" : ""}">${down ? "Unavailable in latest brief" : esc(prio[s.tier])}</div></div>`; }).join("")}</div>` : ""; }).join("")}
      <div class="group"><h2>Interest topics <span class="meta">${(c?.topics || []).length}</span></h2><div class="chips">${(c?.topics || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        <p class="applies">Community and broad sources only keep items that mention one of these.</p></div>
      <div class="group"><h2>Muted <span class="meta">${(c?.muted || []).length}</span></h2>${(c?.muted || []).length ? `<div class="chips">${c.muted.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>` : `<p class="applies">Nothing muted.</p>`}</div>`;
  }

  function settingsPage() {
    const c = S.cfg || {};
    const row = (k, sub, v, applies) => `<div class="setting"><div class="k">${k}${sub ? `<small>${sub}</small>` : ""}</div><div>${v}${applies ? `<p class="applies">${applies}</p>` : ""}</div></div>`;
    return `<header class="page-head"><h1>Settings</h1><p>How and when the brief is made and delivered.</p></header>
      <div style="margin-top:var(--s4)">${readOnlyNote()}</div>
      <div class="group">
        ${row("Delivery", "Where the brief arrives", `Web: always on<br>Email: ${c.delivery?.email ? `on, to ${esc(c.delivery.email)}` : "on"}<br>Slack: not connected`, "Applies from the next brief.")}
        ${row("Weekday time", "Monday to Friday", esc(c.delivery?.time || "6:00 AM PT"), "Failure alert is sent 20 minutes later if the brief hasn't gone out.")}
        ${row("Weekend digest", "Week in review and saved reads", "Off. Not built yet.", "")}
        ${row("Interests &amp; priorities", "", `${(c.topics || []).length} topics, ${(c.sources || []).length} sources. <a href="#sources">View sources &amp; topics</a>`, "Thumbs up and down adjust a source's weight in future briefs.")}
        ${row("Watchlist", "", `${(c.watchlist || []).map((w) => esc(w.ticker)).join(", ") || "None"}. <a href="#watchlist">View watchlist</a>`, "Filings and news that name these companies are reported. No prices.")}
        ${row("Muted topics", "", (c.muted || []).map(esc).join(", ") || "None", "Muted items are dropped before scoring.")}
        ${row("Appearance", "This browser only", `<button class="icon-btn" data-act="theme" style="border-color:var(--line-strong)">${ic("moon")}<span>Switch light / dark</span></button>`, "")}
      </div>`;
  }

  // ---------- chrome ----------
  const NAV = [["today", "Today", "today"], ["archive", "Archive", "archive"], ["saved", "Saved for later", "saved"], ["watchlist", "Watchlist", "watch"], ["sources", "Sources & topics", "sources"], ["settings", "Settings", "settings"]];

  function navHTML() {
    const b = S.brief, cur = S.route.startsWith("brief-") ? "archive" : S.route;
    const foot = S.mode === "demo" ? `<span><span class="dot demo"></span>Prototype data</span><span>Nothing is delivered from this preview</span>`
      : S.mode !== "live" ? "" : !b ? `<span><span class="dot"></span>No issue yet</span>`
      : b.status === "failed" ? `<span><span class="dot bad"></span>Today's brief failed</span>`
      : b.sentAt ? `<span><span class="dot ok"></span>Emailed ${esc(tTime(b.sentAt))} PT</span><span>Issue of ${esc(shortDate(b.date))}</span>`
      : `<span><span class="dot"></span>Built, not yet emailed</span>`;
    return `<a class="brand" href="#today"><span class="brand-mark">Morning <span>Brief</span></span></a>
      <button class="icon-btn nav-close" data-act="menu" aria-label="Close menu" style="position:absolute;right:var(--s4);top:calc(var(--s4) + env(safe-area-inset-top, 0px))" hidden>${ic("close")}</button>
      <ul>${NAV.map(([r, label, i]) => `<li><a class="nav-link" href="#${r}" ${cur === r ? 'aria-current="page"' : ""}>${ic(i)}${esc(label)}${r === "saved" ? `<span class="count num" id="nav-saved-count">${savedCount() || ""}</span>` : ""}</a></li>`).join("")}</ul>
      <div class="nav-foot">${foot}${S.mode === "live" ? `<form method="post" action="/auth/logout"><button class="jump">Sign out</button></form>` : ""}</div>`;
  }

  function railHTML() {
    const b = S.brief;
    if (!(S.route === "today" || S.route.startsWith("brief-")) || !b || b.status === "failed" || b.status === "running") return "";
    const secs = [["top", "Lead story", b.top.length ? 1 : null], ["core", "Core tech", b.sections.core?.length], ["ai", "AI &amp; infra", b.sections.ai?.length],
      ["industry", "Industry", b.sections.industry?.length], ["markets", "Markets", b.markets?.news?.length]];
    const total = b.sourcesChecked || 0, miss = b.missing?.length || 0, ok = Math.max(0, total - miss);
    return `<div><h2>In this brief</h2><ul class="toc">${secs.map(([id, l, c]) => `<li><a href="#" data-sec="${id}" class="${c == null ? "off" : ""}"><span>${l}</span><span class="n num">${c == null ? "–" : c}</span></a></li>`).join("")}</ul>
        <div class="progress" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="progress"></i></div></div>
      <div><h2>Saved</h2><a class="rail-saved" href="#saved">${ic("saved")}<span>${savedCount() ? count(savedCount(), "item", "items") : "Nothing saved yet"}</span></a></div>
      <div><h2>Coverage</h2>
        ${total ? `<div class="meter" role="img" aria-label="${ok} of ${total} sources fetched"><i style="flex:${ok}"></i>${miss ? `<i class="miss" style="flex:${miss}"></i>` : ""}</div>
        <p class="meter-l"><span class="num">${ok}</span> of <span class="num">${total}</span> sources fetched</p>` : `<p class="meter-l">Source count not recorded</p>`}
        ${miss ? `<p class="meter-miss">Missing: ${esc(b.missing.map((m) => m.split(" (")[0]).join(", "))}</p>` : ""}
        <p class="meter-l">Stories from ${esc(tDay(b.window.from))}, ${esc(tTime(b.window.from))} to ${esc(tDay(b.window.to))}, ${esc(tTime(b.window.to))} PT</p></div>
      <div><button class="icon-btn" data-act="help" style="margin-left:-8px">${ic("key")}<span>Keyboard shortcuts</span></button></div>`;
  }

  function demoBarHTML() {
    if (S.mode !== "demo") return "";
    const opts = [["normal", "Full issue"], ["sparse", "Short issue, missing sources, quiet watchlist"], ["failed", "Generation failed"], ["empty", "Empty (no issues, saves or watchlist)"], ["loading", "Loading"]];
    return `<div class="demo-bar" role="note"><span><b>Prototype</b><span class="db-t"> · fictional stories and filings, not connected to live sources</span></span>
      <label for="variant">Preview state <select id="variant">${opts.map(([v, l]) => `<option value="${v}" ${S.variant === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label></div>`;
  }

  let toolsHTML = "";
  const skeleton = () => `<div class="skel" aria-busy="true" aria-label="Loading the brief"><i class="h"></i><i style="width:55%"></i><i></i><i style="width:90%"></i><i class="h" style="margin-top:24px"></i><i></i><i style="width:80%"></i></div>`;

  // ---------- render ----------
  async function render() {
    const app = $("#app");
    if (!app) return;
    const themeIcon = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches) ? "sun" : "moon";
    if (!app.firstElementChild) {
      app.innerHTML = `<div class="shell">
        <div class="topbar"><button class="icon-btn" data-act="menu" aria-label="Open menu" aria-expanded="false">${ic("menu")}</button><a class="brand" href="#today"><span class="brand-mark">Morning <span>Brief</span></span></a><span class="spacer"></span>
          <a class="icon-btn" href="#archive" aria-label="Search past issues">${ic("search")}</a><button class="icon-btn" data-act="theme" aria-label="Switch light or dark theme" id="theme-top">${ic(themeIcon)}</button></div>
        <nav class="nav" id="nav" aria-label="Main"></nav>
        <main class="main" id="main" tabindex="-1"></main>
        <aside class="rail" id="rail" aria-label="About this brief"></aside></div>`;
    }
    app.firstElementChild.classList.toggle("locked", S.mode === "locked"); // signed out: nothing to navigate to
    $("#nav").innerHTML = navHTML();
    $("#theme-top").innerHTML = ic(themeIcon);
    const main = $("#main");
    toolsHTML = `<div class="mast-tools">
      <a class="icon-btn" href="#archive" aria-label="Search past issues">${ic("search")}</a>
      <button class="icon-btn" data-act="theme" aria-label="Switch light or dark theme">${ic(themeIcon)}</button>
      <button class="icon-btn" data-act="help" aria-label="Keyboard shortcuts">${ic("key")}</button></div>`;
    let html;
    if (S.mode === "loading" || (S.mode === "demo" && S.variant === "loading")) html = skeleton();
    else if (S.mode === "locked") html = signIn();
    else if (S.mode === "error") html = notice("bad", "alert", `<b>The brief couldn't load.</b> ${esc(S.error)}. Reload the page; if it persists, check the Worker logs.`);
    else if (S.route === "today" || S.route.startsWith("brief-")) html = todayPage();
    else if (S.route === "archive") html = await archivePage();
    else if (S.route === "saved") html = await savedPage();
    else if (S.route === "watchlist") html = watchlistPage();
    else if (S.route === "sources") html = sourcesPage();
    else if (S.route === "settings") html = settingsPage();
    else html = emptyBrief("Page not found", `<a href="#today">Go to today's brief</a>`);

    const isIssue = /<header class="mast/.test(html);
    main.innerHTML = `${demoBarHTML()}${isIssue ? "" : `<div class="page-tools">${toolsHTML}</div>`}${html}`;
    $("#rail").innerHTML = railHTML();
    document.title = S.brief && (S.route === "today" || S.route.startsWith("brief-")) ? `Morning Brief · ${shortDate(S.brief.date)}` : `Morning Brief · ${(NAV.find(([r]) => r === S.route) || [, "Archive"])[1]}`;
    onScroll();
  }

  // ---------- routing ----------
  async function route() {
    const h = location.hash.replace(/^#\/?/, "") || "today";
    const nav = $("#nav"); if (nav) nav.classList.remove("open");
    const prevViewing = S.viewing;
    S.route = h;
    S.viewing = h.startsWith("brief-") ? h.slice(6) : null;
    if (S.mode === "demo" && S.viewing) S.viewing = null; // the prototype has a single issue
    if (S.mode === "loading" || S.viewing !== prevViewing) await load();
    else await render();
    if (S.brief && !S.viewing) S.latestDate = S.brief.date;
    window.scrollTo(0, 0);
  }

  // ---------- interaction ----------
  function setTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("mb-theme", root.dataset.theme);
    render();
  }
  function jumpTo(id) {
    const el = document.getElementById(`s-${id}`) || document.getElementById(`sec-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    el.focus({ preventScroll: true });
  }
  function storyOf(el) { return el.closest("[data-id]")?.dataset.id || el.closest("[data-for]")?.dataset.for; }

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-act],[data-jump],[data-sec]");
    if (!t) return;
    if (t.dataset.jump) { e.preventDefault(); jumpTo(t.dataset.jump); return; }
    if (t.dataset.sec) { e.preventDefault(); jumpTo(t.dataset.sec); return; }
    const a = t.dataset.act, id = t.dataset.id || storyOf(t);
    if (a === "theme") return setTheme();
    if (a === "help") return showHelp();
    if (a === "menu") {
      const nav = $("#nav"), open = !nav.classList.contains("open");
      nav.classList.toggle("open", open);
      $$(".nav-close").forEach((b) => { b.hidden = !open; });
      $$('.topbar [data-act="menu"]').forEach((b) => b.setAttribute("aria-expanded", String(open)));
      if (open) $(".nav-link", nav)?.focus();
      return;
    }
    const cur = S.items[id] || {};
    if (a === "save") return act(id, { saved: !cur.saved }, cur.saved ? "Removed from saved" : "Saved for later");
    if (a === "up" || a === "down") {
      const v = a === "up" ? 1 : -1, next = cur.vote === v ? 0 : v;
      await act(id, { vote: next }, next === 0 ? "Feedback cleared" : next === 1 ? "Noted: more like this" : "Noted: less like this");
      const r = $(`[data-reasons="${CSS.escape(id)}"]`); if (r) r.hidden = next !== -1;
      return;
    }
    if (a === "reason") { $(`[data-reasons="${CSS.escape(id)}"]`).hidden = true; return act(id, { reason: t.dataset.reason }, `Reason recorded: ${t.dataset.reason}`); }
    if (a === "details") { const d = $(`[data-details="${CSS.escape(id)}"]`); d.hidden = !d.hidden; t.setAttribute("aria-expanded", String(!d.hidden)); return; }
    if (a === "read") { await act(id, { read: !(cur.read ?? t.textContent.includes("unread")) }, "Updated"); return render(); }
    if (a === "unsave") { await act(id, { saved: false }, "Removed from saved"); return render(); }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "variant") { S.variant = e.target.value; load(); }
    if (["f-topic", "f-source", "f-read"].includes(e.target.id)) {
      S.savedFilter = { topic: $("#f-topic").value, source: $("#f-source").value, showRead: $("#f-read").checked };
      render();
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "archive-form") return;
    e.preventDefault(); S.archiveQ = $("#archive-q").value.trim(); render().then(() => $("#archive-q")?.focus());
  });

  function showHelp() {
    if ($(".help")) return;
    const d = document.createElement("div");
    d.className = "help"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Keyboard shortcuts");
    d.innerHTML = `<div class="help-card"><h2>Keyboard shortcuts</h2><dl>
      <dt><kbd>j</kbd> <kbd>k</kbd></dt><dd>Next / previous story</dd>
      <dt><kbd>o</kbd></dt><dd>Open the focused story's source</dd>
      <dt><kbd>s</kbd></dt><dd>Save or unsave the focused story</dd>
      <dt><kbd>/</kbd></dt><dd>Search past issues</dd>
      <dt><kbd>t</kbd></dt><dd>Switch light / dark</dd>
      <dt><kbd>?</kbd></dt><dd>Show this list</dd>
      <dt><kbd>Esc</kbd></dt><dd>Close</dd></dl>
      <p style="margin-top:16px"><button class="icon-btn" style="border-color:var(--line-strong)" id="help-close">Close</button></p></div>`;
    const close = () => { d.remove(); };
    d.addEventListener("click", (e) => { if (e.target === d || e.target.id === "help-close") close(); });
    document.body.append(d); $("#help-close").focus();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $(".help")?.remove(); const nav = $("#nav"); if (nav?.classList.contains("open")) { nav.classList.remove("open"); $$(".nav-close").forEach((b) => { b.hidden = true; }); } return; }
    if (e.metaKey || e.ctrlKey || e.altKey || /input|select|textarea/i.test(e.target.tagName)) return;
    const stories = $$(".story, .deep");
    const curIdx = stories.findIndex((s) => s.contains(document.activeElement));
    if (e.key === "j" || e.key === "k") {
      if (!stories.length) return;
      const i = curIdx < 0 ? (e.key === "j" ? 0 : stories.length - 1) : Math.max(0, Math.min(stories.length - 1, curIdx + (e.key === "j" ? 1 : -1)));
      stories[i].focus({ preventScroll: true }); stories[i].scrollIntoView({ block: "center", behavior: "auto" });
    } else if (e.key === "o" && curIdx >= 0) {
      const a = $(".story-title a, .deep h3 a", stories[curIdx]); if (a) window.open(a.href, "_blank", "noopener");
    } else if (e.key === "s" && curIdx >= 0) {
      $('[data-act="save"]', stories[curIdx])?.click();
    } else if (e.key === "/") { e.preventDefault(); location.hash = "#archive"; setTimeout(() => $("#archive-q")?.focus(), 50); }
    else if (e.key === "t") setTheme();
    else if (e.key === "?") showHelp();
  });

  function onScroll() {
    const bar = $("#progress"); if (!bar) return;
    const done = $("#done"), max = done ? done.offsetTop - innerHeight + 160 : document.documentElement.scrollHeight - innerHeight;
    const pct = max > 0 ? Math.min(100, Math.round((scrollY / max) * 100)) : 100;
    bar.style.width = `${pct}%`; bar.parentElement.setAttribute("aria-valuenow", String(pct));
    let on = null;
    for (const s of $$("section.sec")) if (s.getBoundingClientRect().top < innerHeight * 0.35) on = s.id.slice(4);
    $$(".toc a").forEach((a) => { const hit = a.dataset.sec === on; a.classList.toggle("on", hit); if (hit) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("hashchange", route);

  const saved = store.get("mb-theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  route();
})();

// PROTOTYPE DATA. Fictional stories and illustrative numbers used only when the app
// cannot reach /api (local preview, or before the first brief exists). Never shown as live.
window.MB_DEMO = (() => {
  const at = (d, h, m = 0) => Date.parse(`2026-10-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-07:00`);
  const story = (o) => ({ also: [], unconfirmed: false, url: `https://example.com/sample/${o.id}`, ...o });

  const core = [
    story({ id: "c1", topic: "Transactions", title: "Postgres hackers converge on a plan for 64-bit transaction IDs", source: "pgsql-hackers", sourceType: "Primary source", tier: 1, published: at(11, 14, 20), also: ["LWN", "Hacker News"],
      summary: "A long-running patch series that widens XIDs to 64 bits now has agreement on the on-disk format, with the page-level epoch moved into the special space.",
      why: "Ends the XID-wraparound emergency vacuum class of incidents; the page-format trade-off mirrors choices you make in undo and ITL design." }),
    story({ id: "c2", topic: "Research", kind: "paper", title: "Deterministic concurrency control without a sequencer bottleneck", source: "arXiv cs.DB", sourceType: "Research paper", tier: 1, published: at(11, 9, 0),
      summary: "Proposes partitioned sequencing for deterministic databases, ordering transactions per partition and resolving cross-partition order with a lightweight epoch merge.",
      paper: { problem: "Deterministic engines like Calvin funnel every transaction through one global sequencer, which caps throughput.", idea: "Sequence locally per partition and merge orders at epoch boundaries, aborting only true cross-epoch conflicts.", practice: "Claims 3–4x throughput on TPC-C at 32 partitions; the abort rate under skew is the number to check before believing it." },
      why: "Directly comparable to lock-based and OCC designs you work with; the skewed-workload results are where these ideas usually fall apart." }),
    story({ id: "c3", topic: "Postmortem", title: "Postmortem: a replication lag spike that took down checkout for 41 minutes", source: "Example Payments engineering blog", sourceType: "Engineering blog", tier: 2, published: at(10, 16, 45),
      summary: "A schema migration stalled the read replicas long enough that checkout read stale data for 41 minutes.",
      incident: { trigger: "A migration added an index to a hot table during peak traffic.", failure: "Replicas applied the DDL single-threaded, lag passed the failover threshold, and reads were routed to a stale node.", lesson: "Gate DDL on replica lag and keep schema changes off the replication critical path." },
      why: "A clean case study of how DDL on the replication path interacts with read routing — the same failure mode exists in any log-shipping setup." }),
    story({ id: "c4", topic: "Kernels", title: "io_uring gains zero-copy receive for TCP in the next merge window", source: "LWN", sourceType: "Established outlet", tier: 2, published: at(11, 7, 30),
      summary: "The networking pull for the next kernel includes zero-copy receive into user-registered buffers, completing the send-and-receive pair for io_uring.",
      why: "Relevant to any database network layer; shaves copies on large result sets, but needs NIC header-split support to help." }),
    story({ id: "c5", topic: "Storage", title: "DuckDB 1.6 ships a new compression scheme for string dictionaries", source: "DuckDB releases", sourceType: "Primary source", tier: 1, published: at(9, 18, 5),
      summary: "The release adds FSST-backed dictionary compression and changes the storage format version, with automatic upgrade on first write.",
      release: { changed: "FSST-backed dictionary compression for strings, and a new storage format version.", consequence: "Databases upgrade on first write and older readers can't open them afterward, so pin versions before rolling out." },
      why: "A format-version bump with automatic upgrade is worth reading for how they handle downgrade safety." }),
  ];
  const ai = [
    story({ id: "a1", topic: "Inference", title: "Open-weight model release targets long-context retrieval on a single GPU", source: "Example Lab blog", sourceType: "Primary source", tier: 1, published: at(11, 10, 0),
      summary: "The lab released weights and a paged-attention kernel tuned for 1M-token contexts on one 80 GB accelerator.",
      why: "Long-context serving is a KV-cache storage problem; the paging scheme borrows directly from buffer-pool design." }),
    story({ id: "a2", topic: "AI for systems", title: "Learned cardinality estimation lands behind a flag in an open-source optimizer", source: "Hacker News", sourceType: "Community discussion", tier: 3, published: at(11, 19, 30),
      summary: "A query optimizer merged an optional learned estimator that falls back to histograms when its confidence is low.",
      why: "The fallback design is the interesting part: it bounds the damage of a bad model, which is why earlier learned optimizers stalled." }),
  ];
  const industry = [
    story({ id: "i1", topic: "Industry", title: "Cloud database vendor reportedly exploring a sale", source: "Example Wire", sourceType: "Established outlet", tier: 2, published: at(11, 17, 0), unconfirmed: true,
      summary: "One outlet, citing unnamed sources, reports early talks with two potential acquirers; neither company has commented.",
      why: "Consolidation among managed-database vendors shifts the competitive set for enterprise databases." }),
    story({ id: "i2", topic: "Policy", title: "California finalizes rules for automated decision systems in hiring", source: "Example State Agency", sourceType: "Primary source", tier: 1, published: at(10, 11, 0),
      summary: "Final regulations require notice and an audit trail when automated tools are used in employment decisions, effective next year.",
      why: "Affects internal HR tooling at Bay Area employers, including yours." }),
  ];

  const marketNews = [
    story({ id: "m1", topic: "Monetary policy", title: "Fed minutes show officials split on the pace of further cuts", source: "Federal Reserve", sourceType: "Primary source", tier: 1, published: at(9, 11, 0),
      summary: "Minutes from the September meeting show most officials favored one more cut this year, with several arguing to hold until services inflation cools.",
      why: "Rate expectations drive tech valuations and the cost of capital for the AI build-out you follow." }),
    story({ id: "m2", topic: "Regulation", title: "SEC adopts amendments to disclosure rules for cybersecurity incidents", source: "SEC press releases", sourceType: "Primary source", tier: 1, published: at(10, 13, 30),
      summary: "The amendments narrow when a company must file an 8-K for a cyber incident and add a delay for incidents under active law-enforcement review.",
      why: "Changes how and when outages and breaches at public tech companies, including your employer, become public." }),
  ];
  const markets = {
    news: marketNews,
    calendar: [
      { name: "Consumer Price Index", type: "macro", timing: null, why: "Inflation print; the main input to rate expectations." },
      { name: "Oracle Corporation (ORCL)", type: "earnings", timing: "After the close", why: null },
      { name: "Unemployment Insurance Weekly Claims", type: "macro", timing: null, why: "Weekly layoff signal." },
    ],
    watchlist: [
      { ticker: "ORCL", company: "Oracle", filings: [{ ticker: "ORCL", form: "4", date: "2026-10-09", url: "https://www.sec.gov/", explain: "Insider transaction report by an officer, director or 10% owner." }],
        mentions: [{ id: "i1", title: "Cloud database vendor reportedly exploring a sale", url: "https://example.com/sample/i1", source: "Example Wire", inBrief: true }] },
      { ticker: "MSFT", company: "Microsoft", filings: [{ ticker: "MSFT", form: "8-K", date: "2026-10-09", url: "https://www.sec.gov/", explain: "Current report of a material event; open the filing for the specific item." }], mentions: [] },
      { ticker: "NVDA", company: "Nvidia", filings: [],
        mentions: [{ id: "x9", title: "Nvidia details next-generation interconnect for rack-scale systems", url: "https://example.com/sample/x9", source: "NVIDIA newsroom", inBrief: false }] },
    ],
    explainer: {
      q: "What does an 8-K actually tell you?",
      a: "A company files an 8-K within four business days of a material event: an acquisition, an executive leaving, a change in auditors, a cybersecurity incident. The item number in the filing says which kind of event it is, so it's often faster to read than the press coverage.",
      ex: "Item 5.02 means a director or officer departed or was appointed; Item 1.05 means a material cybersecurity incident.",
    },
  };

  const brief = {
    demo: true, date: "2026-10-12", status: "sent", generatedAt: at(12, 6, 4), sentAt: at(12, 6, 5),
    window: { from: at(9, 6), to: at(12, 6) }, sourcesChecked: 18,
    missing: ["Lobsters (timed out after 10 s)"],
    top: [
      { id: "c1", section: "Core tech" }, { id: "c2", section: "Core tech" }, { id: "m1", section: "Markets" },
      { id: "i1", section: "Industry" }, { id: "c3", section: "Core tech" },
    ],
    // Grounded only in the sample stories above; refs are Top 5 ranks.
    insight: { text: "Two of today's top items are about keeping Postgres-style replication healthy under load: the 64-bit XID plan removes forced wraparound vacuums, and the checkout postmortem shows a schema change stalling replica apply.", refs: [1, 5] },
    sections: { core, ai, industry },
    deepRead: { id: "d1", title: "An Empirical Evaluation of In-Memory Multi-Version Concurrency Control", source: "VLDB (sample listing)", topic: "Transactions", minutes: 45, url: "https://example.com/sample/deep",
      why: "The clearest map of the MVCC design space: version storage, garbage collection, index management and concurrency protocol, measured against each other in one engine. Useful as a reference for the trade-offs behind any version-store change." },
    markets,
  };

  const archive = [
    { date: "2026-10-12", status: "sent", generatedAt: at(12, 6, 4), missing: 1, lead: core[0].title },
    { date: "2026-10-09", status: "sent", generatedAt: at(9, 6, 3), missing: 0, lead: "FoundationDB publishes simulation-testing results for its new storage engine" },
    { date: "2026-10-08", status: "failed", generatedAt: at(8, 6, 2), missing: 0, lead: null, error: "Model call failed after 3 retries; no brief was sent." },
    { date: "2026-10-07", status: "sent", generatedAt: at(7, 6, 6), missing: 3, lead: "TiDB 9.0 changes the default isolation level for pessimistic transactions" },
  ];

  const saved = [
    { ...core[1], briefDate: "2026-10-12", read: false },
    { ...story({ id: "s2", topic: "Distributed systems", title: "What we learned running Raft across three continents", source: "Example Cloud engineering blog", sourceType: "Engineering blog", tier: 2, published: at(7, 10, 0), summary: "", why: "" }), briefDate: "2026-10-07", read: true },
  ];

  // Mirrors src/config.ts so the settings screens have something real-shaped to show.
  const config = {
    delivery: { time: "6:00 AM PT", email: "you@example.com" },
    watchlist: [{ ticker: "ORCL", names: ["Oracle"] }, { ticker: "MSFT", names: ["Microsoft"] }, { ticker: "NVDA", names: ["Nvidia"] }],
    topics: ["database", "transaction", "mvcc", "replication", "consensus", "storage engine", "lsm", "kernel", "io_uring", "compiler", "postmortem", "inference", "gpu"],
    muted: ["crypto airdrop", "sponsored"],
    sources: [
      { id: "PostgreSQL", kind: "feed", url: "https://www.postgresql.org/news.rss", tier: 1 },
      { id: "DuckDB releases", kind: "feed", url: "https://github.com/duckdb/duckdb/releases.atom", tier: 1 },
      { id: "arXiv", kind: "arxiv", categories: ["cs.DB", "cs.DC", "cs.OS"], tier: 1, filter: true },
      { id: "LWN", kind: "feed", url: "https://lwn.net/headlines/rss", tier: 2, filter: true },
      { id: "Marc Brooker", kind: "feed", url: "https://brooker.co.za/blog/rss.xml", tier: 2 },
      { id: "Hacker News", kind: "hn", tier: 3, minPoints: 150, filter: true },
      { id: "Lobsters", kind: "feed", url: "https://lobste.rs/t/databases.rss", tier: 3 },
      { id: "Federal Reserve", kind: "feed", url: "https://www.federalreserve.gov/feeds/press_all.xml", tier: 1, section: "markets" },
      { id: "SEC press releases", kind: "feed", url: "https://www.sec.gov/news/pressreleases.rss", tier: 1, section: "markets" },
    ],
  };

  return { brief, archive, saved, config };
})();

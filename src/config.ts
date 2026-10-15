// Everything you tune lives here. Edit, then `npx wrangler deploy`.

// section: which part of the brief a source feeds (default "core").
export type Source =
  | { id: string; kind: "feed"; url: string; tier: 1 | 2 | 3; filter?: boolean; section?: "core" | "ai" | "industry" | "markets" }
  | { id: string; kind: "hn"; tier: 3; minPoints: number; filter: true }
  | { id: string; kind: "arxiv"; categories: string[]; tier: 1; max: number; filter: true };

export const config = {
  timezone: "America/Los_Angeles",
  runHourLocal: 6, // brief starts at 6:00 PT, check/alert at 6:20 PT
  deliveryLabel: "6:00 AM PT",

  // Workers AI model. Confirm it is still listed: `npx wrangler ai models list`
  llmModel: "@cf/meta/llama-3.1-8b-instruct-fast",
  maxLlmItems: 60, // keeps a run well inside the free 10k neurons/day
  minScore: 6, // 0-10; anything below is dropped even if a section ends up short
  caps: { top: 5, core: 8, ai: 5, industry: 4, markets: 4 },

  // Interest keywords. Sources with `filter: true` only keep items matching one.
  topics: [
    "database", "postgres", "postgresql", "mysql", "sqlite", "duckdb", "oracle", "cockroach",
    "tidb", "spanner", "foundationdb", "transaction", "mvcc", "isolation", "serializab",
    "concurrency control", "replication", "consensus", "raft", "paxos", "storage engine",
    "lsm", "b-tree", "btree", "wal", "query optimizer", "distributed system", "kernel",
    "linux", "io_uring", "ebpf", "filesystem", "compiler", "llvm", "rust", "postmortem",
    "outage", "incident", "gpu", "inference", "cuda",
    // markets: keeps company-newsroom and SEC feeds to what matters
    "earnings", "acquisition", "acquire", "guidance", "layoff", "cloud", "artificial intelligence", "data center",
    "semiconductor", "export control", "antitrust", "interest rate", "chief executive",
  ],
  muted: ["crypto airdrop", "sponsored"],

  sources: [
    { id: "Hacker News", kind: "hn", tier: 3, minPoints: 150, filter: true },
    { id: "Lobsters", kind: "feed", url: "https://lobste.rs/t/databases,distributed,linux,compilers,performance.rss", tier: 3 },
    { id: "arXiv", kind: "arxiv", categories: ["cs.DB", "cs.DC", "cs.OS"], tier: 1, max: 60, filter: true },
    { id: "LWN", kind: "feed", url: "https://lwn.net/headlines/rss", tier: 2, filter: true },
    { id: "PostgreSQL", kind: "feed", url: "https://www.postgresql.org/news.rss", tier: 1 },
    { id: "DuckDB releases", kind: "feed", url: "https://github.com/duckdb/duckdb/releases.atom", tier: 1 },
    { id: "CockroachDB releases", kind: "feed", url: "https://github.com/cockroachdb/cockroach/releases.atom", tier: 1 },
    { id: "TiDB releases", kind: "feed", url: "https://github.com/pingcap/tidb/releases.atom", tier: 1 },
    { id: "FoundationDB releases", kind: "feed", url: "https://github.com/apple/foundationdb/releases.atom", tier: 1 },
    { id: "Cloudflare blog", kind: "feed", url: "https://blog.cloudflare.com/rss/", tier: 2, filter: true },
    { id: "All Things Distributed", kind: "feed", url: "https://www.allthingsdistributed.com/atom.xml", tier: 2 },
    { id: "Marc Brooker", kind: "feed", url: "https://brooker.co.za/blog/rss.xml", tier: 2 },
    { id: "Murat Demirbas", kind: "feed", url: "https://muratbuffalo.blogspot.com/feeds/posts/default", tier: 2 },
    { id: "Phil Eaton", kind: "feed", url: "https://notes.eatonphil.com/rss.xml", tier: 2 },
    { id: "Brendan Gregg", kind: "feed", url: "https://www.brendangregg.com/blog/rss.xml", tier: 2 },

    // AI & infrastructure
    { id: "OpenAI news", kind: "feed", url: "https://openai.com/news/rss.xml", tier: 1, section: "ai" },
    { id: "vLLM releases", kind: "feed", url: "https://github.com/vllm-project/vllm/releases.atom", tier: 1, section: "ai" },
    { id: "Hugging Face blog", kind: "feed", url: "https://huggingface.co/blog/feed.xml", tier: 2, section: "ai" },

    // Industry & culture
    { id: "Pragmatic Engineer", kind: "feed", url: "https://newsletter.pragmaticengineer.com/feed", tier: 2, section: "industry" },
    { id: "Charity Majors", kind: "feed", url: "https://charity.wtf/feed/", tier: 2, section: "industry" },
    { id: "Ars Technica", kind: "feed", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", tier: 2, section: "industry" },
    { id: "The Register", kind: "feed", url: "https://www.theregister.com/headlines.atom", tier: 2, section: "industry", filter: true },

    // Markets: official releases and company newsrooms. News and facts only, no prices.
    { id: "Federal Reserve", kind: "feed", url: "https://www.federalreserve.gov/feeds/press_all.xml", tier: 1, section: "markets" },
    { id: "SEC press releases", kind: "feed", url: "https://www.sec.gov/news/pressreleases.rss", tier: 1, section: "markets", filter: true },
    { id: "BLS releases", kind: "feed", url: "https://www.bls.gov/feed/bls_latest.rss", tier: 1, section: "markets" },
    { id: "NVIDIA newsroom", kind: "feed", url: "https://nvidianews.nvidia.com/releases.xml", tier: 1, section: "markets" },
    { id: "Microsoft news", kind: "feed", url: "https://news.microsoft.com/feed/", tier: 1, section: "markets", filter: true },
  ] as Source[],

  // FRED release names (substring match) that count as market-moving macro.
  macroReleases: [
    "Consumer Price Index", "Employment Situation", "Personal Income and Outlays",
    "Producer Price Index", "Gross Domestic Product", "FOMC", "Retail",
    "Job Openings", "Unemployment Insurance Weekly Claims",
  ],
  watchlist: [
    { ticker: "ORCL", cik: 1341439, names: ["Oracle"] },
    { ticker: "MSFT", cik: 789019, names: ["Microsoft", "Azure"] },
    { ticker: "NVDA", cik: 1045810, names: ["Nvidia", "NVIDIA"] },
  ],
  // Earnings shown in "Today's calendar": watchlist plus these.
  earningsWatch: ["AAPL", "AMZN", "GOOGL", "META", "AMD", "AVGO", "TSM", "CRM", "SNOW", "MDB", "IBM", "SAP", "INTC"],
  filingForms: ["8-K", "4", "SC 13D", "SC 13G", "SCHEDULE 13D", "SCHEDULE 13G"],
};

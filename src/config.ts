// Everything you tune lives here. Edit, then `npx wrangler deploy`.

// section: which part of the brief a source feeds (default "core").
export type Source =
  | { id: string; kind: "feed"; url: string; tier: 1 | 2 | 3; filter?: boolean; section?: "core" | "ai" | "industry" | "markets" }
  | { id: string; kind: "hn"; tier: 3; minPoints: number; filter: true }
  | { id: string; kind: "arxiv"; categories: string[]; tier: 2; max: number; filter: true };

export const config = {
  timezone: "America/Los_Angeles",
  runHourLocal: 6, // brief starts at 6:00 PT, check/alert at 6:20 PT
  deliveryLabel: "6:00 AM PT",

  // Workers AI model. Confirm it is still listed: `npx wrangler ai models list`
  llmModel: "@cf/meta/llama-3.1-8b-instruct-fast",
  maxLlmItems: 240, // ~30 model calls; still well inside the free 10k neurons/day
  minScore: 6, // 0-10; anything below is dropped even if a section ends up short
  perSource: 4, // no one source fills a section
  papersMax: 2, // arXiv papers per issue, shown last in Core tech
  // Bare version announcements ("OpenBSD 8.0 released"): dropped before the model sees them.
  releaseNoise: /\b\d+(\.\d+)+\b.*\b(released|is out|now available)\b|^(release|version) v?\d/i,
  caps: { top: 5, core: 20, ai: 12, industry: 12, markets: 0 },

  // Interest keywords. Sources with `filter: true` only keep items matching one.
  topics: [
    "database", "postgres", "postgresql", "mysql", "sqlite", "duckdb", "oracle", "cockroach",
    "tidb", "spanner", "foundationdb", "transaction", "mvcc", "isolation", "serializab",
    "concurrency control", "replication", "consensus", "raft", "paxos", "storage engine",
    "lsm", "b-tree", "btree", "wal", "query optimizer", "distributed system", "kernel",
    "linux", "io_uring", "ebpf", "filesystem", "compiler", "llvm", "rust", "postmortem",
    "outage", "incident", "gpu", "inference", "cuda",
    // engineering at scale
    "scale", "scaling", "latency", "throughput", "shard", "partition", "cache", "caching", "kafka", "queue",
    "stream", "index", "reliability", "availability", "durability", "migration", "infrastructure", "architecture",
    "performance", "observability", "storage", "data platform", "data center", "distributed", "load balanc",
    // AI and the companies building it
    "openai", "anthropic", "claude", "chatgpt", "gemini", "llama", "mistral", "deepmind", "llm", "language model",
    "agent", "startup", "nvidia", "microsoft", "google", "amazon", "apple",
  ],
  muted: ["crypto airdrop", "sponsored", "scheduled maintenance", "maintenance window"],

  sources: [
    { id: "Hacker News", kind: "hn", tier: 3, minPoints: 150, filter: true },
    { id: "Lobsters", kind: "feed", url: "https://lobste.rs/t/databases,distributed,linux,compilers,performance.rss", tier: 3 },
    { id: "arXiv", kind: "arxiv", categories: ["cs.DB", "cs.DC", "cs.OS"], tier: 2, max: 30, filter: true },
    { id: "LWN", kind: "feed", url: "https://lwn.net/headlines/rss", tier: 2, filter: true },
    { id: "PostgreSQL", kind: "feed", url: "https://www.postgresql.org/news.rss", tier: 1 },

    // Engineering at scale: companies writing about the systems they run
    { id: "Netflix Tech Blog", kind: "feed", url: "https://netflixtechblog.com/feed", tier: 1 },
    { id: "Meta Engineering", kind: "feed", url: "https://engineering.fb.com/feed/", tier: 1 },
    { id: "Dropbox Tech", kind: "feed", url: "https://dropbox.tech/feed", tier: 1 },
    { id: "Stripe", kind: "feed", url: "https://stripe.com/blog/feed.rss", tier: 1, filter: true },
    { id: "Slack Engineering", kind: "feed", url: "https://slack.engineering/feed/", tier: 1 },
    { id: "Pinterest Engineering", kind: "feed", url: "https://medium.com/feed/pinterest-engineering", tier: 1 },
    { id: "Airbnb Engineering", kind: "feed", url: "https://medium.com/feed/airbnb-engineering", tier: 1 },
    { id: "GitHub Engineering", kind: "feed", url: "https://github.blog/engineering/feed/", tier: 1 },
    { id: "Discord", kind: "feed", url: "https://discord.com/blog/rss.xml", tier: 1, filter: true },
    { id: "Shopify Engineering", kind: "feed", url: "https://shopify.engineering/blog.atom", tier: 1, filter: true },
    { id: "Spotify Engineering", kind: "feed", url: "https://engineering.atspotify.com/feed/", tier: 1 },
    { id: "Figma", kind: "feed", url: "https://www.figma.com/blog/feed/atom.xml", tier: 1, filter: true },
    { id: "Databricks", kind: "feed", url: "https://www.databricks.com/feed", tier: 2, filter: true },
    { id: "AWS Database Blog", kind: "feed", url: "https://aws.amazon.com/blogs/database/feed/", tier: 2, filter: true },
    { id: "AWS Architecture Blog", kind: "feed", url: "https://aws.amazon.com/blogs/architecture/feed/", tier: 2, filter: true },
    { id: "Cloudflare blog", kind: "feed", url: "https://blog.cloudflare.com/rss/", tier: 2, filter: true },
    { id: "PlanetScale", kind: "feed", url: "https://planetscale.com/blog/feed.atom", tier: 2, filter: true },
    { id: "Neon", kind: "feed", url: "https://neon.com/blog/rss.xml", tier: 2, filter: true },
    { id: "TigerBeetle", kind: "feed", url: "https://tigerbeetle.com/blog/atom.xml", tier: 1 },
    { id: "InfoQ Architecture", kind: "feed", url: "https://www.infoq.com/feed/?topic=architecture-design", tier: 2, filter: true },

    // People who write deeply about databases and distributed systems
    { id: "All Things Distributed", kind: "feed", url: "https://www.allthingsdistributed.com/atom.xml", tier: 2 },
    { id: "Marc Brooker", kind: "feed", url: "https://brooker.co.za/blog/rss.xml", tier: 2 },
    { id: "Murat Demirbas", kind: "feed", url: "https://muratbuffalo.blogspot.com/feeds/posts/default", tier: 2 },
    { id: "Aleksey Charapko", kind: "feed", url: "http://charap.co/feed/", tier: 2 },
    { id: "Jack Vanlightly", kind: "feed", url: "https://jack-vanlightly.com/blog?format=rss", tier: 2 },
    { id: "Phil Eaton", kind: "feed", url: "https://notes.eatonphil.com/rss.xml", tier: 2 },
    { id: "Justin Jaffray", kind: "feed", url: "https://buttondown.com/jaffray/rss", tier: 2 },
    { id: "Transactional", kind: "feed", url: "https://transactional.blog/feed.xml", tier: 2 },
    { id: "Jamie Brandon", kind: "feed", url: "https://www.scattered-thoughts.net/rss.xml", tier: 2 },
    { id: "Kyle Kingsbury", kind: "feed", url: "https://aphyr.com/posts.atom", tier: 2 },
    { id: "Dan Luu", kind: "feed", url: "https://danluu.com/atom.xml", tier: 2 },
    { id: "Brendan Gregg", kind: "feed", url: "https://www.brendangregg.com/blog/rss.xml", tier: 2 },

    // AI: labs, models and the people tracking them
    { id: "OpenAI news", kind: "feed", url: "https://openai.com/news/rss.xml", tier: 1, section: "ai" },
    { id: "Google AI blog", kind: "feed", url: "https://blog.google/technology/ai/rss/", tier: 1, section: "ai" },
    { id: "Hugging Face blog", kind: "feed", url: "https://huggingface.co/blog/feed.xml", tier: 2, section: "ai", filter: true },
    { id: "Simon Willison", kind: "feed", url: "https://simonwillison.net/atom/everything/", tier: 2, section: "ai" },
    { id: "Latent Space", kind: "feed", url: "https://www.latent.space/feed", tier: 2, section: "ai" },
    { id: "Interconnects", kind: "feed", url: "https://www.interconnects.ai/feed", tier: 2, section: "ai" },
    { id: "TechCrunch AI", kind: "feed", url: "https://techcrunch.com/category/artificial-intelligence/feed/", tier: 2, section: "ai" },
    { id: "The Verge AI", kind: "feed", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", tier: 2, section: "ai" },
    { id: "MIT Technology Review AI", kind: "feed", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", tier: 2, section: "ai" },

    // Industry & startups: what the giants and new companies are doing
    { id: "Techmeme", kind: "feed", url: "https://www.techmeme.com/feed.xml", tier: 2, section: "industry" },
    { id: "TechCrunch Startups", kind: "feed", url: "https://techcrunch.com/category/startups/feed/", tier: 2, section: "industry" },
    { id: "The Information", kind: "feed", url: "https://www.theinformation.com/feed", tier: 2, section: "industry" },
    { id: "Stratechery", kind: "feed", url: "https://stratechery.com/feed/", tier: 2, section: "industry" },
    { id: "Platformer", kind: "feed", url: "https://www.platformer.news/rss/", tier: 2, section: "industry" },
    { id: "Pragmatic Engineer", kind: "feed", url: "https://newsletter.pragmaticengineer.com/feed", tier: 2, section: "industry" },
    { id: "Ars Technica", kind: "feed", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", tier: 2, section: "industry" },
    { id: "The Register", kind: "feed", url: "https://www.theregister.com/headlines.atom", tier: 2, section: "industry", filter: true },
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

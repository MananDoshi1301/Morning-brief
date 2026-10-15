import { XMLParser } from "fast-xml-parser";
import type { Source } from "./config.ts";
import { canonical, hash, strip, type Item } from "./util.ts";

const UA = "MorningBrief/0.1 (personal digest)";
// Feeds full of &amp; etc. trip the default 1000-expansion cap; the length cap still guards against entity bombs.
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: { maxTotalExpansions: 1e6, maxExpandedLength: 1e7 } });
const arr = <T>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const txt = (x: any): string => (typeof x === "object" && x ? (x["#text"] ?? "") : String(x ?? ""));

/** Parse RSS 2.0 or Atom into Items. */
export function parseFeed(body: string, src: { id: string; tier: number }): Item[] {
  const doc = xml.parse(body);
  const rss = arr(doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item);
  const atom = arr(doc?.feed?.entry);
  const raw = rss.length
    ? rss.map((e: any) => ({
        title: txt(e.title), link: txt(e.link) || txt(e.guid),
        date: e.pubDate ?? e["dc:date"], text: txt(e.description),
      }))
    : atom.map((e: any) => {
        const links = arr(e.link);
        const alt = links.find((l: any) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
        return {
          title: txt(e.title), link: alt?.["@_href"] ?? "",
          date: e.published ?? e.updated, text: txt(e.summary) || txt(e.content),
        };
      });
  return raw
    .filter((r) => r.title && r.link)
    .map((r) => {
      const url = canonical(String(r.link).trim());
      return {
        id: hash(url), url, title: strip(r.title), source: src.id, tier: src.tier,
        published: Date.parse(r.date) || 0, text: strip(r.text).slice(0, 500), also: [],
      };
    });
}

async function get(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

export async function fetchSource(s: Source, since: number): Promise<Item[]> {
  if (s.kind === "hn") {
    const q = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=200` +
      `&numericFilters=created_at_i>${Math.floor(since / 1000)},points>${s.minPoints}`;
    const { hits } = (await (await get(q)).json()) as { hits: any[] };
    return hits.map((h) => {
      const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
      const url = canonical(h.url || discussion);
      return {
        id: hash(url), url, title: h.title, source: s.id, tier: s.tier,
        published: h.created_at_i * 1000, text: `${h.points} points, ${h.num_comments} comments. ${discussion}`,
        also: [],
      };
    });
  }
  const url = s.kind === "arxiv"
    ? `https://export.arxiv.org/api/query?search_query=${s.categories.map((c) => `cat:${c}`).join("+OR+")}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=${s.max}`
    : s.url;
  return parseFeed(await (await get(url)).text(), s).filter((i) => i.published >= since);
}

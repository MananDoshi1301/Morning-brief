// Builds one self-contained prototype page (demo data inlined) for sharing a preview.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const r = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8");
const out = process.argv[2] ?? "dist/preview.html";
mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
writeFileSync(out, `<meta charset="utf-8">
<title>Morning Brief</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap">
<style>${r("app.css")}</style>
<div id="app"></div>
<script>${r("demo.js")}</script>
<script>${r("app.js")}</script>
`);
console.log(`wrote ${out}`);

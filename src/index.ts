import { EmailMessage } from "cloudflare:email";
import { config } from "./config.ts";
import { api } from "./api.ts";
import { buildBrief, type PipelineEnv } from "./pipeline.ts";
import { esc, local } from "./util.ts";

export interface Env extends PipelineEnv {
  EMAIL?: SendEmail; // unset = no email; read the brief in the app
  EMAIL_FROM: string;
  EMAIL_TO: string;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string; GITHUB_USER?: string; // unset = GitHub sign-in off
}

function b64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{76}/g, "$&\r\n");
}

const mailer = (env: Env) => env.EMAIL && ((subject: string, html: string) => sendEmail(env, subject, html));

async function sendEmail(env: Env, subject: string, html: string) {
  if (!env.EMAIL) return;
  const raw = [
    `From: Morning Brief <${env.EMAIL_FROM}>`, `To: ${env.EMAIL_TO}`, `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@${env.EMAIL_FROM.split("@")[1]}>`,
    `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, `Content-Transfer-Encoding: base64`,
    ``, b64(html),
  ].join("\r\n");
  await env.EMAIL.send(new EmailMessage(env.EMAIL_FROM, env.EMAIL_TO, raw));
}

async function checkSent(env: Env, now = Date.now()) {
  const date = local(now).date;
  const row = await env.DB.prepare(`SELECT status, error FROM briefs WHERE date=?`).bind(date).first<{ status: string; error: string }>();
  if (row?.status === "sent") return;
  await sendEmail(env, `⚠ Morning Brief did not go out (${date})`,
    `<p>Status: ${esc(row?.status ?? "never started")}</p><pre>${esc(row?.error ?? "")}</pre>` +
    `<p>Retry: POST ${esc(env.BASE_URL)}/run?k=…</p>`);
}

export default {
  async scheduled(c: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Crons are UTC; both DST offsets are registered and only the one landing at 6 AM PT acts.
    const { hour } = local(c.scheduledTime);
    if (hour !== config.runHourLocal) return;
    const minute = new Date(c.scheduledTime).getUTCMinutes();
    ctx.waitUntil(minute === 0 ? buildBrief(env, c.scheduledTime, false, mailer(env)).then(() => {}) : checkSent(env, c.scheduledTime));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const isPrivate = url.pathname.startsWith("/api/") || url.pathname === "/run" || url.pathname === "/fb";
    if (url.pathname.startsWith("/auth/")) return githubAuth(url, req, env);
    if (!isPrivate) return env.ASSETS.fetch(req); // the app shell has no data in it
    // The key arrives once in an email link (?k=) and is then kept in a cookie.
    const cookieKey = /(?:^|;\s*)mb=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
    const given = url.searchParams.get("k") ?? (cookieKey && decodeURIComponent(cookieKey));
    if (!env.ACCESS_KEY || given !== env.ACCESS_KEY) return Response.json({ error: "forbidden" }, { status: 403 });
    const res = await route(url, req, env);
    if (url.searchParams.has("k")) res.headers.append("set-cookie", sessionCookie(env));
    return res;
  },
};

const sessionCookie = (env: Env) => `mb=${encodeURIComponent(env.ACCESS_KEY)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;

/** GitHub OAuth: a sign-in by GITHUB_USER gets the same session cookie as the email link. */
async function githubAuth(url: URL, req: Request, env: Env): Promise<Response> {
  if (url.pathname === "/auth/logout" && req.method === "POST")
    return new Response(null, { status: 303, headers: { location: `${url.origin}/`, "set-cookie": "mb=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" } });
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_USER || !env.ACCESS_KEY) return new Response("GitHub sign-in not configured", { status: 404 });
  const redirect = `${url.origin}/auth/callback`;
  if (url.pathname === "/auth/github") {
    const state = crypto.randomUUID();
    const to = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}&scope=`;
    return new Response(null, { status: 302, headers: { location: to, "set-cookie": `mbs=${state}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
  }
  if (url.pathname !== "/auth/callback") return new Response("Not found", { status: 404 });
  const state = /(?:^|;\s*)mbs=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  const code = url.searchParams.get("code");
  const back = (why: string) => new Response(null, { status: 302, headers: { location: `${url.origin}/?auth=${why}` } });
  if (!code || !state || url.searchParams.get("state") !== state) return back("expired");
  const tok: any = await (await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirect }),
  })).json();
  if (!tok.access_token) return back("failed");
  const user: any = await (await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tok.access_token}`, "user-agent": "morning-brief" },
  })).json();
  if (String(user.login ?? "").toLowerCase() !== env.GITHUB_USER.toLowerCase()) return back("denied");
  const h = new Headers({ location: `${url.origin}/#today` });
  h.append("set-cookie", sessionCookie(env));
  h.append("set-cookie", "mbs=; Path=/auth; Max-Age=0");
  return new Response(null, { status: 302, headers: h });
}

async function route(url: URL, req: Request, env: Env): Promise<Response> {
  if (url.pathname === "/run" && req.method === "POST") return Response.json(await buildBrief(env, Date.now(), true, mailer(env)));

  // Email feedback links (no JS in email): record, then open the app on that issue.
  if (url.pathname === "/fb") {
    const id = url.searchParams.get("id") ?? "", v = url.searchParams.get("v");
    const patch = v === "save" ? { saved: true } : v === "up" ? { vote: 1 } : v === "down" ? { vote: -1 } : null;
    if (!patch) return new Response("Bad vote", { status: 400 });
    const r = await api(new Request(`${url.origin}/api/items/${id}`, { method: "POST", body: JSON.stringify(patch) }), env);
    if (!r.ok) return r;
    return new Response(null, { status: 302, headers: { location: `${url.origin}/#today` } });
  }
  return api(req, env);
}

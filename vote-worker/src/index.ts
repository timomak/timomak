export interface Env {
  VOTES: KVNamespace;
}

const CANDIDATES: { id: string; label: string }[] = [
  { id: "patent-lawyer-agent", label: "Agentic Patent Lawyer" },
  { id: "cc-account-manager", label: "Claude Code CLI Multi-Account Manager" },
  { id: "programming-video-gen", label: "Automated Programming Video Generator" },
  { id: "fitness-compete", label: "Competitive Fitness (HealthKit)" },
];

const REDIRECT_TO = "https://github.com/timomak";
const IP_SALT = "timomak-votes-v1";

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + ":" + IP_SALT);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/vote") {
      const id = url.searchParams.get("id");
      if (!id || !CANDIDATES.find((c) => c.id === id)) {
        return new Response("unknown candidate", { status: 400 });
      }
      const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
      const ipHash = await hashIp(ip);
      const rlKey = `rl:${ipHash}:${id}`;
      const already = await env.VOTES.get(rlKey);
      if (!already) {
        await env.VOTES.put(rlKey, "1", { expirationTtl: 86400 });
        const current = parseInt(
          (await env.VOTES.get(`count:${id}`)) ?? "0",
          10
        );
        await env.VOTES.put(`count:${id}`, String(current + 1));
      }
      return Response.redirect(REDIRECT_TO, 302);
    }

    if (url.pathname === "/chart.svg") {
      const rows = await Promise.all(
        CANDIDATES.map(async (c) => ({
          ...c,
          n: parseInt((await env.VOTES.get(`count:${c.id}`)) ?? "0", 10),
        }))
      );
      return new Response(renderChart(rows), {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "max-age=300, s-maxage=300",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
};

function renderChart(
  rows: { id: string; label: string; n: number }[]
): string {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0);
  const barMaxW = 420;
  const rowH = 56;
  const padX = 24;
  const padY = 32;
  const width = padX * 2 + barMaxW + 110;
  const height = padY * 2 + rowH * rows.length;

  const bars = rows
    .map((r, i) => {
      const y = padY + i * rowH;
      const w = (r.n / max) * barMaxW;
      const pct = total ? ((r.n / total) * 100).toFixed(0) : "0";
      return `
      <g transform="translate(${padX}, ${y})">
        <text x="0" y="16" fill="#e6edf3" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto" font-size="14" font-weight="600">${escapeXml(
          r.label
        )}</text>
        <rect x="0" y="28" width="${barMaxW}" height="14" rx="7" fill="#21262d"/>
        <rect x="0" y="28" width="${w.toFixed(
          2
        )}" height="14" rx="7" fill="url(#grad)"/>
        <text x="${
          barMaxW + 12
        }" y="40" fill="#8b949e" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto" font-size="13">${r.n} · ${pct}%</text>
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="grad" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#00C9FF"/>
      <stop offset="100%" stop-color="#00FF94"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0d1117" rx="12"/>
  ${bars}
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    }[c]!)
  );
}

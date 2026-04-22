export interface Env {
  VOTES: KVNamespace;
}

const CANDIDATES: { id: string; label: string }[] = [
  { id: "patent-lawyer-agent", label: "Agentic Patent Lawyer" },
  { id: "cc-account-manager", label: "Claude Code CLI Multi-Account Manager" },
  { id: "programming-video-gen", label: "Automated Programming Video Generator" },
  { id: "fitness-compete", label: "Competitive Fitness (HealthKit)" },
];

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/vote") {
      const id = url.searchParams.get("id");
      if (!id || !CANDIDATES.find((c) => c.id === id)) {
        return new Response("unknown candidate", { status: 400 });
      }
      const current = parseInt(
        (await env.VOTES.get(`count:${id}`)) ?? "0",
        10
      );
      await env.VOTES.put(`count:${id}`, String(current + 1));
      return Response.redirect(`${url.origin}/thanks?id=${encodeURIComponent(id)}`, 302);
    }

    if (url.pathname === "/thanks") {
      const id = url.searchParams.get("id");
      const c = CANDIDATES.find((c) => c.id === id);
      if (!c) return new Response("unknown candidate", { status: 400 });
      return new Response(renderThanks(c.label), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
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

function renderThanks(label: string): string {
  const ts = Date.now();
  const safeLabel = escapeXml(label);
  const shareText = encodeURIComponent(
    `I voted for "${label}" to be @timostarr's next project 🗳️ https://github.com/timomak`
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thanks for voting — ${safeLabel}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background: radial-gradient(ellipse at top, #0f1820 0%, #0d1117 60%);
    color: #e6edf3;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px 16px;
  }
  .card { max-width: 640px; width: 100%; text-align: center; }
  h1 { font-size: 28px; line-height: 1.25; margin: 0 0 12px; font-weight: 700; }
  .gradient {
    background: linear-gradient(90deg, #00C9FF, #00FF94);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  p.sub { color: #8b949e; margin: 0 0 28px; font-size: 14px; }
  img.chart { width: 100%; max-width: 578px; height: auto; border-radius: 12px; margin-bottom: 28px; display: block; margin-inline: auto; }
  .actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  a.btn { display: inline-block; padding: 11px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 14px; transition: transform .08s ease; }
  a.btn:active { transform: translateY(1px); }
  a.primary { background: linear-gradient(90deg, #00C9FF, #00FF94); color: #0d1117; }
  a.secondary { background: #21262d; color: #e6edf3; border: 1px solid #30363d; }
  a.secondary:hover { background: #30363d; }
</style>
</head>
<body>
  <main class="card">
    <h1>Thanks — you voted for<br><span class="gradient">${safeLabel}</span></h1>
    <p class="sub">Live tally below. Heads up: the chart on Tim's GitHub profile takes a few minutes to refresh.</p>
    <img class="chart" src="/chart.svg?v=${ts}" alt="current votes">
    <div class="actions">
      <a class="btn primary" href="https://github.com/timomak">← Back to profile</a>
      <a class="btn secondary" href="https://x.com/intent/tweet?text=${shareText}" target="_blank" rel="noopener">Share on X</a>
    </div>
  </main>
</body>
</html>`;
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

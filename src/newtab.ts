// New Tab page rendered as a self-contained data: URL.
// Loaded by webview when user opens a new tab without a specific preset.

const NEW_TAB_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>New Tab — AI Multiplexer</title>
<style>
  :root {
    --bg: #fbfaf6;
    --surface: #ffffff;
    --surface-2: #f5f2ea;
    --border: #e7e1cf;
    --text: #1a1408;
    --text-secondary: #5e5742;
    --accent: #d4a017;
    --shadow: 0 4px 12px rgba(60, 40, 0, 0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0e0c08;
      --surface: #16130c;
      --surface-2: #1d1a11;
      --border: #2e2918;
      --text: #f7efd9;
      --text-secondary: #b8a87c;
      --accent: #e8b339;
      --shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; width: 100%; }
  body {
    display: grid;
    place-items: center;
    padding: 32px;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .stage {
    display: grid;
    gap: 28px;
    width: 100%;
    max-width: 760px;
    text-align: center;
    align-self: center;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin: 0 auto;
  }
  .brand svg.logo {
    width: 48px;
    height: 48px;
    display: block;
    filter: drop-shadow(0 4px 12px rgba(184, 134, 11, 0.25));
  }
  .brand .wordmark {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1;
  }
  .brand .wordmark .ai {
    background: linear-gradient(135deg, #f5d06f 0%, #d4a017 55%, #a47411 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 800;
  }
  .brand .wordmark .name {
    font-weight: 600;
    margin-left: 6px;
  }
  .tagline {
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    margin: -12px 0 0;
    letter-spacing: -0.005em;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  .card {
    display: grid;
    grid-template-rows: auto auto;
    align-items: center;
    justify-items: center;
    gap: 8px;
    padding: 18px 12px 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
  }
  .card:hover {
    border-color: var(--accent);
    background: var(--surface-2);
    transform: translateY(-2px);
  }
  .card .logo-wrap {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .card .logo-wrap img {
    width: 26px;
    height: 26px;
    display: block;
    object-fit: contain;
  }
  .card .name {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .card .url {
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
  }
  .footer {
    margin-top: 20px;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
</style>
</head>
<body>
  <main class="stage">
    <div class="brand">
      <svg class="logo" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f5d06f"/>
            <stop offset="55%" stop-color="#d4a017"/>
            <stop offset="100%" stop-color="#a47411"/>
          </linearGradient>
          <linearGradient id="sh" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>
            <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#lg)"/>
        <rect width="24" height="24" rx="6" fill="url(#sh)"/>
        <rect x="5" y="5" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.85"/>
        <rect x="13" y="5" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.35"/>
        <rect x="5" y="13" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.35"/>
        <rect x="13" y="13" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.85"/>
      </svg>
      <span class="wordmark">
        <span class="ai">AI</span><span class="name">Multiplexer</span>
      </span>
    </div>
    <p class="tagline">Mở nhanh một dịch vụ AI</p>
    <nav class="grid" aria-label="Quick links">
      <a class="card" href="https://chatgpt.com">
        <span class="logo-wrap"><img src="https://www.google.com/s2/favicons?domain=chatgpt.com&sz=64" alt="" referrerpolicy="no-referrer"/></span>
        <span><span class="name">ChatGPT</span></span>
      </a>
      <a class="card" href="https://claude.ai">
        <span class="logo-wrap"><img src="https://www.google.com/s2/favicons?domain=claude.ai&sz=64" alt="" referrerpolicy="no-referrer"/></span>
        <span><span class="name">Claude</span></span>
      </a>
      <a class="card" href="https://gemini.google.com">
        <span class="logo-wrap"><img src="https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64" alt="" referrerpolicy="no-referrer"/></span>
        <span><span class="name">Gemini</span></span>
      </a>
      <a class="card" href="https://chat.deepseek.com">
        <span class="logo-wrap"><img src="https://www.google.com/s2/favicons?domain=chat.deepseek.com&sz=64" alt="" referrerpolicy="no-referrer"/></span>
        <span><span class="name">DeepSeek</span></span>
      </a>
      <a class="card" href="https://www.perplexity.ai">
        <span class="logo-wrap"><img src="https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64" alt="" referrerpolicy="no-referrer"/></span>
        <span><span class="name">Perplexity</span></span>
      </a>
      <a class="card" href="https://search.brave.com/">
        <span class="logo-wrap"><img src="https://www.google.com/s2/favicons?domain=search.brave.com&sz=64" alt="" referrerpolicy="no-referrer"/></span>
        <span><span class="name">Brave Search</span></span>
      </a>
    </nav>
    <p class="footer">Nhập địa chỉ tùy ý vào ô URL phía trên</p>
  </main>
</body>
</html>`;

export const NEW_TAB_TITLE = "New Tab";

export function getNewTabUrl(): string {
  // Encode as data URL. encodeURIComponent keeps the document safe across webviews.
  return `data:text/html;charset=utf-8,${encodeURIComponent(NEW_TAB_HTML)}`;
}

export function isNewTabUrl(url: string): boolean {
  return url.startsWith("data:text/html") && url.includes("AI%20Multiplexer");
}

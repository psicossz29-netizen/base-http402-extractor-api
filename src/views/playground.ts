import { CONFIG } from '../config.js';

export function renderPlaygroundHtml(): string {
  const recipient = CONFIG.AGENT_PUBLIC_ADDRESS;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=ethereum:${recipient}@8453`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Base L2 HTTP 402 Markdown Extractor | Playground & Credits</title>
  <meta name="description" content="Autonomous web-to-markdown extraction API monetized via HTTP 402 and bulk deposits on Base L2.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #131b2e;
      --card-border: #1e293b;
      --primary: #0052ff;
      --primary-hover: #1e69ff;
      --accent: #10b981;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --code-bg: #070a12;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
      padding: 24px 16px;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #0052ff, #7928ca);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(0, 82, 255, 0.15);
      border: 1px solid rgba(0, 82, 255, 0.3);
      border-radius: 20px;
      color: #60a5fa;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.live {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.3);
      color: #34d399;
    }
    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }
    @media (min-width: 860px) {
      .grid-2 {
        grid-template-columns: 1.1fr 0.9fr;
      }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .card-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-desc {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    input, textarea {
      width: 100%;
      padding: 12px 14px;
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 14px;
      transition: border-color 0.2s;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--primary);
      color: #fff;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s, transform 0.1s;
    }
    .btn:hover {
      background: var(--primary-hover);
    }
    .btn:active {
      transform: scale(0.99);
    }
    .btn.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
    }
    .btn.secondary:hover {
      background: rgba(255, 255, 255, 0.14);
    }
    .tiers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }
    .tier-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 10px;
    }
    .tier-price {
      font-weight: 700;
      color: #60a5fa;
      font-size: 16px;
    }
    .tier-bonus {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 6px;
      font-weight: 600;
      margin-left: 6px;
    }
    .address-box {
      background: var(--code-bg);
      border: 1px dashed var(--card-border);
      border-radius: 8px;
      padding: 12px;
      font-family: var(--font-mono);
      font-size: 12px;
      word-break: break-all;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 16px;
    }
    .copy-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: var(--text);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }
    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .qr-container {
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
    }
    .qr-image {
      border-radius: 8px;
      background: #fff;
      padding: 8px;
    }
    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      font-family: var(--font-mono);
      font-size: 13px;
      overflow-x: auto;
      color: #e2e8f0;
      margin-top: 12px;
    }
    .output-area {
      margin-top: 20px;
      display: none;
    }
    .meta-pills {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .pill {
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
    }
    .pill strong { color: var(--text); }
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }
    .alert.success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }
    .alert.error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <div class="logo-icon">⚡</div>
        <div>
          <h1 style="font-size: 20px; font-weight: 800;">Base HTTP 402 Markdown Extractor</h1>
          <p style="font-size: 13px; color: var(--text-muted);">Zero-KYC Machine-to-Machine Clean Content API for LLMs & AI Agents</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="badge live"><span class="pulse"></span> Base Mainnet (8453)</span>
        <a href="https://basescan.org/address/${recipient}" target="_blank" class="badge" style="text-decoration: none;">Scan Wallet ↗</a>
      </div>
    </header>

    <div class="grid grid-2">
      <!-- Left Column: Interactive Playground -->
      <div class="card">
        <div class="card-title">🧪 Live Playground & Evaluation</div>
        <div class="card-desc">Extract LLM-optimized clean Markdown from any web page. 3 free daily evaluations included per IP.</div>

        <div id="extract-alert" class="alert"></div>

        <div class="form-group">
          <label for="target-url">Web Page URL to Clean & Extract</label>
          <input type="url" id="target-url" placeholder="https://en.wikipedia.org/wiki/Autonomous_agent" value="https://en.wikipedia.org/wiki/Artificial_intelligence">
        </div>

        <div class="form-group">
          <label for="api-key-input">API Key (Optional for Free Tier)</label>
          <input type="text" id="api-key-input" placeholder="bk_live_... (Leave blank for free 3 daily queries)">
        </div>

        <button class="btn" id="btn-extract" onclick="runExtraction()">
          <span>⚡ Extract Clean Markdown</span>
        </button>

        <div id="output-section" class="output-area">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="margin: 0;">Extracted Output</label>
            <button class="copy-btn" onclick="copyMarkdown()">📋 Copy Markdown</button>
          </div>
          <div class="meta-pills">
            <span class="pill">Tokens: <strong id="out-tokens">-</strong></span>
            <span class="pill">Chars: <strong id="out-chars">-</strong></span>
            <span class="pill">Quota Remaining: <strong id="out-quota">-</strong></span>
          </div>
          <textarea id="markdown-output" rows="12" readonly></textarea>
        </div>
      </div>

      <!-- Right Column: Bulk Deposit & Credits Tank -->
      <div class="card">
        <div class="card-title">💎 Bulk Credits Tank & API Keys</div>
        <div class="card-desc">Avoid paying & waiting per request. Deposit once on Base L2, get a high-throughput API key instantly.</div>

        <div class="tiers-list">
          <div class="tier-item">
            <div>
              <div style="font-weight: 600;">Starter Tank</div>
              <div style="font-size: 12px; color: var(--text-muted);">20 Extractions ($0.05/ea)</div>
            </div>
            <div class="tier-price">1.00 USDC</div>
          </div>
          <div class="tier-item">
            <div>
              <div style="font-weight: 600;">Growth Tank <span class="tier-bonus">+10 Bonus</span></div>
              <div style="font-size: 12px; color: var(--text-muted);">110 Extractions</div>
            </div>
            <div class="tier-price">5.00 USDC</div>
          </div>
          <div class="tier-item">
            <div>
              <div style="font-weight: 600;">Scale Tank <span class="tier-bonus">+50 Bonus</span></div>
              <div style="font-size: 12px; color: var(--text-muted);">250 Extractions</div>
            </div>
            <div class="tier-price">10.00 USDC</div>
          </div>
        </div>

        <label>Base L2 Deposit Address (USDC Native):</label>
        <div class="address-box">
          <span id="agent-addr">${recipient}</span>
          <button class="copy-btn" onclick="copyAddress()">Copy</button>
        </div>

        <div class="qr-container">
          <img src="${qrUrl}" alt="Base L2 QR Code" width="130" height="130" class="qr-image">
        </div>

        <div id="deposit-alert" class="alert"></div>

        <div class="form-group">
          <label for="deposit-tx-hash">Confirm Deposit: Enter Base L2 Tx Hash</label>
          <input type="text" id="deposit-tx-hash" placeholder="0x... (66 characters)">
        </div>

        <button class="btn secondary" id="btn-claim-key" onclick="claimApiKey()">
          <span>🔑 Claim Preloaded API Key</span>
        </button>
      </div>
    </div>

    <!-- SDK & Integration Section -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-title">🤖 1-Line Agent Integration (SDK & cURL)</div>
      <div class="card-desc">Integrate this extractor into any autonomous agent or LLM context pipeline in seconds.</div>

      <div class="code-block">
<span style="color: #60a5fa;">// TypeScript: Autonomous Client SDK (auto handles 402 or uses API Key)</span>
<span style="color: #f43f5e;">import</span> { BaseExtractorClient } <span style="color: #f43f5e;">from</span> <span style="color: #a7f3d0;">'./src/sdk/client.js'</span>;

<span style="color: #f43f5e;">const</span> client = <span style="color: #f43f5e;">new</span> BaseExtractorClient({ apiKey: <span style="color: #a7f3d0;">'bk_live_...'</span> });
<span style="color: #f43f5e;">const</span> doc = <span style="color: #f43f5e;">await</span> client.extract(<span style="color: #a7f3d0;">'https://example.com'</span>);
console.log(doc.markdown);
      </div>

      <div class="code-block" style="margin-top: 12px;">
<span style="color: #60a5fa;"># cURL (Free Evaluation Tier / API Key):</span>
curl -X POST "${CONFIG.PUBLIC_URL}/api/v1/extract" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"url":"https://example.com"}'
      </div>
    </div>
  </div>

  <script>
    // Recuperar API key guardada en local storage si existe
    const savedKey = localStorage.getItem('bk_api_key');
    if (savedKey) {
      document.getElementById('api-key-input').value = savedKey;
    }

    function copyAddress() {
      const addr = document.getElementById('agent-addr').innerText;
      navigator.clipboard.writeText(addr);
      alert('Wallet address copied to clipboard!');
    }

    function copyMarkdown() {
      const md = document.getElementById('markdown-output').value;
      navigator.clipboard.writeText(md);
      alert('Markdown copied to clipboard!');
    }

    async function runExtraction() {
      const urlInput = document.getElementById('target-url').value.trim();
      const apiKey = document.getElementById('api-key-input').value.trim();
      const alertBox = document.getElementById('extract-alert');
      const btn = document.getElementById('btn-extract');
      const outSection = document.getElementById('output-section');

      if (!urlInput) {
        alertBox.className = 'alert error';
        alertBox.innerText = 'Please enter a target URL.';
        alertBox.style.display = 'block';
        return;
      }

      alertBox.style.display = 'none';
      btn.disabled = true;
      btn.innerText = '⏳ Extracting & Cleaning Content...';

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['X-API-Key'] = apiKey;
        } else {
          headers['X-Free-Tier'] = 'true';
        }

        const res = await fetch('/api/v1/extract', {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: urlInput })
        });

        const data = await res.json();

        if (res.status === 200 && data.success) {
          outSection.style.display = 'block';
          document.getElementById('markdown-output').value = data.data.markdown;
          document.getElementById('out-tokens').innerText = data.data.estimatedTokens;
          document.getElementById('out-chars').innerText = data.data.textLength;
          
          const remainingCredits = res.headers.get('X-Credits-Remaining');
          const freeRemaining = res.headers.get('X-Free-Tier-Remaining');
          if (remainingCredits) {
            document.getElementById('out-quota').innerText = remainingCredits + ' credits left';
          } else if (freeRemaining) {
            document.getElementById('out-quota').innerText = freeRemaining + ' free calls left today';
          } else {
            document.getElementById('out-quota').innerText = 'Active';
          }

          alertBox.className = 'alert success';
          alertBox.innerText = 'Extraction completed successfully!';
          alertBox.style.display = 'block';
        } else if (res.status === 402) {
          alertBox.className = 'alert error';
          alertBox.innerText = data.message || 'Payment Required. Deposit USDC on Base L2 or provide an API Key.';
          alertBox.style.display = 'block';
        } else {
          alertBox.className = 'alert error';
          alertBox.innerText = data.message || data.error || 'Extraction failed.';
          alertBox.style.display = 'block';
        }
      } catch (err) {
        alertBox.className = 'alert error';
        alertBox.innerText = 'Network error: ' + err.message;
        alertBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerText = '⚡ Extract Clean Markdown';
      }
    }

    async function claimApiKey() {
      const txHash = document.getElementById('deposit-tx-hash').value.trim();
      const alertBox = document.getElementById('deposit-alert');
      const btn = document.getElementById('btn-claim-key');

      if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
        alertBox.className = 'alert error';
        alertBox.innerText = 'Please enter a valid 66-character Base L2 transaction hash.';
        alertBox.style.display = 'block';
        return;
      }

      alertBox.style.display = 'none';
      btn.disabled = true;
      btn.innerText = '⏳ Verifying On-Chain Deposit...';

      try {
        const res = await fetch('/api/v1/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash })
        });

        const data = await res.json();

        if (res.status === 200 && data.success) {
          alertBox.className = 'alert success';
          alertBox.innerHTML = '🎉 Deposit verified! <strong>' + data.creditsGranted + ' credits</strong> added.<br>Your API Key: <code style="font-family: monospace; font-weight: bold;">' + data.apiKey + '</code>';
          alertBox.style.display = 'block';

          // Guardar y rellenar automáticamente en el playground
          localStorage.setItem('bk_api_key', data.apiKey);
          document.getElementById('api-key-input').value = data.apiKey;
        } else {
          alertBox.className = 'alert error';
          alertBox.innerText = data.message || data.error || 'Failed to verify deposit.';
          alertBox.style.display = 'block';
        }
      } catch (err) {
        alertBox.className = 'alert error';
        alertBox.innerText = 'Error: ' + err.message;
        alertBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerText = '🔑 Claim Preloaded API Key';
      }
    }
  </script>
</body>
</html>`;
}

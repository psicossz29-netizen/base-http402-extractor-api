# Base L2 HTTP 402 Markdown Extractor SDKs

Official lightweight SDKs for interacting with the **Base L2 HTTP 402 Markdown Extractor API**.
Designed for Autonomous AI Agents, LLM pipelines, and developers requiring clean web content without subscriptions.

---

## 📦 TypeScript / JavaScript (`sdk/client.ts`)

### Installation & Prerequisites
```bash
npm install viem
```

### Usage

```typescript
import { BaseExtractorClient } from './sdk/client.js';

// 1. Direct API Key mode (prepaid tanks or coupons)
const client = new BaseExtractorClient({ apiKey: 'bk_live_...' });
const result = await client.extractWithApiKey('https://en.wikipedia.org/wiki/Autonomous_agent');
console.log(result.markdown);

// 2. Autonomous HTTP 402 Micropayment mode (Base L2 wallet)
const autonomousClient = new BaseExtractorClient({
  privateKey: '0x...', // EVM private key funded with >= 0.05 USDC + tiny gas on Base
});
const doc = await autonomousClient.extractWithWallet('https://example.com');
console.log(doc.markdown);
```

---

## 🐍 Python (`sdk/client.py`)

### Installation & Prerequisites
```bash
pip install requests web3
```

### Usage

```python
from sdk.client import BaseExtractorClient

# 1. API Key mode
client = BaseExtractorClient(api_key="bk_live_...")
doc = client.extract_with_api_key("https://en.wikipedia.org/wiki/Autonomous_agent")
print(doc["markdown"])

# 2. Autonomous HTTP 402 Micropayment mode (Base L2)
auto_client = BaseExtractorClient(private_key="0x...")
doc = auto_client.extract_with_wallet("https://example.com")
print(doc["title"], doc["estimatedTokens"])
print(doc["markdown"])
```

---

## ⚡ Features
- **Zero-KYC & Machine-to-Machine**: AI agents pay autonomously via Base L2 USDC transfers.
- **Edge Cache (12h TTL)**: Instant responses for repeat queries with verified payments.
- **Cheerio + Turndown Dual Engine**: Eliminates ads, banners, navbars, and DOM noise.
- **Freemium Evaluation**: 3 daily requests per IP without payment or credentials.

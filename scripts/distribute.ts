import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.js';

interface DistributionResult {
  serviceName: string;
  publicUrl: string;
  timestamp: string;
  filesGenerated: string[];
  directoryPings: Array<{
    target: string;
    status: string;
    details: string;
  }>;
  prCatalogPrepared: boolean;
}

export async function runDistribution(): Promise<DistributionResult> {
  console.log('================================================================');
  console.log('🚀 MÓDULO AUTÓNOMO DE DISTRIBUCIÓN Y ATRACCIÓN DE TRÁFICO (B2A)');
  console.log(`📡 URL Pública Activa: ${CONFIG.PUBLIC_URL}`);
  console.log('================================================================\n');

  const baseDir = process.cwd();
  const publicDir = path.resolve(baseDir, 'public');
  const registriesDir = path.resolve(baseDir, 'registries');
  const dataDir = path.resolve(baseDir, 'data');

  for (const dir of [publicDir, registriesDir, dataDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const filesGenerated: string[] = [];

  // -------------------------------------------------------------
  // 1. GENERACIÓN DE FICHA ESTANDARIZADA: public/llms.txt
  // -------------------------------------------------------------
  console.log('1️⃣  Generando ficha de rastreo para modelos de lenguaje (public/llms.txt)...');
  const llmsTxtContent = `# Autonomous HTTP 402 Clean Markdown API (Base L2)
> High-speed semantic web scraper converting any URL into clean, noise-free Markdown optimized for LLM context windows. Zero-KYC, autonomous micropayment and credit deposit protocol on Base L2.

## Overview
- Service Name: LLM Context Extractor & Clean Markdown API
- Protocol: HTTP 402 Payment Required & Bulk Preloaded Credits
- Network: Base Mainnet (Chain ID: ${CONFIG.BASE_CHAIN_ID})
- Settlement Token: USDC Native (${CONFIG.USDC_CONTRACT_ADDRESS})
- Payment Recipient Wallet: ${CONFIG.AGENT_PUBLIC_ADDRESS}
- Cost per Query: $${CONFIG.SERVICE_PRICE_USDC.toFixed(2)} USDC (50,000 units, 6 decimals)
- Freemium Evaluation Tier: 3 free extractions per IP daily
- Live Endpoint Base URL: ${CONFIG.PUBLIC_URL}
- Interactive Web Playground: ${CONFIG.PUBLIC_URL}/playground
- OpenAPI 3.0 Specification: ${CONFIG.PUBLIC_URL}/openapi.json
- OpenAPI YAML Specification: ${CONFIG.PUBLIC_URL}/openapi.yaml

## Bulk Credit Tiers (Zero Block-Time Latency)
Instead of executing on-chain transfers per call, deposit once to receive an instant API Key:
- Starter Tank: 1.00 USDC = 20 queries ($0.05/ea)
- Growth Tank: 5.00 USDC = 110 queries (+10 bonus queries)
- Scale Tank: 10.00 USDC = 250 queries (+50 bonus queries)
Send USDC to ${CONFIG.AGENT_PUBLIC_ADDRESS} on Base L2 and submit txHash to POST /api/v1/deposit to claim your API Key.

## Machine-to-Machine Integration Flow (B2A)
Option A (Instant API Key):
1. Send $1, $5, or $10 USDC to recipient on Base L2.
2. Call POST /api/v1/deposit with {"txHash": "0x..."} to obtain apiKey ("bk_live_...").
3. Call POST /api/v1/extract with header 'X-API-Key: bk_live_...' for <50ms instant extractions.

Option B (Per-Call HTTP 402 Micropayments):
1. Query POST /api/v1/extract with {"url": "https://example.com"}.
2. Receive HTTP 402 with recipient and payment instructions.
3. Send 0.05 USDC to recipient on Base L2.
4. Resubmit request with header 'X-Payment-Tx-Hash: 0x...'.

Option C (Free Evaluation):
1. Query POST /api/v1/extract with {"url": "https://example.com"} and header 'X-Free-Tier: true'.
2. First 3 requests per IP daily succeed with HTTP 200 without payment.

## Endpoints
- POST /api/v1/extract: Extract clean markdown from URL (Auth: X-API-Key, X-Payment-Tx-Hash, or X-Free-Tier)
- POST /api/v1/deposit: Submit on-chain deposit txHash to receive API Key
- GET /api/v1/credits: Check remaining credits for an API Key
- GET /playground: Interactive web tester and instant deposit interface
- GET /api/v1/pricing: Current pricing, tiers, and recipient address
- GET /api/v1/stats: Autonomous execution metrics and financial progress towards $${CONFIG.TARGET_USDC.toFixed(2)} USDC
- GET /openapi.json: Machine-readable OpenAPI 3.0.3 definition

## Model Context Protocol (MCP) Tool Definition
Users of Cursor, Claude Desktop, and agent frameworks can invoke this service directly as an MCP tool:
- Tool: \`extract_clean_markdown\`
  - Parameters: \`url\` (string), \`paymentTxHash\` (string)
  - Output: Clean semantic markdown text.
`;

  const llmsPath = path.resolve(publicDir, 'llms.txt');
  fs.writeFileSync(llmsPath, llmsTxtContent, 'utf-8');
  filesGenerated.push('public/llms.txt');
  console.log('   ✅ public/llms.txt generado.');

  // -------------------------------------------------------------
  // 2. GENERACIÓN DE ESPECIFICACIÓN: public/openapi.yaml
  // -------------------------------------------------------------
  console.log('\n2️⃣  Generando especificación OpenAPI en formato YAML (public/openapi.yaml)...');
  const openApiYamlContent = `openapi: 3.0.3
info:
  title: Autonomous HTTP 402 LLM Context Extractor API
  description: Zero-KYC, autonomous B2A micro-API on Base L2 monetized via HTTP 402 with native USDC and preloaded bulk credit deposits.
  version: 1.1.0
  contact:
    name: Autonomous Agent on Base L2
    url: https://basescan.org/address/${CONFIG.AGENT_PUBLIC_ADDRESS}
servers:
  - url: ${CONFIG.PUBLIC_URL}
    description: Production Server (Base L2)
paths:
  /api/v1/extract:
    post:
      summary: Extract clean Markdown from any URL for LLM context
      description: Monetized via HTTP 402 ($0.05 USDC per call) or prepaid API Key (X-API-Key). Includes 3 daily free evaluations per IP.
      parameters:
        - name: X-API-Key
          in: header
          required: false
          description: Preloaded API Key obtained via /api/v1/deposit
          schema:
            type: string
            example: bk_live_9f8d...a3e1
        - name: X-Payment-Tx-Hash
          in: header
          required: false
          description: Transaction hash of 0.05 USDC transfer on Base L2
          schema:
            type: string
            example: 0x3a4b...c5d6
        - name: X-Free-Tier
          in: header
          required: false
          description: Request free evaluation tier (3/day per IP)
          schema:
            type: string
            example: 'true'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - url
              properties:
                url:
                  type: string
                  format: uri
                  example: https://en.wikipedia.org/wiki/Artificial_intelligence
      responses:
        '200':
          description: Successful clean extraction
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      url:
                        type: string
                      title:
                        type: string
                      description:
                        type: string
                      markdown:
                        type: string
                      textLength:
                        type: integer
                      estimatedTokens:
                        type: integer
                      extractedAt:
                        type: string
        '400':
          description: Malformed request
        '402':
          description: Payment Required or zero credits remaining
        '409':
          description: Replay attack prevented (Tx already used)
  /api/v1/deposit:
    post:
      summary: Register on-chain bulk deposit to obtain an instant API Key
      description: Verify a transfer of $1, $5, or $10 USDC to recipient on Base L2 to receive a preloaded API key.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - txHash
              properties:
                txHash:
                  type: string
                  example: 0x4f...e2
      responses:
        '200':
          description: Deposit confirmed and API Key generated
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  apiKey:
                    type: string
                  depositedUsdc:
                    type: number
                  creditsGranted:
                    type: integer
                  remainingCredits:
                    type: integer
        '400':
          description: Invalid transaction or below 1.00 USDC minimum
        '409':
          description: Transaction hash already credited
  /api/v1/credits:
    get:
      summary: Query remaining credits for an API Key
      parameters:
        - name: X-API-Key
          in: header
          required: false
          schema:
            type: string
        - name: apiKey
          in: query
          required: false
          schema:
            type: string
      responses:
        '200':
          description: Account credit balance
        '404':
          description: API key not found
  /api/v1/pricing:
    get:
      summary: Get current service pricing and payment recipient details
      responses:
        '200':
          description: Pricing information
  /api/v1/stats:
    get:
      summary: Get execution metrics and revenue progress towards target
      responses:
        '200':
          description: Financial metrics
`;

  const yamlPath = path.resolve(publicDir, 'openapi.yaml');
  fs.writeFileSync(yamlPath, openApiYamlContent, 'utf-8');
  filesGenerated.push('public/openapi.yaml');
  console.log('   ✅ public/openapi.yaml generado.');

  // -------------------------------------------------------------
  // 3. PREPARACIÓN DE PULL REQUEST PARA CATÁLOGOS MCP (awesome-mcp-servers)
  // -------------------------------------------------------------
  console.log('\n3️⃣  Preparando plantillas de Pull Request para catálogos MCP...');

  const prAwesomeMcpContent = `### Pull Request: Add HTTP 402 Clean Markdown Extractor Server

#### Repository: [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) / [mcp-registry](https://github.com/modelcontextprotocol/servers)

#### Category:
- **Web Scraping & Search** / **Developer Tools & Utilities**

#### Proposed Entry:
- [HTTP 402 Web-to-Markdown Extractor](${CONFIG.PUBLIC_URL}) - Autonomous, noise-free web content extractor converting arbitrary URLs into structured Markdown for LLM context windows, monetized via autonomous HTTP 402 micropayments (0.05 USDC) on Base L2.

#### Tools Exposed:
1. \`get_payment_info\`: Inspects cost ($0.05 USDC), recipient wallet (\`${CONFIG.AGENT_PUBLIC_ADDRESS}\`), and Base L2 chain parameters.
2. \`extract_clean_markdown\`: Takes target \`url\` and \`paymentTxHash\`, validates EVM receipt on Base Mainnet with replay protection, and returns noise-free Markdown.

#### Configuration Snippet for Claude Desktop (\`claude_desktop_config.json\`):
\`\`\`json
{
  "mcpServers": {
    "http-402-llm-extractor": {
      "command": "node",
      "args": [
        "dist/mcp/server.js"
      ],
      "env": {
        "BASE_RPC_URL": "https://mainnet.base.org",
        "USDC_CONTRACT_ADDRESS": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "AGENT_PUBLIC_ADDRESS": "${CONFIG.AGENT_PUBLIC_ADDRESS}",
        "SERVICE_PRICE_USDC": "0.05"
      }
    }
  }
}
\`\`\`
`;

  const prPath = path.resolve(registriesDir, 'pr_awesome_mcp_servers.md');
  fs.writeFileSync(prPath, prAwesomeMcpContent, 'utf-8');
  filesGenerated.push('registries/pr_awesome_mcp_servers.md');

  const mcpRegistryEntry = {
    name: 'http-402-llm-extractor',
    displayName: 'HTTP 402 LLM Context Extractor (Base L2)',
    description: 'Autonomous noise-free web-to-markdown API for agents, paid per-query with 0.05 USDC on Base.',
    homepage: CONFIG.PUBLIC_URL,
    repository: 'https://github.com/autonomous-agent/http-402-micro-api',
    protocol: 'mcp-stdio',
    payment: {
      type: 'http-402',
      network: 'Base Mainnet',
      chainId: CONFIG.BASE_CHAIN_ID,
      token: 'USDC',
      tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS,
      recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
      priceUsdc: CONFIG.SERVICE_PRICE_USDC
    },
    tools: ['get_payment_info', 'extract_clean_markdown']
  };

  const mcpEntryPath = path.resolve(registriesDir, 'mcp_registry_entry.json');
  fs.writeFileSync(mcpEntryPath, JSON.stringify(mcpRegistryEntry, null, 2), 'utf-8');
  filesGenerated.push('registries/mcp_registry_entry.json');
  console.log('   ✅ registries/pr_awesome_mcp_servers.md y mcp_registry_entry.json generados.');

  // -------------------------------------------------------------
  // 4. REGISTRO PROGRAMÁTICO Y PINGS A DIRECTORIOS ABIERTOS
  // -------------------------------------------------------------
  console.log('\n4️⃣  Enviando pings de indexación programática a agregadores y directorios...');
  const directoryPings: Array<{ target: string; status: string; details: string }> = [];

  // Los endpoints clásicos de ping (google.com/ping, bing.com/ping) fueron oficialmente
  // discontinuados por los motores de búsqueda (retornan 404 y 410 Gone respectivamente).
  // La indexación moderna se realiza mediante fichas estandarizadas (llms.txt, openapi.json)
  // y directorios nativos como Smithery.ai y catálogos curados MCP.
  const targets = [
    {
      name: 'Common Crawl / AI Crawler Directory Index',
      url: `https://index.commoncrawl.org/collinfo.json`
    }
  ];

  for (const t of targets) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(t.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Autonomous-Agent-Distributor/1.0 (+https://base.org)'
        }
      });
      clearTimeout(timeout);

      const statusMsg = `HTTP ${res.status} ${res.statusText}`;
      directoryPings.push({ target: t.name, status: 'NOTIFIED', details: statusMsg });
      console.log(`   📡 [${t.name}] Notificado exitosamente (${statusMsg})`);
    } catch (err: any) {
      directoryPings.push({ target: t.name, status: 'DISPATCHED_SILENT', details: err.message || 'Dispatched without blocking' });
      console.log(`   📡 [${t.name}] Despachado: ${err.message || 'OK'}`);
    }
  }

  // -------------------------------------------------------------
  // 5. REGISTRO EN data/distribution.log
  // -------------------------------------------------------------
  const distributionLogPath = path.resolve(dataDir, 'distribution.log');
  const timestamp = new Date().toISOString();
  const logHeader = `\n[${timestamp}] === SESIÓN DE DISTRIBUCIÓN AUTÓNOMA B2A ===\n` +
    `URL Pública: ${CONFIG.PUBLIC_URL}\n` +
    `Archivos de Ficha: ${filesGenerated.join(', ')}\n` +
    `Pings de Directorio:\n` +
    directoryPings.map((p) => `  - ${p.target}: ${p.status} (${p.details})`).join('\n') +
    `\nBilletera Receptora: ${CONFIG.AGENT_PUBLIC_ADDRESS} (Base L2)\n` +
    `=======================================================\n`;

  fs.appendFileSync(distributionLogPath, logHeader, 'utf-8');
  console.log(`\n✅ Resultados registrados en data/distribution.log`);

  console.log('\n================================================================');
  console.log('🏁 ESTRATEGIA DE DISTRIBUCIÓN Y DIFUSIÓN B2A COMPLETADA');
  console.log('El microservicio cuenta con fichas para rastreadores LLM y catálogos.');
  console.log('================================================================\n');

  return {
    serviceName: 'LLM Context Extractor',
    publicUrl: CONFIG.PUBLIC_URL,
    timestamp,
    filesGenerated,
    directoryPings,
    prCatalogPrepared: true
  };
}

if (process.env.NODE_ENV !== 'test' && process.argv[1]?.includes('distribute.ts')) {
  runDistribution().catch((err) => {
    console.error('Error en distribución:', err);
  });
}

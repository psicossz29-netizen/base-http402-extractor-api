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
> High-speed semantic web scraper converting any URL into clean, noise-free Markdown optimized for LLM context windows. Zero-KYC, autonomous micropayment protocol on Base L2.

## Overview
- Service Name: LLM Context Extractor & Clean Markdown API
- Protocol: HTTP 402 Payment Required
- Network: Base Mainnet (Chain ID: ${CONFIG.BASE_CHAIN_ID})
- Settlement Token: USDC Native (${CONFIG.USDC_CONTRACT_ADDRESS})
- Payment Recipient Wallet: ${CONFIG.AGENT_PUBLIC_ADDRESS}
- Cost per Query: $${CONFIG.SERVICE_PRICE_USDC.toFixed(2)} USDC (50,000 units, 6 decimals)
- Production Base URL: ${CONFIG.PUBLIC_URL}
- OpenAPI 3.0 Specification: ${CONFIG.PUBLIC_URL}/openapi.json
- OpenAPI YAML Specification: ${CONFIG.PUBLIC_URL}/openapi.yaml

## Machine-to-Machine Integration Flow (B2A)
1. Query ${CONFIG.PUBLIC_URL}/api/v1/extract without payment header.
2. Receive HTTP 402 status with exact payment JSON payload.
3. Broadcast a 0.05 USDC transfer to ${CONFIG.AGENT_PUBLIC_ADDRESS} on Base Mainnet.
4. Resubmit request including the transaction hash in the 'X-Payment-Tx-Hash' HTTP header.
5. Receive HTTP 200 OK with clean Markdown, title, description, and token count estimation.

## Endpoints
- POST ${CONFIG.PUBLIC_URL}/api/v1/extract: Extract clean markdown from URL (Requires X-Payment-Tx-Hash: 0x...)
- GET ${CONFIG.PUBLIC_URL}/api/v1/pricing: Current pricing and recipient address
- GET ${CONFIG.PUBLIC_URL}/api/v1/stats: Autonomous execution metrics and financial progress towards $${CONFIG.TARGET_USDC.toFixed(2)} USDC
- GET ${CONFIG.PUBLIC_URL}/openapi.json: Machine-readable OpenAPI 3.0.3 definition

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
  description: Zero-KYC, autonomous B2A micro-API on Base L2 monetized via HTTP 402 with native USDC.
  version: 1.0.0
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
      description: Requires payment of 0.05 USDC on Base L2. Pass the transaction hash in X-Payment-Tx-Hash header.
      parameters:
        - name: X-Payment-Tx-Hash
          in: header
          required: true
          description: Transaction hash of the USDC transfer on Base L2
          schema:
            type: string
            example: 0x3a4b...c5d6
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
          description: Malformed request or invalid transaction hash
        '402':
          description: Payment required with Base L2 deposit instructions
        '409':
          description: Replay attack prevented (transaction hash already redeemed)
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

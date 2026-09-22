import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import fs from 'node:fs';
import path from 'node:path';
import { parseEventLogs } from 'viem';
import { CONFIG, validateConfig } from './config.js';
import { paymentRequiredMiddleware, createBasePublicClient, TRANSFER_EVENT_ABI } from './middleware/payment402.js';
import { webExtractorService } from './services/extractor.js';
import { defaultReplayStore } from './store/replayStore.js';
import { defaultCreditStore } from './store/creditStore.js';
import { renderPlaygroundHtml } from './views/playground.js';
import { notifier } from './services/notifier.js';

validateConfig();

const app = new Hono();

// Middleware de CORS simple para clientes web, bots y sincronización de Cloudflare Workers
app.use('*', async (c, next) => {
  if (c.env) {
    if ((c.env as any).PUBLIC_URL) CONFIG.PUBLIC_URL = (c.env as any).PUBLIC_URL;
    if ((c.env as any).AGENT_PUBLIC_ADDRESS) CONFIG.AGENT_PUBLIC_ADDRESS = (c.env as any).AGENT_PUBLIC_ADDRESS;
  }
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, X-Payment-Tx-Hash, X-API-Key, Authorization, X-Free-Tier');
  c.header('Access-Control-Expose-Headers', 'X-Credits-Remaining, X-Free-Tier-Used, X-Free-Tier-Remaining, WWW-Authenticate');
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

// Endpoint Raíz: Overview e información para agentes (o Playground interactivo en navegador)
app.get('/', (c) => {
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html') && !accept.includes('application/json')) {
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.html(renderPlaygroundHtml());
  }

  return c.json({
    service: 'Autonomous HTTP 402 Micro-API (Base L2)',
    description: 'Micropayment-monetized clean web-to-markdown extraction for AI agents and LLMs',
    version: '1.1.0',
    protocol: 'HTTP 402 Payment Required & Bulk Deposits',
    network: {
      name: 'Base Mainnet',
      chainId: CONFIG.BASE_CHAIN_ID,
      token: 'USDC',
      tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS
    },
    payment: {
      recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
      priceUsdc: CONFIG.SERVICE_PRICE_USDC,
      header: 'X-Payment-Tx-Hash',
      apiKeyHeader: 'X-API-Key'
    },
    publicUrl: CONFIG.PUBLIC_URL,
    endpoints: {
      extract: `${CONFIG.PUBLIC_URL}/api/v1/extract`,
      deposit: `${CONFIG.PUBLIC_URL}/api/v1/deposit`,
      credits: `${CONFIG.PUBLIC_URL}/api/v1/credits`,
      playground: `${CONFIG.PUBLIC_URL}/playground`,
      pricing: `${CONFIG.PUBLIC_URL}/api/v1/pricing`,
      openapi: `${CONFIG.PUBLIC_URL}/openapi.json`,
      openapiYaml: `${CONFIG.PUBLIC_URL}/openapi.yaml`,
      llmsTxt: `${CONFIG.PUBLIC_URL}/llms.txt`,
      stats: `${CONFIG.PUBLIC_URL}/api/v1/stats`
    },
    documentation: `See ${CONFIG.PUBLIC_URL}/playground for UI or ${CONFIG.PUBLIC_URL}/openapi.json for machine consumption`,
    goal: {
      targetUsdc: CONFIG.TARGET_USDC,
      totalProcessedCalls: defaultReplayStore.count(),
      grossRevenueUsdc: (defaultReplayStore.count() * CONFIG.SERVICE_PRICE_USDC).toFixed(2)
    }
  });
});

// Playground Web Interactivo
app.get('/playground', (c) => {
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.html(renderPlaygroundHtml());
});

// Ficha de contexto para rastreadores LLM (llms.txt)
app.get('/llms.txt', (c) => {
  try {
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      const filePath = path.resolve(process.cwd(), 'public', 'llms.txt');
      if (fs.existsSync(filePath)) {
        c.header('Content-Type', 'text/plain; charset=utf-8');
        return c.text(fs.readFileSync(filePath, 'utf-8'));
      }
    }
  } catch {}
  return c.text(`# Autonomous HTTP 402 Clean Markdown API\nCost: 0.05 USDC on Base L2\nEndpoint: ${CONFIG.PUBLIC_URL}/api/v1/extract\n`, 200);
});

// Especificación OpenAPI 3.0 en formato YAML
app.get('/openapi.yaml', (c) => {
  try {
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      const filePath = path.resolve(process.cwd(), 'public', 'openapi.yaml');
      if (fs.existsSync(filePath)) {
        c.header('Content-Type', 'text/yaml; charset=utf-8');
        return c.body(fs.readFileSync(filePath, 'utf-8'));
      }
    }
  } catch {}
  return c.text('openapi: 3.0.3\n', 200);
});

// Manifiesto de Autodescubrimiento M2M para rastreadores MCP
app.get('/.well-known/mcp.json', (c) => {
  return c.json({
    schema_version: 'v1',
    name: 'base-http402-extractor-api',
    description: 'Autonomous Web-to-Markdown extractor for LLM context with Base L2 HTTP 402 payments and credit tanks.',
    homepage: CONFIG.PUBLIC_URL,
    protocol: 'mcp-stdio',
    server: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'github:psicossz29-netizen/base-http402-extractor-api']
    },
    payment: {
      protocol: 'http-402',
      network: 'Base Mainnet',
      chainId: CONFIG.BASE_CHAIN_ID,
      token: 'USDC',
      tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS,
      recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
      priceUsdc: CONFIG.SERVICE_PRICE_USDC,
      tiers: [
        { name: 'Starter Tank', usdc: 1.0, queries: 20 },
        { name: 'Growth Tank', usdc: 5.0, queries: 110, bonus: 10 },
        { name: 'Scale Tank', usdc: 10.0, queries: 250, bonus: 50 }
      ]
    },
    tools: [
      {
        name: 'extract_clean_markdown',
        description: 'Extracts clean, noise-free Markdown from any URL optimized for LLM context windows.',
        parameters: {
          url: { type: 'string', required: true },
          paymentTxHash: { type: 'string', required: false },
          apiKey: { type: 'string', required: false }
        }
      },
      {
        name: 'get_payment_info',
        description: 'Returns pricing, recipient address on Base L2, and bulk tank tiers.',
        parameters: {}
      }
    ]
  });
});

// Especificación OpenAPI 3.0
app.get('/openapi.json', (c) => {
  return c.json({
    openapi: '3.0.3',
    info: {
      title: 'Autonomous HTTP 402 LLM Context Extractor API',
      description: 'Zero-KYC, autonomous B2A micro-API on Base L2 monetized via HTTP 402 with native USDC.',
      version: '1.0.0',
      contact: {
        name: 'Autonomous Agent on Base L2',
        url: `https://basescan.org/address/${CONFIG.AGENT_PUBLIC_ADDRESS}`
      }
    },
    servers: [
      {
        url: CONFIG.PUBLIC_URL,
        description: 'Micro-API HTTP 402 server'
      }
    ],
    paths: {
      '/api/v1/extract': {
        post: {
          summary: 'Extract clean Markdown from any URL for LLM context',
          description: 'Requires payment of 0.05 USDC on Base L2. Pass the transaction hash in X-Payment-Tx-Hash header.',
          parameters: [
            {
              name: 'X-Payment-Tx-Hash',
              in: 'header',
              required: true,
              description: 'Transaction hash of the USDC transfer on Base L2',
              schema: {
                type: 'string',
                example: '0x3a4b...c5d6'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url'],
                  properties: {
                    url: {
                      type: 'string',
                      format: 'uri',
                      description: 'The target web page URL to clean and convert to Markdown',
                      example: 'https://en.wikipedia.org/wiki/Artificial_intelligence'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful clean extraction',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      url: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      markdown: { type: 'string' },
                      textLength: { type: 'integer' },
                      estimatedTokens: { type: 'integer' },
                      extractedAt: { type: 'string' }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Malformed request or invalid transaction hash'
            },
            '402': {
              description: 'Payment required or payment verification failed on Base L2',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string' },
                      network: { type: 'string' },
                      chainId: { type: 'integer' },
                      token: { type: 'string' },
                      recipient: { type: 'string' },
                      priceUsdc: { type: 'number' },
                      decimals: { type: 'integer' },
                      instructions: { type: 'string' }
                    }
                  }
                }
              }
            },
            '409': {
              description: 'Replay attack prevented: Transaction hash already used'
            }
          }
        }
      },
      '/api/v1/pricing': {
        get: {
          summary: 'Get current service pricing and payment recipient details',
          responses: {
            '200': {
              description: 'Pricing information'
            }
          }
        }
      },
      '/api/v1/stats': {
        get: {
          summary: 'Get autonomous execution stats and revenue metrics',
          responses: {
            '200': {
              description: 'Execution metrics'
            }
          }
        }
      }
    }
  });
});

// Endpoint de Información de Precios y Billetera
app.get('/api/v1/pricing', (c) => {
  return c.json({
    service: 'LLM Context Extractor',
    priceUsdc: CONFIG.SERVICE_PRICE_USDC,
    priceUnits: CONFIG.PRICE_IN_UNITS.toString(),
    network: 'Base',
    chainId: CONFIG.BASE_CHAIN_ID,
    token: 'USDC',
    tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS,
    recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
    instructions: `Send ${CONFIG.SERVICE_PRICE_USDC} USDC to ${CONFIG.AGENT_PUBLIC_ADDRESS} on Base Mainnet. Provide the tx hash in 'X-Payment-Tx-Hash'.`
  });
});

// Endpoint de Métricas y Progreso
app.get('/api/v1/stats', (c) => {
  const transactions = defaultReplayStore.getAll();
  const totalCalls = transactions.length;
  const grossRevenue = totalCalls * CONFIG.SERVICE_PRICE_USDC;

  return c.json({
    targetUsdc: CONFIG.TARGET_USDC,
    totalCallsProcessed: totalCalls,
    grossRevenueUsdc: parseFloat(grossRevenue.toFixed(4)),
    remainingUsdcToTarget: Math.max(0, parseFloat((CONFIG.TARGET_USDC - grossRevenue).toFixed(4))),
    targetReached: grossRevenue >= CONFIG.TARGET_USDC,
    recentTransactions: transactions.slice(-10)
  });
});

// Endpoint de Depósito por Volumen (Generación Instantánea de API Key)
app.post('/api/v1/deposit', async (c) => {
  let body: { txHash?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON Body', message: 'Request body must be a valid JSON object with { txHash }.' }, 400);
  }

  const txHash = body.txHash?.trim();
  if (!txHash) {
    return c.json({ error: 'Missing Parameter', message: 'The "txHash" field is required.' }, 400);
  }

  const hashRegex = /^0x[a-fA-F0-9]{64}$/;
  if (!hashRegex.test(txHash)) {
    return c.json({
      error: 'Invalid Payment Hash Format',
      message: 'The provided transaction hash is malformed. Expected a 66-character 0x-prefixed hex string.'
    }, 400);
  }

  const normalizedHash = txHash.toLowerCase() as `0x${string}`;

  // Inyectar KV si está disponible en Workers
  if ((c.env as any)?.REPLAY_STORE && !defaultReplayStore.hasKV()) {
    defaultReplayStore.setKV((c.env as any).REPLAY_STORE);
  }

  // Verificar si ya fue registrado en el replayStore
  const isAvailable = await defaultReplayStore.reserveAsync(normalizedHash);
  if (!isAvailable) {
    const existing = await defaultReplayStore.getAsync(normalizedHash);
    return c.json({
      error: 'Transaction Already Processed',
      message: 'This transaction hash has already been credited or is currently in flight.',
      processedAt: existing?.timestamp
    }, 409);
  }

  let isSuccess = false;
  try {
    const client = createBasePublicClient();
    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: normalizedHash });
    } catch (err: any) {
      return c.json({
        error: 'Verification Failed',
        message: `Transaction not found on Base L2: ${err.message || 'Unknown error'}`
      }, 400);
    }

    if (!receipt || receipt.status !== 'success') {
      return c.json({
        error: 'Invalid Transaction',
        message: `Transaction status is '${receipt?.status || 'not found'}'. Must be 'success'.`
      }, 400);
    }

    let transferLogs;
    try {
      transferLogs = parseEventLogs({
        abi: [TRANSFER_EVENT_ABI],
        eventName: 'Transfer',
        logs: receipt.logs
      });
    } catch {
      return c.json({ error: 'Event Parsing Error', message: 'Could not parse Transfer logs.' }, 400);
    }

    const tokenAddress = CONFIG.USDC_CONTRACT_ADDRESS.toLowerCase();
    const recipient = CONFIG.AGENT_PUBLIC_ADDRESS.toLowerCase();

    const validTransfers = transferLogs.filter((log) => {
      const isUsdcContract = log.address.toLowerCase() === tokenAddress;
      const isRecipient = log.args.to.toLowerCase() === recipient;
      return isUsdcContract && isRecipient;
    });

    if (validTransfers.length === 0) {
      return c.json({
        error: 'No Matching Transfer',
        message: `No USDC transfer to ${CONFIG.AGENT_PUBLIC_ADDRESS} was found in transaction ${txHash}.`
      }, 400);
    }

    const totalAmount = validTransfers.reduce((acc, log) => acc + log.args.value, 0n);
    const amountUsdc = Number(totalAmount) / 10 ** CONFIG.USDC_DECIMALS;

    if (amountUsdc < 1.00) {
      return c.json({
        error: 'Deposit Below Minimum',
        message: `Minimum deposit is 1.00 USDC. Received: $${amountUsdc.toFixed(2)} USDC.`,
        receivedUsdc: amountUsdc
      }, 400);
    }

    // Registrar en replayStore y creditStore
    isSuccess = true;
    const sender = validTransfers[0]?.args?.from;

    defaultReplayStore.record({
      txHash: normalizedHash,
      sender,
      recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
      amountUnits: totalAmount.toString(),
      amountUsdc,
      timestamp: Date.now(),
      endpoint: '/api/v1/deposit',
      blockNumber: receipt.blockNumber ? receipt.blockNumber.toString() : undefined
    });

    const account = defaultCreditStore.registerDeposit(normalizedHash, amountUsdc);

    notifier.emitJobProcessed({
      txHash: normalizedHash,
      sender,
      recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
      amountUsdc,
      totalCallsProcessed: defaultReplayStore.count(),
      grossRevenueUsdc: defaultReplayStore.count() * CONFIG.SERVICE_PRICE_USDC,
      endpoint: '/api/v1/deposit'
    });

    return c.json({
      success: true,
      apiKey: account.apiKey,
      depositedUsdc: amountUsdc,
      creditsGranted: account.credits,
      remainingCredits: account.credits,
      usage: `Include 'X-API-Key: ${account.apiKey}' in POST /api/v1/extract`
    });
  } finally {
    if (!isSuccess) {
      defaultReplayStore.release(normalizedHash);
    }
  }
});

// Endpoint de Consulta de Créditos
app.get('/api/v1/credits', (c) => {
  const apiKey = c.req.header('X-API-Key')?.trim() || c.req.query('apiKey')?.trim();
  if (!apiKey) {
    return c.json({ error: 'Missing API Key', message: 'Provide X-API-Key header or ?apiKey query parameter.' }, 400);
  }
  const account = defaultCreditStore.getAccount(apiKey);
  if (!account) {
    return c.json({ error: 'Not Found', message: 'API key not found.' }, 404);
  }
  return c.json({
    apiKey: account.apiKey,
    remainingCredits: account.remainingCredits,
    initialUsdc: account.initialUsdc,
    createdAt: new Date(account.createdAt).toISOString(),
    lastUsedAt: new Date(account.lastUsedAt).toISOString()
  });
});

// Endpoint Principal Monetizado: Extracción Web Limpia
app.post('/api/v1/extract', paymentRequiredMiddleware({ enableFreeTier: true, maxFreeTierCalls: 3 }), async (c) => {
  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON Body', message: 'Request body must be a valid JSON object.' }, 400);
  }

  if (!body.url || typeof body.url !== 'string') {
    return c.json({ error: 'Missing Parameter', message: 'The "url" field is required and must be a string.' }, 400);
  }

  try {
    const result = await webExtractorService.extract(body.url);
    return c.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return c.json(
      {
        error: 'Extraction Failed',
        message: err.message || 'Failed to fetch or parse target URL.'
      },
      502
    );
  }
});

// Exportar app para tests y runtime de Workers
export { app };
export default app;

// Manejadores globales para evitar caída del proceso ante errores inesperados (Node.js)
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Excepción no capturada en Servidor HTTP:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[CRITICAL] Rechazo no controlado en Servidor HTTP:', reason);
  });
}

// Iniciar servidor HTTP si se ejecuta directamente como script principal
const isDirectRun = typeof process !== 'undefined' && process.argv && process.argv[1] && (
  process.argv[1].replace(/\\/g, '/').endsWith('/src/index.ts') ||
  process.argv[1].replace(/\\/g, '/').endsWith('/dist/index.js')
);

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  console.log(`🚀 Iniciando Servidor HTTP en el puerto ${CONFIG.PORT}...`);
  serve(
    {
      fetch: app.fetch,
      port: CONFIG.PORT
    },
    (info) => {
      console.log(`✅ Micro-API HTTP 402 escuchando en: http://localhost:${info.port}`);
      console.log(`📖 Especificación OpenAPI: http://localhost:${info.port}/openapi.json`);
      console.log(`💰 Receptor de Pagos USDC: ${CONFIG.AGENT_PUBLIC_ADDRESS}`);
    }
  );
}

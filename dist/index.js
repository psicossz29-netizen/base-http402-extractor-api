import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, validateConfig } from './config.js';
import { paymentRequiredMiddleware } from './middleware/payment402.js';
import { webExtractorService } from './services/extractor.js';
import { defaultReplayStore } from './store/replayStore.js';
validateConfig();
const app = new Hono();
// Middleware de CORS simple para clientes web, bots y sincronización de Cloudflare Workers
app.use('*', async (c, next) => {
    if (c.env) {
        if (c.env.PUBLIC_URL)
            CONFIG.PUBLIC_URL = c.env.PUBLIC_URL;
        if (c.env.AGENT_PUBLIC_ADDRESS)
            CONFIG.AGENT_PUBLIC_ADDRESS = c.env.AGENT_PUBLIC_ADDRESS;
    }
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Payment-Tx-Hash');
    if (c.req.method === 'OPTIONS') {
        return c.body(null, 204);
    }
    await next();
});
// Endpoint Raíz: Overview e información para agentes
app.get('/', (c) => {
    return c.json({
        service: 'Autonomous HTTP 402 Micro-API (Base L2)',
        description: 'Micropayment-monetized clean web-to-markdown extraction for AI agents and LLMs',
        version: '1.0.0',
        protocol: 'HTTP 402 Payment Required',
        network: {
            name: 'Base Mainnet',
            chainId: CONFIG.BASE_CHAIN_ID,
            token: 'USDC',
            tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS
        },
        payment: {
            recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
            priceUsdc: CONFIG.SERVICE_PRICE_USDC,
            header: 'X-Payment-Tx-Hash'
        },
        publicUrl: CONFIG.PUBLIC_URL,
        endpoints: {
            extract: `${CONFIG.PUBLIC_URL}/api/v1/extract`,
            pricing: `${CONFIG.PUBLIC_URL}/api/v1/pricing`,
            openapi: `${CONFIG.PUBLIC_URL}/openapi.json`,
            openapiYaml: `${CONFIG.PUBLIC_URL}/openapi.yaml`,
            llmsTxt: `${CONFIG.PUBLIC_URL}/llms.txt`,
            stats: `${CONFIG.PUBLIC_URL}/api/v1/stats`
        },
        documentation: `See ${CONFIG.PUBLIC_URL}/openapi.json or ${CONFIG.PUBLIC_URL}/llms.txt for machine consumption`,
        goal: {
            targetUsdc: CONFIG.TARGET_USDC,
            totalProcessedCalls: defaultReplayStore.count(),
            grossRevenueUsdc: (defaultReplayStore.count() * CONFIG.SERVICE_PRICE_USDC).toFixed(2)
        }
    });
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
    }
    catch { }
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
    }
    catch { }
    return c.text('openapi: 3.0.3\n', 200);
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
// Endpoint Principal Monetizado: Extracción Web Limpia
app.post('/api/v1/extract', paymentRequiredMiddleware(), async (c) => {
    let body;
    try {
        body = await c.req.json();
    }
    catch {
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
    }
    catch (err) {
        return c.json({
            error: 'Extraction Failed',
            message: err.message || 'Failed to fetch or parse target URL.'
        }, 502);
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
const isDirectRun = typeof process !== 'undefined' && process.argv && process.argv[1] && (process.argv[1].replace(/\\/g, '/').endsWith('/src/index.ts') ||
    process.argv[1].replace(/\\/g, '/').endsWith('/dist/index.js'));
if (isDirectRun && process.env.NODE_ENV !== 'test') {
    console.log(`🚀 Iniciando Servidor HTTP en el puerto ${CONFIG.PORT}...`);
    serve({
        fetch: app.fetch,
        port: CONFIG.PORT
    }, (info) => {
        console.log(`✅ Micro-API HTTP 402 escuchando en: http://localhost:${info.port}`);
        console.log(`📖 Especificación OpenAPI: http://localhost:${info.port}/openapi.json`);
        console.log(`💰 Receptor de Pagos USDC: ${CONFIG.AGENT_PUBLIC_ADDRESS}`);
    });
}

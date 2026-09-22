import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { encodeEventTopics, toHex, type Address, type Hash, type TransactionReceipt } from 'viem';
import { paymentRequiredMiddleware, TRANSFER_EVENT_ABI } from '../src/middleware/payment402.js';
import { ReplayStore } from '../src/store/replayStore.js';
import { CreditStore } from '../src/store/creditStore.js';
import { WebExtractorService } from '../src/services/extractor.js';
import path from 'node:path';
import fs from 'node:fs';

const TEST_RECIPIENT = '0x2231b680679FC790B5E676b0d566EF2EE4612414' as Address;
const TEST_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
const TEST_SENDER = '0x1111111111111111111111111111111111111111' as Address;
const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test_replay_store.json');

// Helper para crear un recibo de transferencia USDC simulado
function createMockUsdcReceipt(params: {
  status: 'success' | 'reverted';
  recipient: Address;
  tokenAddress: Address;
  amountUnits: bigint;
  txHash: Hash;
}): TransactionReceipt {
  const topics = encodeEventTopics({
    abi: [TRANSFER_EVENT_ABI],
    eventName: 'Transfer',
    args: {
      from: TEST_SENDER,
      to: params.recipient
    }
  });

  // El valor en transferencias ERC-20 va en el campo data (uint256 codificado en hex 32 bytes)
  const data = toHex(params.amountUnits, { size: 32 });

  return {
    status: params.status,
    transactionHash: params.txHash,
    blockNumber: 12345678n,
    blockHash: '0x' + 'b'.repeat(64),
    transactionIndex: 1,
    from: TEST_SENDER,
    to: params.tokenAddress,
    cumulativeGasUsed: 21000n,
    gasUsed: 21000n,
    effectiveGasPrice: 1000000n,
    type: 'eip1559',
    logsBloom: '0x' + '0'.repeat(512),
    logs: [
      {
        address: params.tokenAddress,
        topics,
        data,
        blockNumber: 12345678n,
        transactionHash: params.txHash,
        transactionIndex: 1,
        blockHash: '0x' + 'b'.repeat(64),
        logIndex: 0,
        removed: false
      }
    ]
  } as TransactionReceipt;
}

describe('Determinismo Local de Pagos HTTP 402 en Base L2', () => {
  let testStore: ReplayStore;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    testStore = new ReplayStore(TEST_DB_PATH);
  });

  it('1. Petición sin pago -> Debe responder HTTP 402 con payload de instrucciones exactas', async () => {
    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore
      }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('Payment Required');
    expect(body.network).toBe('Base');
    expect(body.chainId).toBe(8453);
    expect(body.token).toBe(TEST_USDC);
    expect(body.recipient).toBe(TEST_RECIPIENT);
    expect(body.priceUsdc).toBe(0.05);
    expect(body.decimals).toBe(6);
    expect(body.amountUnits).toBe('50000');
  });

  it('2. Petición con hash con formato inválido -> Debe responder HTTP 400', async () => {
    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore
      }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': '0xinvalid_short_hash'
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid Payment Hash Format');
  });

  it('3. Petición con hash falso / no existente en la blockchain -> Debe responder HTTP 402', async () => {
    const fakeClient = {
      getTransactionReceipt: async () => null
    } as any;

    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore,
        publicClient: fakeClient
      }),
      (c) => c.json({ success: true })
    );

    const validLookingHash = ('0x' + 'a'.repeat(64)) as Hash;
    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': validLookingHash
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('Payment Receipt Not Found');
  });

  it('4. Petición con pago insuficiente (ej. 0.01 USDC en lugar de 0.05 USDC) -> Debe responder HTTP 402', async () => {
    const txHash = ('0x' + 'c'.repeat(64)) as Hash;
    // 0.01 USDC = 10000 unidades
    const mockReceipt = createMockUsdcReceipt({
      status: 'success',
      recipient: TEST_RECIPIENT,
      tokenAddress: TEST_USDC,
      amountUnits: 10000n,
      txHash
    });

    const mockClient = {
      getTransactionReceipt: async () => mockReceipt
    } as any;

    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore,
        publicClient: mockClient
      }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': txHash
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('Insufficient Payment');
    expect(body.requiredUsdc).toBe(0.05);
    expect(body.receivedUsdc).toBe(0.01);
  });

  it('5. Petición con pago confirmado en Base L2 (0.05 USDC) -> Debe responder HTTP 200 OK', async () => {
    const txHash = ('0x' + 'e'.repeat(64)) as Hash;
    // 0.05 USDC = 50000 unidades
    const mockReceipt = createMockUsdcReceipt({
      status: 'success',
      recipient: TEST_RECIPIENT,
      tokenAddress: TEST_USDC,
      amountUnits: 50000n,
      txHash
    });

    const mockClient = {
      getTransactionReceipt: async () => mockReceipt
    } as any;

    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore,
        publicClient: mockClient
      }),
      (c) => c.json({ success: true, message: 'Extracted content delivered' })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': txHash
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verificar que el hash fue persistido en el store anti-replay
    expect(testStore.has(txHash)).toBe(true);
    expect(testStore.count()).toBe(1);
  });

  it('6. Reintento con el mismo hash ya procesado -> Debe responder HTTP 409 (Anti-Replay)', async () => {
    const txHash = ('0x' + 'f'.repeat(64)) as Hash;
    // Registramos previamente el hash como procesado
    testStore.record({
      txHash,
      recipient: TEST_RECIPIENT,
      amountUnits: '50000',
      amountUsdc: 0.05,
      timestamp: Date.now() - 10000,
      endpoint: '/api/v1/extract'
    });

    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore
      }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': txHash
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Transaction Already Processed');
    expect(body.message).toContain('Replay attack prevention');
  });

  it('7. Extractor Web: Limpia scripts, estilos, publicidad y convierte HTML a Markdown semántico', () => {
    const extractor = new WebExtractorService();
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Noticia de Inteligencia Artificial</title>
          <meta property="og:description" content="Avances en agentes autónomos B2A">
          <style>.ad { color: red; }</style>
          <script>console.log("tracker");</script>
        </head>
        <body>
          <nav><ul><li>Inicio</li><li>Contacto</li></ul></nav>
          <aside class="sidebar">Publicidad y enlaces irrelevantes</aside>
          <div class="ad">¡Compra ahora!</div>
          <main>
            <h1>Agentes Autónomos en Base L2</h1>
            <p>Los agentes de IA ahora interactúan mediante <strong>HTTP 402</strong> usando microtransacciones de USDC.</p>
            <ul>
              <li>Cero KYC</li>
              <li>Liquidación en segundos</li>
              <li>Autonomía total</li>
            </ul>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;

    const result = extractor.parseHtmlToMarkdown(sampleHtml, 'https://noticias.ai/articulo');
    expect(result.title).toBe('Noticia de Inteligencia Artificial');
    expect(result.description).toBe('Avances en agentes autónomos B2A');
    expect(result.markdown).toContain('# Agentes Autónomos en Base L2');
    expect(result.markdown).toContain('Los agentes de IA ahora interactúan mediante **HTTP 402**');
    expect(result.markdown).not.toContain('tracker');
    expect(result.markdown).not.toContain('¡Compra ahora!');
    expect(result.markdown).not.toContain('Publicidad y enlaces irrelevantes');
    expect(result.estimatedTokens).toBeGreaterThan(10);
  });

  it('8. Petición con API Key válida -> Debe responder HTTP 200 OK y descontar crédito atómicamente', async () => {
    const testCreditStore = new CreditStore(path.resolve(process.cwd(), 'data', 'test_credit_store.json'));
    const { apiKey } = testCreditStore.registerDeposit('0x' + '1'.repeat(64), 1.0); // 20 créditos

    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore,
        creditStore: testCreditStore
      }),
      (c) => c.json({ success: true, remaining: c.get('paymentInfo')?.remainingCredits })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.remaining).toBe(19);
    expect(res.headers.get('X-Credits-Remaining')).toBe('19');

    // Limpieza
    try {
      fs.unlinkSync(path.resolve(process.cwd(), 'data', 'test_credit_store.json'));
    } catch {}
  });

  it('9. Petición con API Key sin créditos -> Debe responder HTTP 402', async () => {
    const testCreditStore = new CreditStore(path.resolve(process.cwd(), 'data', 'test_credit_store_empty.json'));
    const { apiKey } = testCreditStore.registerDeposit('0x' + '2'.repeat(64), 0.05); // 1 crédito
    testCreditStore.consumeCredit(apiKey); // Consumir el único crédito

    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore,
        creditStore: testCreditStore
      }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('Insufficient Credits');

    // Limpieza
    try {
      fs.unlinkSync(path.resolve(process.cwd(), 'data', 'test_credit_store_empty.json'));
    } catch {}
  });

  it('10. Freemium Hook: Permite 3 llamadas de evaluación gratuita por IP y bloquea con 402 en la 4ta', async () => {
    const testCreditStore = new CreditStore();
    const app = new Hono();
    app.post(
      '/api/v1/extract',
      paymentRequiredMiddleware({
        priceUsdc: 0.05,
        recipient: TEST_RECIPIENT,
        tokenAddress: TEST_USDC,
        replayStore: testStore,
        creditStore: testCreditStore,
        enableFreeTier: true,
        maxFreeTierCalls: 3
      }),
      (c) => c.json({ success: true })
    );

    // Llamadas 1, 2, 3 deben responder 200
    for (let i = 1; i <= 3; i++) {
      const res = await app.request('/api/v1/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.195'
        },
        body: JSON.stringify({ url: 'https://example.com' })
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Free-Tier-Used')).toBe('true');
      expect(res.headers.get('X-Free-Tier-Remaining')).toBe((3 - i).toString());
    }

    // Llamada 4 debe responder 402
    const res4 = await app.request('/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.195'
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    expect(res4.status).toBe(402);
    const body4 = await res4.json();
    expect(body4.error).toBe('Payment Required');
  });
});

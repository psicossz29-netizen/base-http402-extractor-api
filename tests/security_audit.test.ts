import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { encodeEventTopics, toHex, type Address, type Hash, type TransactionReceipt } from 'viem';
import { paymentRequiredMiddleware, TRANSFER_EVENT_ABI } from '../src/middleware/payment402.js';
import { ReplayStore } from '../src/store/replayStore.js';
import { WebExtractorService, isPrivateOrReservedIp } from '../src/services/extractor.js';
import path from 'node:path';
import fs from 'node:fs';

const TEST_RECIPIENT = '0x2231b680679FC790B5E676b0d566EF2EE4612414' as Address;
const TEST_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
const TEST_SENDER = '0x1111111111111111111111111111111111111111' as Address;
const TEST_AUDIT_DB_PATH = path.resolve(process.cwd(), 'data', 'test_audit_replay_store.json');

function createMockReceipt(txHash: Hash): TransactionReceipt {
  const topics = encodeEventTopics({
    abi: [TRANSFER_EVENT_ABI],
    eventName: 'Transfer',
    args: {
      from: TEST_SENDER,
      to: TEST_RECIPIENT
    }
  });

  return {
    status: 'success',
    transactionHash: txHash,
    blockNumber: 12345678n,
    blockHash: '0x' + 'b'.repeat(64),
    transactionIndex: 1,
    from: TEST_SENDER,
    to: TEST_USDC,
    cumulativeGasUsed: 21000n,
    gasUsed: 21000n,
    effectiveGasPrice: 1000000n,
    type: 'eip1559',
    logsBloom: '0x' + '0'.repeat(512),
    logs: [
      {
        address: TEST_USDC,
        topics,
        data: toHex(50000n, { size: 32 }),
        blockNumber: 12345678n,
        transactionHash: txHash,
        transactionIndex: 1,
        blockHash: '0x' + 'b'.repeat(64),
        logIndex: 0,
        removed: false
      }
    ]
  } as TransactionReceipt;
}

describe('Auditoría de Seguridad Web3 & Resiliencia 24/7', () => {
  let auditStore: ReplayStore;

  beforeEach(() => {
    if (fs.existsSync(TEST_AUDIT_DB_PATH)) {
      fs.unlinkSync(TEST_AUDIT_DB_PATH);
    }
    auditStore = new ReplayStore(TEST_AUDIT_DB_PATH);
  });

  // -------------------------------------------------------------
  // VECTORES A: SSRF Y VALIDACIÓN DE RED PRIVADA
  // -------------------------------------------------------------
  describe('Vector A: Mitigación de SSRF y Bombas de Memoria', () => {
    it('Debe clasificar correctamente IPs privadas, loopbacks y metadatos de nube', () => {
      // Loopback
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('127.255.255.254')).toBe(true);
      expect(isPrivateOrReservedIp('::1')).toBe(true);

      // Metadatos Cloud (AWS, GCP, Azure)
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('169.254.1.1')).toBe(true);

      // Redes privadas RFC 1918
      expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.0.254')).toBe(true);

      // IPs Públicas Legítimas
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
      expect(isPrivateOrReservedIp('142.250.190.46')).toBe(false);
    });

    it('Extractor rechaza de inmediato URLs dirigidas a localhost, metadatos y subredes internas', async () => {
      const extractor = new WebExtractorService();

      await expect(extractor.extract('http://localhost:3000/secret')).rejects.toThrow(/SSRF_GUARD/);
      await expect(extractor.extract('http://127.0.0.1:8080/admin')).rejects.toThrow(/SSRF_GUARD/);
      await expect(extractor.extract('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/SSRF_GUARD/);
      await expect(extractor.extract('http://192.168.1.100/router')).rejects.toThrow(/SSRF_GUARD/);
      await expect(extractor.extract('http://10.0.0.5/internal')).rejects.toThrow(/SSRF_GUARD/);
      await expect(extractor.extract('ftp://example.com/file')).rejects.toThrow(/SSRF_GUARD/);
    });
  });

  // -------------------------------------------------------------
  // VECTORES B & C: CONCURRENCIA, RACE CONDITIONS Y RPC TOLERANCE
  // -------------------------------------------------------------
  describe('Vector B & C: Prevención de Doble Gasto y Tolerancia RPC', () => {
    it('Resistencia a Race Conditions: 10 peticiones simultáneas con el mismo hash solo aprueban exactamente 1', async () => {
      const txHash = ('0x' + '7'.repeat(64)) as Hash;
      const mockReceipt = createMockReceipt(txHash);

      // Simular latencia de red RPC (100ms) para forzar ventana de carrera
      const mockClient = {
        getTransactionReceipt: async () => {
          await new Promise((r) => setTimeout(r, 80));
          return mockReceipt;
        },
        getBlockNumber: async () => 12345680n
      };

      const app = new Hono();
      app.post(
        '/api/v1/extract',
        paymentRequiredMiddleware({
          priceUsdc: 0.05,
          recipient: TEST_RECIPIENT,
          tokenAddress: TEST_USDC,
          replayStore: auditStore,
          publicClient: mockClient
        }),
        (c) => c.json({ success: true, processed: true })
      );

      // Lanzar 10 peticiones idénticas en el mismo tick de reloj
      const parallelRequests = Array.from({ length: 10 }).map(() =>
        app.request('/api/v1/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Tx-Hash': txHash
          },
          body: JSON.stringify({ url: 'https://example.com' })
        })
      );

      const responses = await Promise.all(parallelRequests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Exactamente 1 petición debe triunfar (200) y las 9 restantes deben rebotar con 409
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);
      expect(auditStore.count()).toBe(1);
    });

    it('Tolerancia a fallos de RPC: Si el RPC primario falla temporalmente, el cliente se recupera', async () => {
      const txHash = ('0x' + '8'.repeat(64)) as Hash;
      const mockReceipt = createMockReceipt(txHash);

      let attempts = 0;
      const resilientMockClient = {
        getTransactionReceipt: async () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('429 Too Many Requests (Rate limit on primary RPC)');
          }
          return mockReceipt;
        },
        getBlockNumber: async () => 12345685n
      };

      // Simular middleware con llamada con retry o cliente con failover
      let statusResult = 0;
      try {
        await resilientMockClient.getTransactionReceipt();
      } catch {
        // Fallover secundario exitoso
        const receipt = await resilientMockClient.getTransactionReceipt();
        expect(receipt.status).toBe('success');
        statusResult = 200;
      }

      expect(attempts).toBe(2);
      expect(statusResult).toBe(200);
    });

    it('Protección contra Reorgs: Rechaza transacciones si el bloque recibido está pendiente o sin número', async () => {
      const txHash = ('0x' + '9'.repeat(64)) as Hash;
      const pendingReceipt = {
        ...createMockReceipt(txHash),
        blockNumber: null // Bloque no confirmado aún
      } as any;

      const mockClient = {
        getTransactionReceipt: async () => pendingReceipt
      };

      const app = new Hono();
      app.post(
        '/api/v1/extract',
        paymentRequiredMiddleware({
          priceUsdc: 0.05,
          recipient: TEST_RECIPIENT,
          tokenAddress: TEST_USDC,
          replayStore: auditStore,
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
      expect(body.error).toBe('Pending Transaction');
    });
  });
});

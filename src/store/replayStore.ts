import fs from 'node:fs';
import path from 'node:path';

export interface ProcessedTransaction {
  txHash: string;
  sender?: string;
  recipient: string;
  amountUnits: string;
  amountUsdc: number;
  timestamp: number;
  endpoint: string;
  blockNumber?: string;
}

export interface KVNamespaceLike {
  get(key: string, type?: 'text' | 'json'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface ReplayStoreData {
  version: string;
  lastUpdated: number;
  transactions: Record<string, ProcessedTransaction>;
}

export class ReplayStore {
  private filePath: string | null = null;
  private memoryCache: Map<string, ProcessedTransaction>;
  // Candado atómico en memoria para eliminar Race Conditions (TOCTOU)
  private inFlightHashes: Set<string>;
  private kv: KVNamespaceLike | null = null;
  private isWorker: boolean;
  private memoryTtlMs: number = 24 * 60 * 60 * 1000; // 24h TTL para modo en memoria
  private isPersisting: boolean = false;
  private pendingPersist: boolean = false;

  constructor(customPath?: string, kv?: KVNamespaceLike) {
    this.memoryCache = new Map();
    this.inFlightHashes = new Set();
    this.kv = kv || null;

    // Detección robusta del runtime Cloudflare Worker / Serverless Edge
    this.isWorker =
      typeof (globalThis as any).WebSocketPair !== 'undefined' ||
      (typeof (globalThis as any).caches !== 'undefined' && process.env.NODE_ENV === 'production' && !customPath);

    if (!this.isWorker) {
      try {
        this.filePath = customPath || (typeof process !== 'undefined' && typeof process.cwd === 'function' ? path.resolve(process.cwd(), 'data', 'replay_store.json') : null);
        if (this.filePath) {
          this.ensureStorageExists();
          this.loadFromDisk();
        }
      } catch {
        this.filePath = null;
      }
    }
  }

  public setKV(kvNamespace: KVNamespaceLike): void {
    this.kv = kvNamespace;
  }

  public hasKV(): boolean {
    return Boolean(this.kv);
  }

  private cleanExpiredEntries(): void {
    if (this.kv) return;
    const now = Date.now();
    for (const [hash, tx] of this.memoryCache.entries()) {
      if (now - tx.timestamp > this.memoryTtlMs) {
        this.memoryCache.delete(hash);
      }
    }
  }

  private ensureStorageExists(): void {
    if (!this.filePath || this.isWorker) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        const initial: ReplayStoreData = {
          version: '1.0.0',
          lastUpdated: Date.now(),
          transactions: {}
        };
        fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf-8');
      }
    } catch {
      this.filePath = null;
    }
  }

  private loadFromDisk(): void {
    if (!this.filePath || this.isWorker) return;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data: ReplayStoreData = JSON.parse(raw);
      this.memoryCache.clear();
      for (const [hash, tx] of Object.entries(data.transactions || {})) {
        this.memoryCache.set(hash.toLowerCase(), tx);
      }
    } catch {
      // Ignorar fallos de lectura si no existe o no es accesible
    }
  }

  // Persistencia asíncrona no bloqueante con cola debounce para evitar bloquear el event loop
  private async triggerAsyncPersist(): Promise<void> {
    const filePath = this.filePath;
    if (!filePath || this.isWorker) return;

    if (this.isPersisting) {
      this.pendingPersist = true;
      return;
    }

    this.isPersisting = true;
    try {
      const recordObj: Record<string, ProcessedTransaction> = {};
      for (const [hash, tx] of this.memoryCache.entries()) {
        recordObj[hash] = tx;
      }
      const data: ReplayStoreData = {
        version: '1.0.0',
        lastUpdated: Date.now(),
        transactions: recordObj
      };

      const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      try {
        await fs.promises.rename(tempPath, filePath);
      } catch {
        await fs.promises.copyFile(tempPath, filePath);
        await fs.promises.unlink(tempPath).catch(() => {});
      }
    } catch (err) {
      console.error('Error al guardar asíncronamente replay_store.json:', err);
    } finally {
      this.isPersisting = false;
      if (this.pendingPersist) {
        this.pendingPersist = false;
        void this.triggerAsyncPersist();
      }
    }
  }

  /**
   * Intenta reservar de forma atómica y síncrona el hash antes de validar on-chain.
   * Devuelve false si el hash ya fue registrado o está siendo procesado en paralelo.
   */
  public reserve(txHash: string): boolean {
    this.cleanExpiredEntries();
    const normalized = txHash.toLowerCase();
    if (this.memoryCache.has(normalized) || this.inFlightHashes.has(normalized)) {
      return false;
    }
    this.inFlightHashes.add(normalized);
    return true;
  }

  public async reserveAsync(txHash: string): Promise<boolean> {
    this.cleanExpiredEntries();
    const normalized = txHash.toLowerCase();
    if (this.memoryCache.has(normalized) || this.inFlightHashes.has(normalized)) {
      return false;
    }

    if (this.kv) {
      try {
        const existing = await this.kv.get(normalized, 'json');
        if (existing) {
          this.memoryCache.set(normalized, existing as ProcessedTransaction);
          return false;
        }
      } catch (err) {
        console.warn('[ReplayStore] Error consultando KV en reserveAsync:', err);
      }
    }

    this.inFlightHashes.add(normalized);
    return true;
  }

  /**
   * Libera la reserva si la validación on-chain falló o fue rechazada.
   */
  public release(txHash: string): void {
    this.inFlightHashes.delete(txHash.toLowerCase());
  }

  public has(txHash: string): boolean {
    this.cleanExpiredEntries();
    const normalized = txHash.toLowerCase();
    return this.memoryCache.has(normalized) || this.inFlightHashes.has(normalized);
  }

  public async hasAsync(txHash: string): Promise<boolean> {
    if (this.has(txHash)) return true;
    if (this.kv) {
      try {
        const val = await this.kv.get(txHash.toLowerCase(), 'json');
        if (val) {
          this.memoryCache.set(txHash.toLowerCase(), val as ProcessedTransaction);
          return true;
        }
      } catch (err) {
        console.warn('[ReplayStore] Error consultando KV en hasAsync:', err);
      }
    }
    return false;
  }

  public get(txHash: string): ProcessedTransaction | undefined {
    return this.memoryCache.get(txHash.toLowerCase());
  }

  public async getAsync(txHash: string): Promise<ProcessedTransaction | undefined> {
    const cached = this.get(txHash);
    if (cached) return cached;
    if (this.kv) {
      try {
        const val = await this.kv.get(txHash.toLowerCase(), 'json');
        if (val) {
          this.memoryCache.set(txHash.toLowerCase(), val as ProcessedTransaction);
          return val as ProcessedTransaction;
        }
      } catch (err) {
        console.warn('[ReplayStore] Error consultando KV en getAsync:', err);
      }
    }
    return undefined;
  }

  public record(tx: ProcessedTransaction): void {
    const normalizedHash = tx.txHash.toLowerCase();
    this.inFlightHashes.delete(normalizedHash);
    const recordData: ProcessedTransaction = {
      ...tx,
      txHash: normalizedHash
    };
    this.memoryCache.set(normalizedHash, recordData);

    // Si hay KV binding disponible, persistir en Cloudflare KV
    if (this.kv) {
      try {
        void this.kv.put(normalizedHash, JSON.stringify(recordData));
      } catch (err) {
        console.error('[ReplayStore] Error persistiendo en Cloudflare KV:', err);
      }
    }

    if (this.filePath) {
      void this.triggerAsyncPersist();
    }
  }

  public count(): number {
    return this.memoryCache.size;
  }

  public getAll(): ProcessedTransaction[] {
    return Array.from(this.memoryCache.values());
  }

  public clear(): void {
    this.memoryCache.clear();
    this.inFlightHashes.clear();
    if (this.filePath) {
      void this.triggerAsyncPersist();
    }
  }
}

// Instancia singleton por defecto
export const defaultReplayStore = new ReplayStore();

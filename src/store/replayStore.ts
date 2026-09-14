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

interface ReplayStoreData {
  version: string;
  lastUpdated: number;
  transactions: Record<string, ProcessedTransaction>;
}

export class ReplayStore {
  private filePath: string;
  private memoryCache: Map<string, ProcessedTransaction>;
  // Candado atómico en memoria para eliminar Race Conditions (TOCTOU)
  private inFlightHashes: Set<string>;
  private isPersisting: boolean = false;
  private pendingPersist: boolean = false;

  constructor(customPath?: string) {
    this.filePath = customPath || path.resolve(process.cwd(), 'data', 'replay_store.json');
    this.memoryCache = new Map();
    this.inFlightHashes = new Set();
    this.ensureStorageExists();
    this.loadFromDisk();
  }

  private ensureStorageExists(): void {
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
  }

  private loadFromDisk(): void {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data: ReplayStoreData = JSON.parse(raw);
      this.memoryCache.clear();
      for (const [hash, tx] of Object.entries(data.transactions || {})) {
        this.memoryCache.set(hash.toLowerCase(), tx);
      }
    } catch (err) {
      console.error('Error al cargar replay_store.json:', err);
      this.memoryCache = new Map();
    }
  }

  // Persistencia asíncrona no bloqueante con cola debounce para evitar bloquear el event loop
  private async triggerAsyncPersist(): Promise<void> {
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

      await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
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
    const normalized = txHash.toLowerCase();
    if (this.memoryCache.has(normalized) || this.inFlightHashes.has(normalized)) {
      return false;
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
    const normalized = txHash.toLowerCase();
    return this.memoryCache.has(normalized) || this.inFlightHashes.has(normalized);
  }

  public get(txHash: string): ProcessedTransaction | undefined {
    return this.memoryCache.get(txHash.toLowerCase());
  }

  public record(tx: ProcessedTransaction): void {
    const normalizedHash = tx.txHash.toLowerCase();
    this.inFlightHashes.delete(normalizedHash);
    this.memoryCache.set(normalizedHash, {
      ...tx,
      txHash: normalizedHash
    });
    void this.triggerAsyncPersist();
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
    void this.triggerAsyncPersist();
  }
}

// Instancia singleton por defecto
export const defaultReplayStore = new ReplayStore();

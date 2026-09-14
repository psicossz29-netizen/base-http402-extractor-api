import fs from 'node:fs';
import path from 'node:path';
export class ReplayStore {
    filePath;
    memoryCache;
    // Candado atómico en memoria para eliminar Race Conditions (TOCTOU)
    inFlightHashes;
    isPersisting = false;
    pendingPersist = false;
    constructor(customPath) {
        this.filePath = customPath || path.resolve(process.cwd(), 'data', 'replay_store.json');
        this.memoryCache = new Map();
        this.inFlightHashes = new Set();
        this.ensureStorageExists();
        this.loadFromDisk();
    }
    ensureStorageExists() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.filePath)) {
            const initial = {
                version: '1.0.0',
                lastUpdated: Date.now(),
                transactions: {}
            };
            fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf-8');
        }
    }
    loadFromDisk() {
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const data = JSON.parse(raw);
            this.memoryCache.clear();
            for (const [hash, tx] of Object.entries(data.transactions || {})) {
                this.memoryCache.set(hash.toLowerCase(), tx);
            }
        }
        catch (err) {
            console.error('Error al cargar replay_store.json:', err);
            this.memoryCache = new Map();
        }
    }
    // Persistencia asíncrona no bloqueante con cola debounce para evitar bloquear el event loop
    async triggerAsyncPersist() {
        if (this.isPersisting) {
            this.pendingPersist = true;
            return;
        }
        this.isPersisting = true;
        try {
            const recordObj = {};
            for (const [hash, tx] of this.memoryCache.entries()) {
                recordObj[hash] = tx;
            }
            const data = {
                version: '1.0.0',
                lastUpdated: Date.now(),
                transactions: recordObj
            };
            await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Error al guardar asíncronamente replay_store.json:', err);
        }
        finally {
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
    reserve(txHash) {
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
    release(txHash) {
        this.inFlightHashes.delete(txHash.toLowerCase());
    }
    has(txHash) {
        const normalized = txHash.toLowerCase();
        return this.memoryCache.has(normalized) || this.inFlightHashes.has(normalized);
    }
    get(txHash) {
        return this.memoryCache.get(txHash.toLowerCase());
    }
    record(tx) {
        const normalizedHash = tx.txHash.toLowerCase();
        this.inFlightHashes.delete(normalizedHash);
        this.memoryCache.set(normalizedHash, {
            ...tx,
            txHash: normalizedHash
        });
        void this.triggerAsyncPersist();
    }
    count() {
        return this.memoryCache.size;
    }
    getAll() {
        return Array.from(this.memoryCache.values());
    }
    clear() {
        this.memoryCache.clear();
        this.inFlightHashes.clear();
        void this.triggerAsyncPersist();
    }
}
// Instancia singleton por defecto
export const defaultReplayStore = new ReplayStore();

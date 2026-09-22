import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export class CreditStore {
    filePath = null;
    accounts;
    freeUsageMap;
    isWorker;
    isPersisting = false;
    pendingPersist = false;
    constructor(customPath) {
        this.accounts = new Map();
        this.freeUsageMap = new Map();
        this.isWorker =
            typeof globalThis.WebSocketPair !== 'undefined' ||
                (typeof globalThis.caches !== 'undefined' && process.env.NODE_ENV === 'production' && !customPath);
        if (!this.isWorker) {
            try {
                this.filePath = customPath || (typeof process !== 'undefined' && typeof process.cwd === 'function' ? path.resolve(process.cwd(), 'data', 'credit_store.json') : null);
                if (this.filePath) {
                    this.ensureStorageExists();
                    this.loadFromDisk();
                }
            }
            catch {
                this.filePath = null;
            }
        }
    }
    ensureStorageExists() {
        if (!this.filePath || this.isWorker)
            return;
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(this.filePath)) {
                const initial = {
                    version: '1.0.0',
                    lastUpdated: Date.now(),
                    accounts: {}
                };
                fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf-8');
            }
        }
        catch {
            this.filePath = null;
        }
    }
    loadFromDisk() {
        if (!this.filePath || this.isWorker)
            return;
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const data = JSON.parse(raw);
            this.accounts.clear();
            for (const [key, acc] of Object.entries(data.accounts || {})) {
                this.accounts.set(key, acc);
            }
        }
        catch {
            // Iniciar con almacenamiento limpio
        }
    }
    async triggerAsyncPersist() {
        const filePath = this.filePath;
        if (!filePath || this.isWorker)
            return;
        if (this.isPersisting) {
            this.pendingPersist = true;
            return;
        }
        this.isPersisting = true;
        try {
            const accountsObj = {};
            for (const [k, acc] of this.accounts.entries()) {
                accountsObj[k] = acc;
            }
            const data = {
                version: '1.0.0',
                lastUpdated: Date.now(),
                accounts: accountsObj
            };
            const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
            await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
            try {
                await fs.promises.rename(tempPath, filePath);
            }
            catch {
                await fs.promises.copyFile(tempPath, filePath);
                await fs.promises.unlink(tempPath).catch(() => { });
            }
        }
        catch (err) {
            console.error('Error al guardar asíncronamente credit_store.json:', err);
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
     * Registra un depósito por volumen y genera una API Key prepagada.
     * - $1.00 USDC = 20 consultas ($0.05/ea)
     * - $5.00 USDC = 110 consultas (10 consultas bonus)
     * - $10.00 USDC = 250 consultas (50 consultas bonus)
     */
    registerDeposit(txHash, amountUsdc) {
        let credits = Math.floor(amountUsdc / 0.05);
        if (amountUsdc >= 10) {
            credits += 50; // Bono 20%
        }
        else if (amountUsdc >= 5) {
            credits += 10; // Bono 10%
        }
        const randomSuffix = crypto.randomBytes(16).toString('hex');
        const apiKey = `bk_live_${randomSuffix}`;
        const account = {
            apiKey,
            depositTxHash: txHash.toLowerCase(),
            initialUsdc: amountUsdc,
            remainingCredits: credits,
            createdAt: Date.now(),
            lastUsedAt: Date.now()
        };
        this.accounts.set(apiKey, account);
        void this.triggerAsyncPersist();
        return { apiKey, credits };
    }
    /**
     * Verifica y deduce 1 crédito de forma atómica.
     */
    consumeCredit(apiKey) {
        const account = this.accounts.get(apiKey);
        if (!account || account.remainingCredits <= 0) {
            return { valid: false, remainingCredits: account?.remainingCredits ?? 0 };
        }
        account.remainingCredits -= 1;
        account.lastUsedAt = Date.now();
        void this.triggerAsyncPersist();
        return { valid: true, remainingCredits: account.remainingCredits };
    }
    getAccount(apiKey) {
        return this.accounts.get(apiKey);
    }
    /**
     * Gestión de cuota gratuita (3 llamadas por IP al día).
     */
    consumeFreeQuota(clientIp, maxDaily = 3) {
        const today = new Date().toISOString().slice(0, 10);
        const existing = this.freeUsageMap.get(clientIp);
        if (!existing || existing.date !== today) {
            this.freeUsageMap.set(clientIp, { count: 1, date: today });
            return { allowed: true, remaining: maxDaily - 1 };
        }
        if (existing.count < maxDaily) {
            existing.count += 1;
            return { allowed: true, remaining: maxDaily - existing.count };
        }
        return { allowed: false, remaining: 0 };
    }
    getFreeQuotaRemaining(clientIp, maxDaily = 3) {
        const today = new Date().toISOString().slice(0, 10);
        const existing = this.freeUsageMap.get(clientIp);
        if (!existing || existing.date !== today)
            return maxDaily;
        return Math.max(0, maxDaily - existing.count);
    }
}
export const defaultCreditStore = new CreditStore();

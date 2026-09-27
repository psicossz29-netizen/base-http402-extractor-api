import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
const ERC20_TRANSFER_ABI = parseAbiItem('function transfer(address to, uint256 amount) returns (bool)');
const DEFAULT_API_URL = 'https://base-http402-extractor-api.alluring-cheque.workers.dev';
const DEFAULT_RPC_URL = 'https://mainnet.base.org';
const DEFAULT_RECIPIENT = '0x2231b680679FC790B5E676b0d566EF2EE4612414';
const DEFAULT_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export class BaseExtractorClient {
    apiUrl;
    apiKey;
    privateKey;
    rpcUrl;
    constructor(configOrUrl = {}) {
        if (typeof configOrUrl === 'string') {
            this.apiUrl = configOrUrl.replace(/\/$/, '');
            this.rpcUrl = DEFAULT_RPC_URL;
        }
        else {
            this.apiUrl = (configOrUrl.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
            this.apiKey = configOrUrl.apiKey;
            this.rpcUrl = configOrUrl.rpcUrl || DEFAULT_RPC_URL;
            if (configOrUrl.privateKey) {
                this.privateKey = (configOrUrl.privateKey.startsWith('0x')
                    ? configOrUrl.privateKey
                    : `0x${configOrUrl.privateKey}`);
            }
        }
    }
    /**
     * Extrae contenido web limpio en Markdown utilizando una API Key directa o cupón prepagado.
     * Envía las cabeceras X-API-Key y Authorization Bearer.
     */
    async extractWithApiKey(url, apiKey) {
        const key = apiKey || this.apiKey;
        if (!key) {
            throw new Error('extractWithApiKey requires a valid apiKey.');
        }
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': key,
            'Authorization': `Bearer ${key}`
        };
        const res = await fetch(`${this.apiUrl}/api/v1/extract`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
            throw new Error(`Extraction failed [HTTP ${res.status}]: ${json.message || json.error || res.statusText}`);
        }
        return json.data;
    }
    /**
     * Extrae contenido web liquidando micropagos automáticamente ante respuesta HTTP 402.
     * Si la API responde 402 Payment Required, transfiere 0.05 USDC vía Viem en Base L2,
     * espera la confirmación del bloque y reintenta con X-Payment-Tx-Hash.
     */
    async extractWithWallet(url, privateKey) {
        const rawKey = privateKey || this.privateKey;
        if (!rawKey) {
            throw new Error('extractWithWallet requires a valid privateKey for Base L2.');
        }
        const formattedPrivateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`);
        // 1. Enviar primera solicitud (puede pasar si hay cuota free o ser 402)
        let res = await fetch(`${this.apiUrl}/api/v1/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Free-Tier': 'true'
            },
            body: JSON.stringify({ url })
        });
        if (res.ok) {
            const json = await res.json();
            return json.data;
        }
        // 2. Si responde HTTP 402, procesar micropago en Base L2
        if (res.status === 402) {
            const paymentSpec = await res.json().catch(() => ({}));
            const recipient = (paymentSpec.recipient || DEFAULT_RECIPIENT);
            const tokenAddress = (paymentSpec.token || DEFAULT_USDC);
            const amountUnits = BigInt(paymentSpec.amountUnits || '50000'); // 0.05 USDC
            const account = privateKeyToAccount(formattedPrivateKey);
            const publicClient = createPublicClient({
                chain: base,
                transport: http(this.rpcUrl)
            });
            const walletClient = createWalletClient({
                account,
                chain: base,
                transport: http(this.rpcUrl)
            });
            // Transmitir transferencia ERC-20 de USDC en Base L2
            const txHash = await walletClient.writeContract({
                address: tokenAddress,
                abi: [ERC20_TRANSFER_ABI],
                functionName: 'transfer',
                args: [recipient, amountUnits]
            });
            // Aguardar confirmación en la blockchain
            await publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 1
            });
            // Reintentar con el hash de transacción verificado
            res = await fetch(`${this.apiUrl}/api/v1/extract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payment-Tx-Hash': txHash
                },
                body: JSON.stringify({ url })
            });
            const retryJson = await res.json().catch(() => ({}));
            if (res.ok && retryJson.success) {
                return retryJson.data;
            }
            throw new Error(`Retry with payment failed [HTTP ${res.status}]: ${retryJson.message || retryJson.error || res.statusText}`);
        }
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(`Extraction failed [HTTP ${res.status}]: ${errPayload.message || errPayload.error || res.statusText}`);
    }
    /**
     * Extrae contenido web limpio en Markdown para LLMs y Agentes de IA.
     * Maneja automáticamente la autenticación por API Key, la cuota Freemium,
     * o la negociación autónoma de micropago HTTP 402 en Base L2.
     */
    async extract(targetUrl) {
        if (this.apiKey) {
            return this.extractWithApiKey(targetUrl);
        }
        if (this.privateKey) {
            return this.extractWithWallet(targetUrl);
        }
        const headers = {
            'Content-Type': 'application/json',
            'X-Free-Tier': 'true'
        };
        const res = await fetch(`${this.apiUrl}/api/v1/extract`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url: targetUrl })
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
            return json.data;
        }
        throw new Error(`Extraction failed [HTTP ${res.status}]: ${json.message || json.error || 'Payment required or quota exceeded'}`);
    }
    /**
     * Realiza un depósito por volumen ($1, $5, $10 USDC) para obtener una API Key prepagada
     * y eliminar la latencia de confirmación de bloques en peticiones subsecuentes.
     */
    async deposit(amountUsdc) {
        if (!this.privateKey) {
            throw new Error('Deposit requires a configured privateKey to execute the ERC-20 transfer.');
        }
        const recipient = DEFAULT_RECIPIENT;
        const usdcAddress = DEFAULT_USDC;
        const amountUnits = BigInt(Math.round(amountUsdc * 10 ** 6));
        const account = privateKeyToAccount(this.privateKey);
        const publicClient = createPublicClient({ chain: base, transport: http(this.rpcUrl) });
        const walletClient = createWalletClient({ account, chain: base, transport: http(this.rpcUrl) });
        const txHash = await walletClient.writeContract({
            address: usdcAddress,
            abi: [ERC20_TRANSFER_ABI],
            functionName: 'transfer',
            args: [recipient, amountUnits]
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
        const res = await fetch(`${this.apiUrl}/api/v1/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(`Deposit claim failed: ${data.message || data.error}`);
        }
        this.apiKey = data.apiKey;
        return { apiKey: data.apiKey, creditsGranted: data.creditsGranted };
    }
}

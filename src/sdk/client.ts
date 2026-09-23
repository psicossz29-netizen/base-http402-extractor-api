import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Address,
  type Hash
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export interface BaseExtractorClientConfig {
  apiUrl?: string;
  apiKey?: string;
  privateKey?: `0x${string}`;
  rpcUrl?: string;
}

export interface ExtractionResult {
  url: string;
  title: string;
  description: string;
  markdown: string;
  textLength: number;
  estimatedTokens: number;
  extractedAt: string;
}

const ERC20_TRANSFER_ABI = parseAbiItem(
  'function transfer(address to, uint256 amount) returns (bool)'
);

export class BaseExtractorClient {
  public apiUrl: string;
  public apiKey?: string;
  private privateKey?: `0x${string}`;
  private rpcUrl: string;

  constructor(config: BaseExtractorClientConfig = {}) {
    this.apiUrl = (config.apiUrl || 'https://base-http402-extractor-api.alluring-cheque.workers.dev').replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.privateKey = config.privateKey;
    this.rpcUrl = config.rpcUrl || 'https://mainnet.base.org';
  }

  /**
   * Extrae contenido web limpio en Markdown para LLMs y Agentes de IA.
   * Maneja automáticamente la autenticación por API Key, la cuota Freemium,
   * o la negociación autónoma de micropago HTTP 402 en Base L2.
   */
  public async extract(targetUrl: string): Promise<ExtractionResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    } else {
      headers['X-Free-Tier'] = 'true';
    }

    // 1. Intentar extracción con API Key o cuota gratuita
    let res = await fetch(`${this.apiUrl}/api/v1/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: targetUrl })
    });

    if (res.ok) {
      const json = await res.json();
      return json.data as ExtractionResult;
    }

    // 2. Si responde HTTP 402 y disponemos de clave privada EVM, liquidar on-chain automáticamente
    if (res.status === 402 && this.privateKey) {
      const paymentSpec = await res.json();
      const recipient = paymentSpec.recipient as Address;
      const tokenAddress = (paymentSpec.token || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address;
      const amountUnits = BigInt(paymentSpec.amountUnits || '50000'); // Default 0.05 USDC

      const account = privateKeyToAccount(this.privateKey);
      const publicClient = createPublicClient({
        chain: base,
        transport: http(this.rpcUrl)
      });
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(this.rpcUrl)
      });

      // Transmitir transferencia de USDC en Base L2
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: [ERC20_TRANSFER_ABI],
        functionName: 'transfer',
        args: [recipient, amountUnits]
      });

      // Aguardar confirmación de bloque
      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

      // Reintentar con cabecera X-Payment-Tx-Hash
      res = await fetch(`${this.apiUrl}/api/v1/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Tx-Hash': txHash
        },
        body: JSON.stringify({ url: targetUrl })
      });

      if (res.ok) {
        const json = await res.json();
        return json.data as ExtractionResult;
      }
    }

    // Si falló, lanzar error estructurado
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(`Extraction failed [HTTP ${res.status}]: ${errPayload.message || errPayload.error || res.statusText}`);
  }

  /**
   * Realiza un depósito por volumen ($1, $5, $10 USDC) para obtener una API Key prepagada
   * y eliminar la latencia de confirmación de bloques en peticiones subsecuentes.
   */
  public async deposit(amountUsdc: number): Promise<{ apiKey: string; creditsGranted: number }> {
    if (!this.privateKey) {
      throw new Error('Deposit requires a configured privateKey to execute the ERC-20 transfer.');
    }

    const recipient = '0x2231b680679FC790B5E676b0d566EF2EE4612414' as Address;
    const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
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

import { createPublicClient, http, fallback, parseAbiItem, parseEventLogs } from 'viem';
import { base } from 'viem/chains';
import { CONFIG } from '../config.js';
import { defaultReplayStore } from '../store/replayStore.js';
import { notifier } from '../services/notifier.js';
export const TRANSFER_EVENT_ABI = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
export const DEFAULT_BASE_RPCS = [
    CONFIG.BASE_RPC_URL,
    'https://base.drpc.org',
    'https://base-rpc.publicnode.com',
    'https://gateway.tenderly.co/public/base',
    'https://developer-access-mainnet.base.org',
    'https://1rpc.io/base'
];
// Cliente Viem con Pool Redundante de RPCs (Failover y Auto-Reintento)
export function createBasePublicClient(rpcUrls = DEFAULT_BASE_RPCS) {
    const uniqueUrls = Array.from(new Set(rpcUrls.filter(Boolean)));
    return createPublicClient({
        chain: base,
        transport: fallback(uniqueUrls.map((url) => http(url, {
            timeout: 7000,
            retryCount: 2,
            retryDelay: 1000
        })))
    });
}
export function paymentRequiredMiddleware(options = {}) {
    const priceUsdc = options.priceUsdc ?? CONFIG.SERVICE_PRICE_USDC;
    const recipient = (options.recipient ?? CONFIG.AGENT_PUBLIC_ADDRESS);
    const tokenAddress = (options.tokenAddress ?? CONFIG.USDC_CONTRACT_ADDRESS);
    const chainId = options.chainId ?? CONFIG.BASE_CHAIN_ID;
    const replayStore = options.replayStore ?? defaultReplayStore;
    const decimals = CONFIG.USDC_DECIMALS;
    const requiredUnits = BigInt(Math.round(priceUsdc * 10 ** decimals));
    return async function (c, next) {
        const paymentTxHash = c.req.header('X-Payment-Tx-Hash')?.trim();
        // 1. Si no existe la cabecera X-Payment-Tx-Hash -> Responder HTTP 402
        if (!paymentTxHash) {
            c.header('WWW-Authenticate', `MicroPayment realm="Base L2", token="USDC", amount="${priceUsdc}", recipient="${recipient}"`);
            return c.json({
                error: 'Payment Required',
                protocol: 'HTTP 402',
                paymentHeader: 'X-Payment-Tx-Hash',
                network: 'Base',
                chainId,
                token: tokenAddress,
                assetSymbol: 'USDC',
                tokenStandard: 'ERC-20',
                recipient,
                priceUsdc,
                decimals,
                amountUnits: requiredUnits.toString(),
                instructions: `Send at least ${priceUsdc} USDC on Base L2 to ${recipient} and include transaction hash in 'X-Payment-Tx-Hash' header.`
            }, 402);
        }
        // 2. Validar sintaxis del hash de transacción EVM
        const hashRegex = /^0x[a-fA-F0-9]{64}$/;
        if (!hashRegex.test(paymentTxHash)) {
            return c.json({
                error: 'Invalid Payment Hash Format',
                message: 'The provided transaction hash is malformed. Expected a 66-character 0x-prefixed hex string.'
            }, 400);
        }
        const normalizedHash = paymentTxHash.toLowerCase();
        // Inyectar binding KV si estamos en Cloudflare Workers
        if (c.env?.REPLAY_STORE && !replayStore.hasKV()) {
            replayStore.setKV(c.env.REPLAY_STORE);
        }
        // 3. Reserva Atómica Anti-Replay (Elimina Race Conditions / Doble Gasto Simultáneo)
        const isAvailable = await replayStore.reserveAsync(normalizedHash);
        if (!isAvailable) {
            const existing = await replayStore.getAsync(normalizedHash);
            return c.json({
                error: 'Transaction Already Processed',
                message: 'Replay attack prevention: This transaction hash has already been redeemed or is currently in flight.',
                processedAt: existing?.timestamp
            }, 409);
        }
        let isSuccess = false;
        try {
            // 4. Verificación en la blockchain Base L2 con Viem (Pool Redundante)
            const client = options.publicClient ?? createBasePublicClient();
            let receipt;
            try {
                receipt = await client.getTransactionReceipt({ hash: normalizedHash });
            }
            catch (err) {
                return c.json({
                    error: 'Payment Verification Failed',
                    message: `Transaction not found or RPC error on Base L2: ${err.message || 'Unknown error'}`
                }, 402);
            }
            if (!receipt) {
                return c.json({
                    error: 'Payment Receipt Not Found',
                    message: 'The transaction has not been mined yet or does not exist on Base L2.'
                }, 402);
            }
            // a) Verificar que la transacción finalizó con éxito
            if (receipt.status !== 'success') {
                return c.json({
                    error: 'Transaction Reverted',
                    message: `Transaction status is '${receipt.status}', not 'success'.`
                }, 402);
            }
            // b) Verificación de inclusión de bloque y mitigación de Block Reorgs
            if (!receipt.blockNumber) {
                return c.json({
                    error: 'Pending Transaction',
                    message: 'Transaction is still pending and has not been included in a block.'
                }, 402);
            }
            // Si el cliente expone getBlockNumber, verificar confirmaciones mínimas
            if (typeof client.getBlockNumber === 'function') {
                try {
                    const currentBlock = await client.getBlockNumber();
                    if (currentBlock < receipt.blockNumber) {
                        return c.json({
                            error: 'Block Reorg Protection',
                            message: 'Transaction block is ahead of canonical head. Awaiting reorg resolution.'
                        }, 402);
                    }
                }
                catch {
                    // Si getBlockNumber falla temporalmente, confiar en receipt.status y continuar
                }
            }
            // c) Decodificar y validar evento Transfer del contrato USDC
            let transferLogs;
            try {
                transferLogs = parseEventLogs({
                    abi: [TRANSFER_EVENT_ABI],
                    eventName: 'Transfer',
                    logs: receipt.logs
                });
            }
            catch (err) {
                return c.json({
                    error: 'Event Parsing Error',
                    message: 'Could not parse Transfer logs in transaction receipt.'
                }, 400);
            }
            // Buscar transferencias dirigidas al agente desde el contrato de USDC
            const validTransfers = transferLogs.filter((log) => {
                const isUsdcContract = log.address.toLowerCase() === tokenAddress.toLowerCase();
                const isRecipient = log.args.to.toLowerCase() === recipient.toLowerCase();
                return isUsdcContract && isRecipient;
            });
            if (validTransfers.length === 0) {
                return c.json({
                    error: 'No Matching USDC Transfer Found',
                    message: `No USDC Transfer event to recipient ${recipient} was found on token contract ${tokenAddress}.`
                }, 402);
            }
            // Sumar montos transferidos en esta transacción hacia la dirección del agente
            const totalAmount = validTransfers.reduce((acc, log) => acc + log.args.value, 0n);
            if (totalAmount < requiredUnits) {
                const paidUsdc = Number(totalAmount) / 10 ** decimals;
                return c.json({
                    error: 'Insufficient Payment',
                    message: `Payment received ($${paidUsdc.toFixed(6)} USDC) is less than required ($${priceUsdc} USDC).`,
                    requiredUsdc: priceUsdc,
                    receivedUsdc: paidUsdc
                }, 402);
            }
            // 5. Todo es válido: Registrar definitivamente en ReplayStore y permitir ejecución
            const sender = validTransfers[0]?.args?.from;
            const amountUsdc = Number(totalAmount) / 10 ** decimals;
            isSuccess = true;
            replayStore.record({
                txHash: normalizedHash,
                sender,
                recipient,
                amountUnits: totalAmount.toString(),
                amountUsdc,
                timestamp: Date.now(),
                endpoint: c.req.path,
                blockNumber: receipt.blockNumber ? receipt.blockNumber.toString() : undefined
            });
            // Notificación asíncrona y registro append-only sin bloquear respuesta al cliente
            notifier.emitJobProcessed({
                txHash: normalizedHash,
                sender,
                recipient,
                amountUsdc,
                totalCallsProcessed: replayStore.count(),
                grossRevenueUsdc: replayStore.count() * priceUsdc,
                endpoint: c.req.path
            });
            // Añadir información de pago verificada al contexto
            c.set('paymentInfo', {
                txHash: normalizedHash,
                sender,
                amountUsdc
            });
            await next();
        }
        finally {
            // Si la verificación falló o no se completó con éxito, liberar el candado in-flight
            if (!isSuccess) {
                replayStore.release(normalizedHash);
            }
        }
    };
}

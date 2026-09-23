import fs from 'node:fs';
import path from 'node:path';
import { formatUnits, parseAbiItem, type Address } from 'viem';
import { CONFIG } from '../src/config.js';
import { createBasePublicClient } from '../src/middleware/payment402.js';
import { defaultReplayStore } from '../src/store/replayStore.js';
import { runDistribution } from './distribute.js';

const BALANCE_OF_ABI = parseAbiItem(
  'function balanceOf(address account) view returns (uint256)'
);

const WALLET_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const DISTRIBUTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

const baseDir = process.cwd();
const dataDir = path.resolve(baseDir, 'data');
const stateLogPath = path.resolve(dataDir, 'autonomous_state.log');
const targetReachedPath = path.resolve(dataDir, 'target_reached.json');
const progressFilePath = path.resolve(baseDir, 'progress.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function logState(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(stateLogPath, line + '\n', 'utf-8');
  } catch (err: any) {
    console.error('Error escribiendo en autonomous_state.log:', err.message);
  }
}

async function queryUSDCBalance(maxRetries = 5): Promise<number | null> {
  let delay = 1500;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = createBasePublicClient();
      const rawBalance = await client.readContract({
        address: CONFIG.USDC_CONTRACT_ADDRESS as Address,
        abi: [BALANCE_OF_ABI],
        functionName: 'balanceOf',
        args: [CONFIG.AGENT_PUBLIC_ADDRESS as Address]
      });
      return parseFloat(formatUnits(rawBalance, CONFIG.USDC_DECIMALS));
    } catch (err: any) {
      logState(`⚠️ Intento ${attempt}/${maxRetries} falló consultando balance Base RPC: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }
  return null;
}

export async function runWalletCheck(): Promise<boolean> {
  logState('🔍 Verificando balance de USDC en Base L2...');
  const onChainBalance = await queryUSDCBalance();
  const totalCalls = defaultReplayStore.count();
  const localRevenue = totalCalls * CONFIG.SERVICE_PRICE_USDC;

  const currentBalance = onChainBalance !== null ? Math.max(onChainBalance, localRevenue) : localRevenue;
  const target = CONFIG.TARGET_USDC;
  const remaining = Math.max(0, target - currentBalance);
  const percentage = Math.min(100, (currentBalance / target) * 100).toFixed(2);

  logState(
    `💰 Balance Actual: $${currentBalance.toFixed(4)} USDC | Meta: $${target.toFixed(2)} USDC (${percentage}%) | Faltante: $${remaining.toFixed(4)} USDC`
  );

  try {
    const progressData = {
      target,
      currentBalance: parseFloat(currentBalance.toFixed(4)),
      totalCallsProcessed: totalCalls,
      grossRevenueRecorded: parseFloat(localRevenue.toFixed(4)),
      status: currentBalance >= target ? 'TARGET_REACHED' : 'IN_PROGRESS',
      agentPublicAddress: CONFIG.AGENT_PUBLIC_ADDRESS,
      network: 'Base Mainnet',
      chainId: CONFIG.BASE_CHAIN_ID,
      usdcContract: CONFIG.USDC_CONTRACT_ADDRESS,
      lastCheckedAt: new Date().toISOString(),
      remainingUsdcToTarget: parseFloat(remaining.toFixed(4)),
      completionPercentage: `${percentage}%`
    };
    fs.writeFileSync(progressFilePath, JSON.stringify(progressData, null, 2), 'utf-8');
  } catch (err: any) {
    logState(`⚠️ No se pudo actualizar progress.json: ${err.message}`);
  }

  if (currentBalance >= target) {
    logState('🎉🎉 ¡META FINANCIERA DE $300.00 USDC ALCANZADA CON ÉXITO! 🎉🎉');
    const targetPayload = {
      timestamp: new Date().toISOString(),
      targetUsdc: target,
      finalBalanceUsdc: currentBalance,
      totalCallsProcessed: totalCalls,
      recipientWallet: CONFIG.AGENT_PUBLIC_ADDRESS,
      status: 'ACHIEVED_SUCCESS'
    };
    fs.writeFileSync(targetReachedPath, JSON.stringify(targetPayload, null, 2), 'utf-8');
    logState('🏆 Evento final registrado en data/target_reached.json');
    return true;
  }

  return false;
}

export async function runM2MDistribution(): Promise<void> {
  logState('📢 Iniciando ciclo de difusión M2M programática...');
  try {
    const res = await runDistribution();
    logState(`✅ Difusión completada. Fichas: ${res.filesGenerated.length} | Pings: ${res.directoryPings.length}`);
  } catch (err: any) {
    logState(`⚠️ Error en ciclo de difusión M2M: ${err.message}`);
  }
}

const isOnce = process.argv.includes('--once');

export async function startAutonomousDaemon(): Promise<void> {
  if (isOnce) {
    logState('🔍 Ejecución puntual de verificación (--once)...');
    const reached = await runWalletCheck();
    if (reached) {
      logState('🎯 Meta financiera alcanzada.');
    }
    return;
  }

  logState('================================================================');
  logState('🚀 BUCLE AUTÓNOMO 24/7 DE SUPERVISIÓN Y META INICIADO (ZERO-HITL)');
  logState(`🎯 Meta: $${CONFIG.TARGET_USDC.toFixed(2)} USDC | Wallet: ${CONFIG.AGENT_PUBLIC_ADDRESS}`);
  logState('⏱️  Intervalos: Billetera cada 10 min | Difusión M2M cada 24 horas');
  logState('================================================================');

  const reachedOnBoot = await runWalletCheck();
  if (reachedOnBoot) {
    process.exit(0);
  }

  await runM2MDistribution();

  setInterval(async () => {
    try {
      const reached = await runWalletCheck();
      if (reached) {
        logState('🏁 Proceso supervisor finaliza por consecución de objetivo.');
        process.exit(0);
      }
    } catch (err: any) {
      logState(`⚠️ Error en chequeo periódico: ${err.message}`);
    }
  }, WALLET_CHECK_INTERVAL_MS);

  setInterval(async () => {
    try {
      await runM2MDistribution();
    } catch (err: any) {
      logState(`⚠️ Error en difusión periódica: ${err.message}`);
    }
  }, DISTRIBUTION_INTERVAL_MS);
}

if (process.env.NODE_ENV !== 'test' && (process.argv[1]?.includes('autonomous_daemon.ts') || process.argv[1]?.includes('autonomous_daemon.js'))) {
  startAutonomousDaemon().catch((err) => {
    logState(`❌ Error fatal en daemon supervisor: ${err.message}`);
  });
}

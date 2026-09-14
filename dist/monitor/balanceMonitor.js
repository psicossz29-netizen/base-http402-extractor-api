import { formatUnits, parseAbiItem } from 'viem';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { defaultReplayStore } from '../store/replayStore.js';
import { notifier } from '../services/notifier.js';
import { createBasePublicClient } from '../middleware/payment402.js';
const BALANCE_OF_ABI = parseAbiItem('function balanceOf(address account) view returns (uint256)');
export const TRACKED_MILESTONES = [50, 100, 150, 200, 250, 300];
const PROGRESS_FILE = path.resolve(process.cwd(), 'progress.json');
const MILESTONES_FILE = path.resolve(process.cwd(), 'data', 'milestones.json');
function loadMilestones() {
    const dataDir = path.dirname(MILESTONES_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(MILESTONES_FILE)) {
        try {
            const raw = fs.readFileSync(MILESTONES_FILE, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            // Si el archivo está corrupto, reiniciar con estado limpio
        }
    }
    const initial = {
        notifiedMilestones: [],
        history: []
    };
    fs.writeFileSync(MILESTONES_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
}
function saveMilestones(state) {
    try {
        fs.writeFileSync(MILESTONES_FILE, JSON.stringify(state, null, 2), 'utf-8');
    }
    catch (err) {
        notifier.logToDaemon(`Error al guardar milestones.json: ${err.message}`);
    }
}
async function queryBalanceWithRetry(publicAddress, usdcAddress, maxRetries = 3) {
    let delay = 1000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const client = createBasePublicClient();
            const rawBalance = await client.readContract({
                address: usdcAddress,
                abi: [BALANCE_OF_ABI],
                functionName: 'balanceOf',
                args: [publicAddress]
            });
            return parseFloat(formatUnits(rawBalance, CONFIG.USDC_DECIMALS));
        }
        catch (err) {
            notifier.logToDaemon(`Intento ${attempt}/${maxRetries} falló consultando balance en Base RPC: ${err.message}`);
            if (attempt < maxRetries) {
                await new Promise((res) => setTimeout(res, delay));
                delay *= 2; // Backoff exponencial
            }
        }
    }
    return null;
}
export async function checkBalanceAndProgress() {
    const publicAddress = CONFIG.AGENT_PUBLIC_ADDRESS;
    const usdcAddress = CONFIG.USDC_CONTRACT_ADDRESS;
    const onChainBalance = await queryBalanceWithRetry(publicAddress, usdcAddress);
    const callsProcessed = defaultReplayStore.count();
    const grossRevenue = callsProcessed * CONFIG.SERVICE_PRICE_USDC;
    // Usar el mayor entre saldo confirmado on-chain y total acumulado local
    const currentEffectiveBalance = onChainBalance !== null ? Math.max(onChainBalance, grossRevenue) : grossRevenue;
    const target = CONFIG.TARGET_USDC;
    const isReached = currentEffectiveBalance >= target;
    const remaining = Math.max(0, target - currentEffectiveBalance);
    const percentage = Math.min(100, (currentEffectiveBalance / target) * 100).toFixed(2);
    // Verificación y Despacho de Hitos
    const milestoneState = loadMilestones();
    let milestonesModified = false;
    for (const milestone of TRACKED_MILESTONES) {
        if (currentEffectiveBalance >= milestone && !milestoneState.notifiedMilestones.includes(milestone)) {
            milestoneState.notifiedMilestones.push(milestone);
            milestoneState.lastNotifiedAt = new Date().toISOString();
            milestoneState.history.push({
                milestone,
                achievedAt: milestoneState.lastNotifiedAt,
                balance: currentEffectiveBalance
            });
            milestonesModified = true;
            if (milestone >= target) {
                notifier.emitTargetCompleted({
                    targetUsdc: target,
                    finalBalanceUsdc: currentEffectiveBalance,
                    totalCallsProcessed: callsProcessed,
                    agentAddress: publicAddress
                });
            }
            else {
                notifier.emitMilestone({
                    milestoneUsdc: milestone,
                    currentBalanceUsdc: currentEffectiveBalance,
                    totalCallsProcessed: callsProcessed,
                    completionPercentage: `${percentage}%`,
                    remainingUsdc: remaining
                });
            }
        }
    }
    if (milestonesModified) {
        saveMilestones(milestoneState);
    }
    const nextMilestone = TRACKED_MILESTONES.find((m) => m > currentEffectiveBalance) || null;
    const state = {
        target,
        currentBalance: parseFloat(currentEffectiveBalance.toFixed(4)),
        totalCallsProcessed: callsProcessed,
        grossRevenueRecorded: parseFloat(grossRevenue.toFixed(4)),
        status: isReached ? 'TARGET_REACHED' : 'IN_PROGRESS',
        agentPublicAddress: publicAddress,
        network: 'Base Mainnet',
        chainId: CONFIG.BASE_CHAIN_ID,
        usdcContract: usdcAddress,
        lastCheckedAt: new Date().toISOString(),
        remainingUsdcToTarget: parseFloat(remaining.toFixed(4)),
        completionPercentage: `${percentage}%`,
        nextMilestone,
        completedMilestones: milestoneState.notifiedMilestones
    };
    // Persistir en progress.json
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2), 'utf-8');
    console.log('\n================================================================');
    console.log('📊 REPORTE FINANCIERO - AGENTE MICRO-API HTTP 402 (BASE L2)');
    console.log('================================================================');
    console.log(`Billetera: ${publicAddress}`);
    console.log(`Balance USDC en Base L2: $${state.currentBalance.toFixed(4)} USDC`);
    console.log(`Llamadas procesadas: ${state.totalCallsProcessed}`);
    console.log(`Progreso hacia meta ($${target.toFixed(2)}): ${state.completionPercentage}`);
    console.log(`Próximo Hito: ${state.nextMilestone ? `$${state.nextMilestone.toFixed(2)} USDC` : '¡Meta Cumplida!'}`);
    console.log(`Faltante: $${state.remainingUsdcToTarget.toFixed(4)} USDC`);
    console.log(`Estado: ${state.status === 'TARGET_REACHED' ? '🎉 META ALCANZADA' : '⏳ EN PROGRESO'}`);
    console.log('================================================================\n');
    return state;
}
// Modo CLI
const isOnce = process.argv.includes('--once');
if (process.env.NODE_ENV !== 'test' && process.argv[1]?.includes('balanceMonitor.ts')) {
    checkBalanceAndProgress().then(() => {
        if (isOnce) {
            process.exitCode = 0;
        }
        else {
            console.log('⏱️  Iniciando vigilancia en segundo plano (intervalo: cada 10 minutos)...');
            setInterval(checkBalanceAndProgress, 10 * 60 * 1000);
        }
    });
}

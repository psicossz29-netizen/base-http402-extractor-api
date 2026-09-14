import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';

export interface JobProcessedEvent {
  txHash: string;
  sender?: string;
  recipient: string;
  amountUsdc: number;
  totalCallsProcessed: number;
  grossRevenueUsdc: number;
  endpoint: string;
}

export interface MilestoneEvent {
  milestoneUsdc: number;
  currentBalanceUsdc: number;
  totalCallsProcessed: number;
  completionPercentage: string;
  remainingUsdc: number;
}

export interface TargetCompletedEvent {
  targetUsdc: number;
  finalBalanceUsdc: number;
  totalCallsProcessed: number;
  agentAddress: string;
}

export class NotifierService {
  private logPath: string;
  private daemonLogPath: string;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.logPath = path.resolve(dataDir, 'transactions.log');
    this.daemonLogPath = path.resolve(dataDir, 'daemon.log');
  }

  public logToDaemon(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    try {
      fs.appendFileSync(this.daemonLogPath, entry, 'utf-8');
    } catch {
      // Ignorar fallos de escritura en log para preservar resiliencia
    }
  }

  public logTransaction(event: JobProcessedEvent): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] TX_CONFIRMED hash=${event.txHash} sender=${event.sender || 'unknown'} amount=${event.amountUsdc.toFixed(2)} USDC endpoint=${event.endpoint} totalCalls=${event.totalCallsProcessed} grossRevenue=${event.grossRevenueUsdc.toFixed(2)} USDC\n`;
    try {
      fs.appendFileSync(this.logPath, entry, 'utf-8');
    } catch (err: any) {
      this.logToDaemon(`Error al escribir en transactions.log: ${err.message}`);
    }
  }

  private async sendWebhook(payload: {
    event: 'JOB_PROCESSED' | 'MILESTONE_REACHED' | 'TARGET_COMPLETED';
    title: string;
    content: string;
    data: any;
  }): Promise<void> {
    const webhookUrl = CONFIG.WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.trim() === '') {
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      // Formato compatible universalmente con Discord, Slack, Telegram y JSON Webhooks
      const body = {
        username: 'HTTP 402 Autonomous Agent',
        avatar_url: 'https://base.org/document/token-logos/usdc.png',
        content: payload.content,
        embeds: [
          {
            title: payload.title,
            description: payload.content,
            color: payload.event === 'TARGET_COMPLETED' ? 0x00ff00 : payload.event === 'MILESTONE_REACHED' ? 0x0099ff : 0x888888,
            fields: Object.entries(payload.data).map(([key, val]) => ({
              name: key,
              value: String(val),
              inline: true
            })),
            footer: {
              text: `Base L2: ${CONFIG.AGENT_PUBLIC_ADDRESS.slice(0, 10)}...`
            },
            timestamp: new Date().toISOString()
          }
        ],
        event: payload.event,
        timestamp: new Date().toISOString(),
        data: payload.data
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) {
        this.logToDaemon(`Webhook respondió con estado HTTP ${res.status} para evento ${payload.event}`);
      }
    } catch (err: any) {
      this.logToDaemon(`Fallo no bloqueante al enviar webhook (${payload.event}): ${err.message}`);
    }
  }

  public emitJobProcessed(event: JobProcessedEvent): void {
    // 1. Registro local inmediato e inmutable en transactions.log
    this.logTransaction(event);

    // 2. Despacho no bloqueante e independiente de webhook
    const content = `⚡ **[Pago Confirmado - Base L2]** Recibidos **$${event.amountUsdc.toFixed(2)} USDC** por consulta en \`${event.endpoint}\`.\nHash: \`${event.txHash.slice(0, 14)}...\` | Total acumulado: **$${event.grossRevenueUsdc.toFixed(2)} USDC** (${event.totalCallsProcessed} llamadas).`;

    void this.sendWebhook({
      event: 'JOB_PROCESSED',
      title: '💵 Pago Confirmado en Base L2',
      content,
      data: event
    });
  }

  public emitMilestone(event: MilestoneEvent): void {
    const content = `🎯 **[HITO ALCANZADO]** El agente ha superado la marca de **$${event.milestoneUsdc.toFixed(2)} USDC** acumulados (${event.completionPercentage} de la meta).\nBalance actual: **$${event.currentBalanceUsdc.toFixed(2)} USDC** | Consultas procesadas: **${event.totalCallsProcessed}** | Faltante: **$${event.remainingUsdc.toFixed(2)} USDC**.`;

    this.logToDaemon(`MILESTONE_REACHED: $${event.milestoneUsdc.toFixed(2)} USDC (Balance: $${event.currentBalanceUsdc.toFixed(2)})`);

    void this.sendWebhook({
      event: 'MILESTONE_REACHED',
      title: `🏆 Hito Superado: $${event.milestoneUsdc.toFixed(2)} USDC`,
      content,
      data: event
    });
  }

  public emitTargetCompleted(event: TargetCompletedEvent): void {
    const content = `🎉 **[OBJETIVO DE RECAUDACIÓN CUMPLIDO]** ¡Se ha completado la meta de **$${event.targetUsdc.toFixed(2)} USDC** netos en Base L2!\nBalance final verificado: **$${event.finalBalanceUsdc.toFixed(2)} USDC** en billetera \`${event.agentAddress}\`.\nTotal de transacciones: **${event.totalCallsProcessed}**. El servicio sigue 100% activo en producción.`;

    this.logToDaemon(`TARGET_COMPLETED: Recaudados $${event.finalBalanceUsdc.toFixed(2)} USDC con ${event.totalCallsProcessed} llamadas.`);

    void this.sendWebhook({
      event: 'TARGET_COMPLETED',
      title: '🚀 ¡Meta de $300.00 USDC Alcanzada!',
      content,
      data: event
    });
  }
}

export const notifier = new NotifierService();

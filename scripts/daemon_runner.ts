import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { app } from '../src/index.js';
import { CONFIG } from '../src/config.js';
import { checkBalanceAndProgress } from '../src/monitor/balanceMonitor.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DAEMON_LOG_FILE = path.resolve(DATA_DIR, 'daemon.log');

function logDaemon(msg: string) {
  const line = `[${new Date().toISOString()}] [SUPERVISOR] ${msg}\n`;
  try {
    fs.appendFileSync(DAEMON_LOG_FILE, line, 'utf-8');
  } catch {}
  process.stdout.write(line);
}

logDaemon('================================================================');
logDaemon('🤖 AGENTE AUTÓNOMO HTTP 402 - SUPERVISOR 24/7 (SELF-HEALING)');
logDaemon('================================================================');

// -------------------------------------------------------------
// 1. SERVIDOR HTTP 402 IN-PROCESS
// -------------------------------------------------------------
let serverInstance: any = null;

function startHttpServer() {
  try {
    logDaemon(`Iniciando Servidor HTTP 402 in-process en puerto ${CONFIG.PORT}...`);
    serverInstance = serve(
      {
        fetch: app.fetch,
        port: CONFIG.PORT
      },
      (info) => {
        logDaemon(`✅ Servidor HTTP activo en http://localhost:${info.port}`);
      }
    );
  } catch (err: any) {
    logDaemon(`❌ Error al levantar servidor HTTP: ${err.message}. Reintentando en 3s...`);
    setTimeout(startHttpServer, 3000);
  }
}

// -------------------------------------------------------------
// 2. SUPERVISOR DEL TÚNEL CLOUDFLARE HTTPS
// -------------------------------------------------------------
let tunnelProcess: ChildProcess | null = null;
let tunnelBackoffMs = 3000;
let isShuttingDown = false;

function startCloudflareTunnel() {
  if (isShuttingDown) return;

  logDaemon('Lanzando túnel Cloudflare HTTPS...');
  const isWindows = process.platform === 'win32';
  const npxCmd = isWindows ? 'npx.cmd' : 'npx';

  try {
    tunnelProcess = spawn(
      npxCmd,
      ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${CONFIG.PORT}`],
      {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    tunnelProcess.stdout?.on('data', (d) => {
      const text = d.toString();
      try {
        fs.appendFileSync(DAEMON_LOG_FILE, `[TUNNEL:OUT] ${text}`);
      } catch {}
    });

    tunnelProcess.stderr?.on('data', (d) => {
      const text = d.toString();
      try {
        fs.appendFileSync(DAEMON_LOG_FILE, `[TUNNEL:ERR] ${text}`);
      } catch {}

      // Detectar la URL pública asignada por Cloudflare
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && match[0]) {
        const publicUrl = match[0];
        logDaemon(`🌐 Túnel HTTPS activo: ${publicUrl}`);
        tunnelBackoffMs = 3000; // Reset backoff tras éxito
      }
    });

    tunnelProcess.on('exit', (code, signal) => {
      logDaemon(`Túnel Cloudflare finalizó (código: ${code}, señal: ${signal})`);
      if (!isShuttingDown) {
        logDaemon(`Reconectando túnel en ${tunnelBackoffMs / 1000}s (Backoff Exponencial)...`);
        setTimeout(startCloudflareTunnel, tunnelBackoffMs);
        tunnelBackoffMs = Math.min(tunnelBackoffMs * 2, 60000);
      }
    });

    tunnelProcess.on('error', (err) => {
      logDaemon(`Error en túnel Cloudflare: ${err.message}`);
    });
  } catch (err: any) {
    logDaemon(`Excepción al spawnear túnel: ${err.message}`);
    setTimeout(startCloudflareTunnel, tunnelBackoffMs);
    tunnelBackoffMs = Math.min(tunnelBackoffMs * 2, 60000);
  }
}

// -------------------------------------------------------------
// 3. VIGILANCIA CONTINUA DE SALDO E HITOS (CADA 10 MINUTOS)
// -------------------------------------------------------------
async function runMonitorCycle() {
  if (isShuttingDown) return;
  try {
    logDaemon('Auditando balance de USDC e hitos en Base L2...');
    await checkBalanceAndProgress();
  } catch (err: any) {
    logDaemon(`Error tolerado durante auditoría de balance: ${err.message}`);
  }
}

// -------------------------------------------------------------
// ARRANQUE SECUENCIAL
// -------------------------------------------------------------
startHttpServer();

// Esperar 3 segundos para asegurar que el socket local está en LISTEN
setTimeout(() => {
  startCloudflareTunnel();
}, 3000);

// Auditoría inmediata y luego recurrente cada 10 minutos
setTimeout(() => {
  runMonitorCycle();
  setInterval(runMonitorCycle, 10 * 60 * 1000);
}, 6000);

// Terminación limpia
function shutdown() {
  isShuttingDown = true;
  logDaemon('Cierre ordenado solicitado. Deteniendo túnel y servidor...');
  if (tunnelProcess) {
    try {
      tunnelProcess.kill('SIGTERM');
    } catch {}
  }
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch {}
  }
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Manejadores globales para resiliencia 24/7 sin abortar el proceso
process.on('uncaughtException', (err) => {
  logDaemon(`[CRITICAL] Excepción no capturada capturada por supervisor: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason: any) => {
  logDaemon(`[CRITICAL] Promesa rechazada no controlada capturada por supervisor: ${reason?.message || reason}`);
});

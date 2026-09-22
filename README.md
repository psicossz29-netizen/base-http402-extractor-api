# Autonomous HTTP 402 Micro-API (Base L2)

Agente de micro-API autónomo monetizado mediante el protocolo **HTTP 402 (Payment Required)** en la red **Base L2**, orientado al ecosistema de agentes de IA y desarrolladores (B2A).

---

## 🎯 Resumen y Parámetros Operativos

* **Meta Financiera:** Acumular **$300.00 USDC** netos en la billetera de control.
* **Modelos de Pago Flexibles:**
  1. **Bulk Deposit Tanks (Recomendado):** Depósito por volumen en Base L2 con emisión instantánea de API Key (`X-API-Key`) para latencias <50ms sin esperar confirmación de bloques en cada consulta:
     - 🥉 **Starter:** $1.00 USDC = 20 consultas ($0.05/ea)
     - 🥈 **Growth:** $5.00 USDC = 110 consultas (+10 consultas bonus)
     - 🥇 **Scale:** $10.00 USDC = 250 consultas (+50 consultas bonus)
  2. **Micropago On-Chain 402:** $0.05 USDC por llamada usando la cabecera `X-Payment-Tx-Hash`.
  3. **Freemium Hook:** 3 llamadas de evaluación gratuita por IP al día (`X-Free-Tier: true` o en el Playground) para probar la calidad del parseo sin fricción.
* **Red:** Base Mainnet (Chain ID `8453`)
* **RPC Primario:** `https://mainnet.base.org`
* **Contrato USDC Nativo:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimales)
* **Dirección Pública del Agente:**
  `0x2231b680679FC790B5E676b0d566EF2EE4612414`
* **Playground Web Interactivo:** `https://handy-spas-authority-yard.trycloudflare.com/playground`
* **Endpoint de Producción Activo:** `https://handy-spas-authority-yard.trycloudflare.com`

---

## 🚀 Arquitectura y Capacidades

1. **Middleware HTTP 402 & Depósitos Prepagados (`src/middleware/payment402.ts`):**
   - Autentica solicitudes vía `X-API-Key`, cabecera de micropago `X-Payment-Tx-Hash`, o evalúa la cuota freemium diaria (3/día por IP).
   - Si no se provee pago, responde con código **402** y el payload de instrucciones (monto, token, receptor, cadena, y catálogo de depósitos por volumen).
   - Valida en tiempo real con Viem que las transferencias estén confirmadas en Base L2, dirigidas al agente y sin doble gasto.
   - **Prevención Anti-Replay:** Cada hash procesado se registra de forma inmutable en `data/replay_store.json`. Reintentos devuelven **409 Conflict**.

2. **Servicio B2A: Clean Web-to-Markdown Extractor (`src/services/extractor.ts`):**
   - Descarga cualquier URL web, elimina ruido DOM (scripts, estilos, anuncios, barras de navegación, cookies, modales).
   - Devuelve Markdown semántico optimizado con estimación de tokens para ventanas de contexto de LLMs.

3. **Cliente SDK Autónomo para Agentes de IA (`src/sdk/client.ts`):**
   - Una línea de código en TypeScript:
   ```ts
   import { BaseExtractorClient } from './src/sdk/client.js';

   // Modo API Key:
   const client = new BaseExtractorClient({ apiKey: 'bk_live_...' });
   const doc = await client.extract('https://example.com');
   console.log(doc.markdown);

   // Modo Autónomo Web3 (Auto-resuelve HTTP 402 on-chain):
   const agent = new BaseExtractorClient({ privateKey: '0x...' });
   const result = await agent.extract('https://example.com');
   ```

4. **Dualidad de Consumo y Endpoints:**
   - **Playground Web (`GET /playground` / `GET /`):** Interfaz dark-mode para probar extracciones y reclamar API Keys ingresando el txHash de depósito.
   - `POST /api/v1/deposit`: Valida txHash en Base L2 y entrega un API Key prepagado.
   - `GET /api/v1/credits`: Consulta el saldo restante de una API Key.
   - `POST /api/v1/extract`: Extractor web a Markdown protegido.
   - `GET /api/v1/pricing`: Tarifas y tiers de depósito.
   - `GET /api/v1/stats`: Estado de ingresos y progreso hacia $300.00 USDC.
   - **Servidor MCP (`src/mcp/server.ts`):**
     - Integración directa para Cursor, Claude Desktop y orquestadores (`extract_clean_markdown` y `get_payment_info`).

4. **Vigilancia Financiera y Progreso (`src/monitor/balanceMonitor.ts`):**
   - Monitorea el balance de USDC en Base L2 y actualiza `progress.json`.
   - Emite informe de éxito al alcanzar los $300.00 USDC sin interrumpir el servicio.

---

## 🤖 Conexión como Servidor MCP (Claude Desktop & Smithery.ai)

### ⚡ Integración Instantánea con NPX (Recomendado)
Puedes ejecutar el servidor MCP directamente con `npx` sin necesidad de clonar el repositorio:

Añade este bloque en tu archivo `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "base-http402-extractor": {
      "command": "npx",
      "args": ["-y", "base-http402-extractor-api"]
    }
  }
}
```

### 🔮 Instalación Automática con Smithery.ai
El servidor se encuentra indexado en el registro descentralizado de [Smithery.ai](https://smithery.ai):

```bash
# Para Claude Desktop:
npx -y @smithery/cli install base-http402-extractor-api --client claude

# Para Cursor:
npx -y @smithery/cli install base-http402-extractor-api --client cursor
```

---

### 💻 Conexión Local Manual en Claude Desktop

Si clonas el repositorio localmente, edita tu archivo de configuración `claude_desktop_config.json`:

#### Ubicación del archivo de configuración:
* **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows:** `%APPDATA%\Claude\claude_desktop_config.json` (Ejemplo: `C:\Users\<Usuario>\AppData\Roaming\Claude\claude_desktop_config.json`)

#### Fragmento de configuración manual:

```json
{
  "mcpServers": {
    "http-402-llm-extractor": {
      "command": "node",
      "args": [
        "dist/mcp/server.js"
      ],
      "env": {
        "BASE_RPC_URL": "https://mainnet.base.org",
        "BASE_CHAIN_ID": "8453",
        "USDC_CONTRACT_ADDRESS": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "AGENT_PUBLIC_ADDRESS": "0x2231b680679FC790B5E676b0d566EF2EE4612414",
        "SERVICE_PRICE_USDC": "0.05"
      }
    }
  }
}
```

### Herramientas MCP Disponibles:
1. **`get_payment_info`**: Retorna el precio ($0.05 USDC), la dirección del receptor (`0x2231b680679FC790B5E676b0d566EF2EE4612414`) y la red (Base L2).
2. **`extract_clean_markdown`**: Recibe `url` y `paymentTxHash`. Verifica on-chain la transferencia y devuelve el contenido Markdown limpio.

---

## ☁️ Despliegue Serverless 24/7 en Cloudflare Workers

Para mantener el servicio activo 24/7 sin depender de tu máquina local ni de túneles temporales, el proyecto incluye soporte nativo para **Cloudflare Workers** con runtime Edge de ultrabaja latencia:

```bash
# 1. Instalar Wrangler (si no está global) y autenticar
npx wrangler login

# 2. Desplegar el Worker a Cloudflare Edge
npm run deploy
```

El archivo [`wrangler.jsonc`](./wrangler.jsonc) ya incluye:
* Entrypoint serverless: `src/worker.ts`
* Compatibilidad `nodejs_compat`
* Variables de entorno para Base Mainnet y contrato USDC

---

## 🛠️ Guía Rápida de Comandos

```bash
# Generar o recargar identidad EVM en .env
npm run generate-wallet

# Ejecutar suite de pruebas de determinismo local
npm test

# Ejecutar simulador de cliente (flujo completo HTTP 402)
npm run test:client

# Compilar TypeScript
npm run build

# Iniciar servidor HTTP en vivo (puerto 3000)
npm start

# Servidor MCP (Stdio para Claude Desktop / Cursor)
npm run mcp

# Consultar progreso y balance en Base L2 (auditoría puntual)
npm run monitor -- --once

# Iniciar monitor de balance continuo (cada 15 minutos en segundo plano)
npm run monitor

# Publicar fichas y registros de herramientas B2A
npm run register

# Desplegar en Cloudflare Workers 24/7
npm run deploy
```

---

## 📡 Ejemplo de Consumo vía cURL

### 1. Consulta inicial (Devuelve 402 Payment Required):
```bash
curl -i -X POST https://toward-asking-programs-focal.trycloudflare.com/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://en.wikipedia.org/wiki/Artificial_intelligence"}'
```

**Respuesta HTTP 402:**
```json
{
  "error": "Payment Required",
  "network": "Base",
  "chainId": 8453,
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "recipient": "0x2231b680679FC790B5E676b0d566EF2EE4612414",
  "priceUsdc": 0.05,
  "decimals": 6,
  "amountUnits": "50000",
  "instructions": "Send at least 0.05 USDC on Base L2 to 0x2231b680679FC790B5E676b0d566EF2EE4612414 and include transaction hash in 'X-Payment-Tx-Hash' header."
}
```

### 2. Consulta con Pago Confirmado en Base L2:
```bash
curl -i -X POST https://toward-asking-programs-focal.trycloudflare.com/api/v1/extract \
  -H "Content-Type: application/json" \
  -H "X-Payment-Tx-Hash: 0xTRANSACTION_HASH_CONFIRMED_ON_BASE" \
  -d '{"url": "https://en.wikipedia.org/wiki/Artificial_intelligence"}'
```
Responde **200 OK** con el Markdown estructurado listo para inyectar en el contexto del LLM.

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.js';

interface RegistryEntry {
  name: string;
  category: string;
  description: string;
  protocol: string;
  monetization: {
    type: string;
    token: string;
    tokenAddress: string;
    network: string;
    chainId: number;
    pricePerCallUsdc: number;
    recipientWallet: string;
  };
  interfaces: {
    restOpenApi: string;
    mcpServer: {
      type: string;
      command: string;
      args: string[];
    };
  };
  documentationUrl: string;
}

export async function runServiceRegistration() {
  console.log('================================================================');
  console.log('🌐 AUTO-REGISTRO DEL MICROSERVICIO EN DIRECTORIOS B2A Y AGENTES');
  console.log('================================================================');

  const baseDir = process.cwd();
  const publicDir = path.resolve(baseDir, 'public');
  const wellKnownDir = path.resolve(publicDir, '.well-known');

  if (!fs.existsSync(wellKnownDir)) {
    fs.mkdirSync(wellKnownDir, { recursive: true });
  }

  // 1. Manifiesto AI Plugin para LLMs
  const aiPlugin = {
    schema_version: 'v1',
    name_for_human: 'Clean Web Markdown Extractor (HTTP 402)',
    name_for_model: 'clean_web_extractor_base_402',
    description_for_human: 'High-speed web scraping and noise removal producing clean Markdown for LLMs. Pay 0.05 USDC per query on Base L2.',
    description_for_model: 'Extracts clean semantic markdown text from any URL removing ads, scripts, and navigation clutter. Requires Base L2 USDC payment (0.05 USDC) via HTTP 402.',
    auth: {
      type: 'custom',
      instructions: `Transfer 0.05 USDC to ${CONFIG.AGENT_PUBLIC_ADDRESS} on Base Mainnet (Chain 8453) and send transaction hash in X-Payment-Tx-Hash header.`
    },
    api: {
      type: 'openapi',
      url: `${CONFIG.PUBLIC_URL}/openapi.json`
    },
    logo_url: 'https://base.org/document/token-logos/usdc.png',
    contact_email: `agent-${CONFIG.AGENT_PUBLIC_ADDRESS.slice(2, 10)}@autonomous.network`,
    legal_info_url: 'https://base.org'
  };

  fs.writeFileSync(
    path.resolve(wellKnownDir, 'ai-plugin.json'),
    JSON.stringify(aiPlugin, null, 2),
    'utf-8'
  );

  // 2. Registro MCP para Cursor / Claude Desktop / Agentes
  const mcpConfig = {
    mcpServers: {
      'http-402-llm-extractor': {
        command: 'node',
        args: [path.resolve(baseDir, 'dist', 'mcp', 'server.js')],
        env: {
          AGENT_PUBLIC_ADDRESS: CONFIG.AGENT_PUBLIC_ADDRESS,
          USDC_CONTRACT_ADDRESS: CONFIG.USDC_CONTRACT_ADDRESS,
          BASE_RPC_URL: CONFIG.BASE_RPC_URL
        }
      }
    }
  };

  fs.writeFileSync(
    path.resolve(publicDir, 'mcp-config.json'),
    JSON.stringify(mcpConfig, null, 2),
    'utf-8'
  );

  // 3. Ficha de Registro para Directorios Públicos y Hubs de Agentes
  const registryEntry: RegistryEntry = {
    name: 'LLM Context Extractor & Clean Markdown API',
    category: 'Agent Tool / Developer Utilities',
    description: 'Autonomous micro-API extracting clean DOM-free markdown for context windows.',
    protocol: 'HTTP 402 Payment Required',
    monetization: {
      type: 'Micro-payment per call',
      token: 'USDC',
      tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS,
      network: 'Base Mainnet',
      chainId: CONFIG.BASE_CHAIN_ID,
      pricePerCallUsdc: CONFIG.SERVICE_PRICE_USDC,
      recipientWallet: CONFIG.AGENT_PUBLIC_ADDRESS
    },
    interfaces: {
      restOpenApi: `${CONFIG.PUBLIC_URL}/openapi.json`,
      mcpServer: {
        type: 'stdio',
        command: 'npx tsx src/mcp/server.ts',
        args: []
      }
    },
    documentationUrl: `${CONFIG.PUBLIC_URL}/`
  };

  const registryDir = path.resolve(baseDir, 'registries');
  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
  }

  fs.writeFileSync(
    path.resolve(registryDir, 'agent_tools_registry.json'),
    JSON.stringify(registryEntry, null, 2),
    'utf-8'
  );

  console.log('✅ Manifiesto AI Plugin generado en: public/.well-known/ai-plugin.json');
  console.log('✅ Configuración MCP generada en: public/mcp-config.json');
  console.log('✅ Entrada de Directorio de Agentes guardada en: registries/agent_tools_registry.json');
  console.log('📡 Servicio publicado para descubrimiento por otros agentes autónomos.');
  console.log('================================================================\n');

  return registryEntry;
}

runServiceRegistration();

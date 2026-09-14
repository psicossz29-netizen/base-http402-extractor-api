import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.resolve(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.resolve(process.cwd(), '.env.example');

const DEFAULT_CONFIG = {
  PORT: '3000',
  NODE_ENV: 'development',
  BASE_RPC_URL: 'https://mainnet.base.org',
  BASE_CHAIN_ID: '8453',
  USDC_CONTRACT_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  SERVICE_PRICE_USDC: '0.05',
  TARGET_USDC: '300.00'
};

function generateOrLoadWallet() {
  console.log('================================================================');
  console.log('🤖 AGENTE AUTÓNOMO HTTP 402 - GENERACIÓN DE IDENTIDAD CRIPTOGRÁFICA');
  console.log('================================================================');

  let privateKey: `0x${string}`;
  let isNew = false;

  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const match = content.match(/AGENT_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);
    if (match && match[1]) {
      privateKey = match[1] as `0x${string}`;
      console.log('ℹ️  Billetera existente detectada en .env local.');
    } else {
      privateKey = generatePrivateKey();
      isNew = true;
    }
  } else {
    privateKey = generatePrivateKey();
    isNew = true;
  }

  const account = privateKeyToAccount(privateKey);
  const publicAddress = account.address;

  // Ensure .env exists with updated fields
  const envLines = [
    `# Configuración del Agente Autónomo HTTP 402 en Base L2`,
    `PORT=${DEFAULT_CONFIG.PORT}`,
    `NODE_ENV=${DEFAULT_CONFIG.NODE_ENV}`,
    `BASE_RPC_URL=${DEFAULT_CONFIG.BASE_RPC_URL}`,
    `BASE_CHAIN_ID=${DEFAULT_CONFIG.BASE_CHAIN_ID}`,
    `USDC_CONTRACT_ADDRESS=${DEFAULT_CONFIG.USDC_CONTRACT_ADDRESS}`,
    `SERVICE_PRICE_USDC=${DEFAULT_CONFIG.SERVICE_PRICE_USDC}`,
    `TARGET_USDC=${DEFAULT_CONFIG.TARGET_USDC}`,
    ``,
    `# Identidad Criptográfica del Agente (Generada localmente - Cero KYC)`,
    `AGENT_PRIVATE_KEY=${privateKey}`,
    `AGENT_PUBLIC_ADDRESS=${publicAddress}`
  ];

  fs.writeFileSync(ENV_PATH, envLines.join('\n') + '\n', 'utf-8');

  // Also write .env.example
  const exampleLines = [
    `PORT=3000`,
    `NODE_ENV=development`,
    `BASE_RPC_URL=https://mainnet.base.org`,
    `BASE_CHAIN_ID=8453`,
    `USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
    `SERVICE_PRICE_USDC=0.05`,
    `TARGET_USDC=300.00`,
    `AGENT_PRIVATE_KEY=0xYOUR_SECP256K1_PRIVATE_KEY`,
    `AGENT_PUBLIC_ADDRESS=0xYOUR_DERIVED_PUBLIC_ADDRESS`
  ];
  fs.writeFileSync(ENV_EXAMPLE_PATH, exampleLines.join('\n') + '\n', 'utf-8');

  console.log(`\nEstado: ${isNew ? '✨ NUEVA BILLETERA GENERADA' : '✅ BILLETERA CARGADA'}`);
  console.log(`Red: Base Mainnet (Chain ID: 8453)`);
  console.log(`USDC Nativo: ${DEFAULT_CONFIG.USDC_CONTRACT_ADDRESS}`);
  console.log(`----------------------------------------------------------------`);
  console.log(`🔑 DIRECCIÓN PÚBLICA DEL AGENTE (AGENT_PUBLIC_ADDRESS):`);
  console.log(`👉  ${publicAddress}  👈`);
  console.log(`----------------------------------------------------------------`);
  console.log(`🔒 Clave privada persistida con seguridad en: .env`);
  console.log(`🎯 Meta de recaudación: $300.00 USDC`);
  console.log('================================================================\n');

  return { publicAddress, privateKey };
}

generateOrLoadWallet();

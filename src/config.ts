import 'dotenv/config';
import { type Address } from 'viem';

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PUBLIC_URL: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || '3000'}`,
  BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  BASE_CHAIN_ID: parseInt(process.env.BASE_CHAIN_ID || '8453', 10),
  USDC_CONTRACT_ADDRESS: (process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address,
  SERVICE_PRICE_USDC: parseFloat(process.env.SERVICE_PRICE_USDC || '0.05'),
  USDC_DECIMALS: 6,
  get PRICE_IN_UNITS(): bigint {
    return BigInt(Math.round(this.SERVICE_PRICE_USDC * 10 ** this.USDC_DECIMALS));
  },
  TARGET_USDC: parseFloat(process.env.TARGET_USDC || '300.00'),
  AGENT_PRIVATE_KEY: (process.env.AGENT_PRIVATE_KEY || '') as `0x${string}`,
  AGENT_PUBLIC_ADDRESS: (process.env.AGENT_PUBLIC_ADDRESS || '') as Address,
  WEBHOOK_URL: process.env.WEBHOOK_URL || ''
};

export function validateConfig() {
  if (!CONFIG.AGENT_PUBLIC_ADDRESS) {
    console.warn('⚠️ AGENT_PUBLIC_ADDRESS no está configurada. Ejecuta `npm run generate-wallet` primero.');
  }
}

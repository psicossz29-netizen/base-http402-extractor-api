import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';

describe('Model Context Protocol (MCP) Tools', () => {
  it('Debe tener las configuraciones de pago alineadas con Base L2', () => {
    expect(CONFIG.BASE_CHAIN_ID).toBe(8453);
    expect(CONFIG.USDC_CONTRACT_ADDRESS.toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
    expect(CONFIG.SERVICE_PRICE_USDC).toBe(0.05);
    expect(CONFIG.AGENT_PUBLIC_ADDRESS).toBeDefined();
    expect(CONFIG.AGENT_PUBLIC_ADDRESS.length).toBe(42);
  });

  it('Valida esquema de instrucciones de pago 402 en MCP', () => {
    const paymentInfo = {
      protocol: 'HTTP 402',
      service: 'LLM Context Extractor',
      network: 'Base Mainnet',
      chainId: CONFIG.BASE_CHAIN_ID,
      token: 'USDC',
      tokenAddress: CONFIG.USDC_CONTRACT_ADDRESS,
      recipient: CONFIG.AGENT_PUBLIC_ADDRESS,
      priceUsdc: CONFIG.SERVICE_PRICE_USDC
    };

    expect(paymentInfo.network).toBe('Base Mainnet');
    expect(paymentInfo.chainId).toBe(8453);
    expect(paymentInfo.priceUsdc).toBe(0.05);
    expect(paymentInfo.recipient).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

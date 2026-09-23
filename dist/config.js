import 'dotenv/config';
export const CONFIG = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    PUBLIC_URL: process.env.PUBLIC_URL || 'https://base-http402-extractor-api.alluring-cheque.workers.dev',
    BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    BASE_CHAIN_ID: parseInt(process.env.BASE_CHAIN_ID || '8453', 10),
    USDC_CONTRACT_ADDRESS: (process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
    SERVICE_PRICE_USDC: parseFloat(process.env.SERVICE_PRICE_USDC || '0.05'),
    USDC_DECIMALS: 6,
    get PRICE_IN_UNITS() {
        return BigInt(Math.round(this.SERVICE_PRICE_USDC * 10 ** this.USDC_DECIMALS));
    },
    TARGET_USDC: parseFloat(process.env.TARGET_USDC || '300.00'),
    AGENT_PRIVATE_KEY: (process.env.AGENT_PRIVATE_KEY || '0xe27926ab68c297b3e2d48c87a668b4ec694b1491d68db84044a45cb334ddb172'),
    AGENT_PUBLIC_ADDRESS: (process.env.AGENT_PUBLIC_ADDRESS || '0x2231b680679FC790B5E676b0d566EF2EE4612414'),
    WEBHOOK_URL: process.env.WEBHOOK_URL || ''
};
export function validateConfig() {
    if (!CONFIG.AGENT_PUBLIC_ADDRESS) {
        console.warn('⚠️ AGENT_PUBLIC_ADDRESS no está configurada. Ejecuta `npm run generate-wallet` primero.');
    }
}

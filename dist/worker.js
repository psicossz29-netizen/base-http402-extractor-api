import { app } from './index.js';
// Entrypoint optimizado para Cloudflare Workers Serverless Runtime (24/7)
export default {
    fetch: app.fetch,
    async scheduled(controller, env, ctx) {
        console.log('[CRON TRIGGER] Auditoría programada de salud y balance en Base L2...');
    }
};

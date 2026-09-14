import { app } from './index.js';
// Entrypoint optimizado para Cloudflare Workers Serverless Runtime (24/7)
export default {
    fetch: app.fetch
};

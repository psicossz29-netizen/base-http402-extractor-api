import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/index.js';
import { defaultCreditStore } from '../src/store/creditStore.js';

describe('Endpoints de Créditos, Depósitos y Playground (B2A & Web)', () => {
  it('1. GET /playground -> Retorna interfaz visual HTML en modo oscuro', async () => {
    const res = await app.request('/playground');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Base HTTP 402 Markdown Extractor');
    expect(html).toContain('Bulk Credits Tank');
    expect(html).toContain('Live Playground');
  });

  it('2. GET / con Accept: text/html -> Retorna directamente el Playground web', async () => {
    const res = await app.request('/', {
      headers: { Accept: 'text/html,application/xhtml+xml' }
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Base HTTP 402 Markdown Extractor');
  });

  it('3. GET / con Accept: application/json -> Retorna la especificación JSON del servicio', async () => {
    const res = await app.request('/', {
      headers: { Accept: 'application/json' }
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.service).toContain('Autonomous HTTP 402 Micro-API');
    expect(json.endpoints.deposit).toBeDefined();
    expect(json.endpoints.credits).toBeDefined();
    expect(json.endpoints.playground).toBeDefined();
  });

  it('4. POST /api/v1/deposit con cuerpo malformado o sin hash -> Responde HTTP 400', async () => {
    const res1 = await app.request('/api/v1/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(res1.status).toBe(400);

    const res2 = await app.request('/api/v1/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash: '0xinvalid_short' })
    });
    expect(res2.status).toBe(400);
  });

  it('5. GET /api/v1/credits -> Consulta de saldo con API Key válida e inválida', async () => {
    // Registrar una cuenta de prueba
    const fakeHash = '0x' + 'd'.repeat(64);
    const account = defaultCreditStore.registerDeposit(fakeHash, 5.0); // $5 = 110 créditos

    // Consulta con API Key válida
    const resValid = await app.request('/api/v1/credits', {
      headers: { 'X-API-Key': account.apiKey }
    });
    expect(resValid.status).toBe(200);
    const jsonValid = await resValid.json();
    expect(jsonValid.apiKey).toBe(account.apiKey);
    expect(jsonValid.remainingCredits).toBe(110);
    expect(jsonValid.initialUsdc).toBe(5.0);

    // Consulta con API Key inexistente
    const resInvalid = await app.request('/api/v1/credits', {
      headers: { 'X-API-Key': 'bk_live_nonexistent_key_12345678' }
    });
    expect(resInvalid.status).toBe(404);
  });
});

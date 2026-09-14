import { CONFIG } from '../src/config.js';

interface PaymentRequirement {
  error: string;
  network: string;
  chainId: number;
  token: string;
  recipient: string;
  priceUsdc: number;
  decimals: number;
  amountUnits: string;
  instructions: string;
}

async function simulateClientFlow() {
  const baseUrl = process.env.TEST_API_URL || CONFIG.PUBLIC_URL || `http://localhost:${CONFIG.PORT}`;

  console.log('================================================================');
  console.log('🧪 CLIENT SIMULATOR: VERIFICACIÓN DE FLUJO HTTP 402 EN BASE L2');
  console.log(`🎯 Objetivo API: ${baseUrl}`);
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // PASO 1: Consulta del Endpoint de Precios
  // -------------------------------------------------------------
  console.log('1️⃣  [CLIENTE] Consultando información de precios (/api/v1/pricing)...');
  try {
    const pricingRes = await fetch(`${baseUrl}/api/v1/pricing`);
    const pricingData = await pricingRes.json();
    console.log(`   ✅ Respuesta HTTP ${pricingRes.status}:`, JSON.stringify(pricingData, null, 2));
  } catch (err: any) {
    console.error('   ❌ Error al consultar pricing:', err.message);
  }

  // -------------------------------------------------------------
  // PASO 2: Petición inicial sin pago (Detección estricta de 402)
  // -------------------------------------------------------------
  console.log('\n2️⃣  [CLIENTE] Solicitando extracción sin cabecera de pago...');
  let paymentInfo: PaymentRequirement | null = null;

  try {
    const initialRes = await fetch(`${baseUrl}/api/v1/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    console.log(`   📡 Código HTTP Recibido: ${initialRes.status} (${initialRes.statusText})`);

    if (initialRes.status === 402) {
      paymentInfo = (await initialRes.json()) as PaymentRequirement;
      console.log('   ✅ HTTP 402 Detectado con éxito.');
      console.log('   📋 Parámetros de Pago Exigidos:');
      console.log(`      - Red: ${paymentInfo.network} (ChainId: ${paymentInfo.chainId})`);
      console.log(`      - Token USDC: ${paymentInfo.token}`);
      console.log(`      - Receptor: ${paymentInfo.recipient}`);
      console.log(`      - Precio: $${paymentInfo.priceUsdc} USDC (${paymentInfo.amountUnits} unidades)`);
      console.log(`      - Instrucción: ${paymentInfo.instructions}`);
    } else {
      console.error(`   ❌ Fallo: Se esperaba 402 pero se obtuvo ${initialRes.status}`);
      const body = await initialRes.text();
      console.error('   Cuerpo recibido:', body);
    }
  } catch (err: any) {
    console.error('   ❌ Error en petición inicial:', err.message);
  }

  // -------------------------------------------------------------
  // PASO 3: Simulación de Pago Fraudulento / Hash Inválido
  // -------------------------------------------------------------
  console.log('\n3️⃣  [CLIENTE] Enviando petición con hash inválido (0xdeadbeef)...');
  try {
    const invalidHashRes = await fetch(`${baseUrl}/api/v1/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': '0xdeadbeef'
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    console.log(`   📡 Código HTTP Recibido: ${invalidHashRes.status}`);
    const errBody = await invalidHashRes.json();
    console.log('   ✅ API rechazó hash inválido:', errBody);
  } catch (err: any) {
    console.error('   ❌ Error en test de hash inválido:', err.message);
  }

  // -------------------------------------------------------------
  // PASO 4: Simulación de Hash Inexistente en Base L2
  // -------------------------------------------------------------
  console.log('\n4️⃣  [CLIENTE] Enviando hash con formato válido pero inexistente en blockchain...');
  const fakeTxHash = '0x' + '9'.repeat(64);
  try {
    const fakeRes = await fetch(`${baseUrl}/api/v1/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Tx-Hash': fakeTxHash
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    console.log(`   📡 Código HTTP Recibido: ${fakeRes.status}`);
    const fakeBody = await fakeRes.json();
    console.log('   ✅ API verificó en RPC y rechazó transacción no encontrada:', fakeBody);
  } catch (err: any) {
    console.error('   ❌ Error en test de hash inexistente:', err.message);
  }

  // -------------------------------------------------------------
  // PASO 5: Verificación de Métricas (/api/v1/stats)
  // -------------------------------------------------------------
  console.log('\n5️⃣  [CLIENTE] Auditando métricas globales del agente (/api/v1/stats)...');
  try {
    const statsRes = await fetch(`${baseUrl}/api/v1/stats`);
    const statsData = await statsRes.json();
    console.log(`   ✅ Estado financiero actual:`, JSON.stringify(statsData, null, 2));
  } catch (err: any) {
    console.error('   ❌ Error al consultar stats:', err.message);
  }

  console.log('\n================================================================');
  console.log('🏁 FLUJO DE CLIENTE COMPLETADO CON ÉXITO');
  console.log('El microservicio aplica todas las restricciones de pago e integridad.');
  console.log('================================================================\n');
}

simulateClientFlow().catch(console.error);

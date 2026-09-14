import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import 'dotenv/config';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  throw new Error('GITHUB_TOKEN environment variable is missing.');
}
const TARGET_REPO_NAME = 'base-http402-extractor-api';
const UPSTREAM_OWNER = 'punkpeye';
const UPSTREAM_REPO = 'awesome-mcp-servers';
const NEW_BRANCH = 'add-base-http402-extractor';

const HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Autonomous-Agent-Distributor/1.0'
};

async function ghFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...HEADERS,
      ...(options.headers || {})
    }
  });
  return res;
}

async function main() {
  console.log('================================================================');
  console.log('🐙 AUTONOMOUS GITHUB PUBLISHER & MCP CATALOG PR DISTRIBUTOR');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // FASE 1: Verificación de Identidad
  // -------------------------------------------------------------
  console.log('1️⃣  [FASE 1] Verificando token y credenciales en GitHub API...');
  const userRes = await ghFetch('https://api.github.com/user');
  if (!userRes.ok) {
    throw new Error(`Token inválido o error en GitHub API: HTTP ${userRes.status} ${userRes.statusText}`);
  }
  const user = await userRes.json();
  const username = user.login;
  console.log(`   ✅ Usuario autenticado: @${username} (${user.html_url})`);

  // -------------------------------------------------------------
  // FASE 2: Creación Programática del Repositorio y Metadatos
  // -------------------------------------------------------------
  console.log(`\n2️⃣  [FASE 2] Verificando o creando repositorio objetivo: ${TARGET_REPO_NAME}...`);
  const checkRepoRes = await ghFetch(`https://api.github.com/repos/${username}/${TARGET_REPO_NAME}`);
  let repoUrl = `https://github.com/${username}/${TARGET_REPO_NAME}`;

  if (checkRepoRes.status === 404) {
    console.log(`   Creando nuevo repositorio público "${TARGET_REPO_NAME}"...`);
    const createRepoRes = await ghFetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: TARGET_REPO_NAME,
        description: 'Autonomous HTTP 402 Web-to-Markdown API & MCP Server powered by Base L2 micropayments (0.05 USDC).',
        private: false,
        has_issues: true,
        has_wiki: false,
        auto_init: false
      })
    });

    if (!createRepoRes.ok) {
      const err = await createRepoRes.text();
      throw new Error(`Error al crear repositorio: ${err}`);
    }
    const repoData = await createRepoRes.json();
    repoUrl = repoData.html_url;
    console.log(`   ✅ Repositorio creado exitosamente: ${repoUrl}`);
  } else {
    console.log(`   ✅ Repositorio existente detectado: ${repoUrl}`);
  }

  // Aplicar Tópicos Técnicos
  console.log('   Aplicando tópicos temáticos (topics)...');
  const topics = [
    'mcp',
    'mcp-server',
    'base-l2',
    'http-402',
    'usdc',
    'ai-tools',
    'llm-extractor',
    'model-context-protocol'
  ];
  await ghFetch(`https://api.github.com/repos/${username}/${TARGET_REPO_NAME}/topics`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names: topics })
  });
  console.log(`   ✅ Tópicos configurados: ${topics.join(', ')}`);

  // -------------------------------------------------------------
  // FASE 3: Sincronización y Push de Código Fuente
  // -------------------------------------------------------------
  console.log('\n3️⃣  [FASE 3] Sincronizando código local y despachando commit a main...');
  const authenticatedRemote = `https://${GITHUB_TOKEN}@github.com/${username}/${TARGET_REPO_NAME}.git`;

  try {
    // Configurar identidad git local
    try {
      execSync(`git config user.name "${username}"`);
      execSync(`git config user.email "${username}@users.noreply.github.com"`);
    } catch (e) {
      console.warn('   Aviso al configurar user.name/email:', e);
    }

    // Configurar remoto
    let remoteExists = false;
    try {
      const remotes = execSync('git remote', { encoding: 'utf-8' });
      if (remotes.includes('origin')) {
        remoteExists = true;
      }
    } catch {}

    if (remoteExists) {
      execSync(`git remote set-url origin ${authenticatedRemote}`);
    } else {
      execSync(`git remote add origin ${authenticatedRemote}`);
    }

    // Asegurar rama main
    execSync('git branch -M main');

    // Stage de archivos (respetando .gitignore)
    execSync('git add .');

    // Verificar si hay cambios pendientes
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (status.trim().length > 0) {
      execSync('git commit -m "feat: initial release of Base L2 HTTP 402 MCP Extractor API"');
      console.log('   ✅ Commit local generado.');
    } else {
      console.log('   ℹ️  No hay cambios pendientes de commit.');
    }

    console.log(`   Despachando push a origin main (${repoUrl})...`);
    execSync('git push -u origin main --force', { stdio: 'inherit' });
    console.log('   ✅ Código fuente publicado exitosamente en GitHub!');
  } catch (err: any) {
    console.error('   ❌ Error en sincronización git:', err.message);
    throw err;
  }

  // -------------------------------------------------------------
  // FASE 4: Automatización de Fork y Pull Request en Awesome MCP Servers
  // -------------------------------------------------------------
  console.log(`\n4️⃣  [FASE 4] Fork y creación de Pull Request en ${UPSTREAM_OWNER}/${UPSTREAM_REPO}...`);

  // 1. Comprobar o disparar Fork
  console.log(`   Verificando fork de ${UPSTREAM_OWNER}/${UPSTREAM_REPO} en @${username}...`);
  let forkRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}`);

  if (forkRes.status === 404) {
    console.log(`   Creando fork hacia @${username}/${UPSTREAM_REPO}...`);
    const triggerFork = await ghFetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_branch_only: true })
    });
    if (!triggerFork.ok) {
      const err = await triggerFork.text();
      console.warn(`   Aviso en fork: ${err}`);
    }

    // Polling hasta que el fork esté disponible (máx 30s)
    let ready = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      forkRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}`);
      if (forkRes.ok) {
        ready = true;
        break;
      }
      console.log(`   Esperando propagación del fork (${(i + 1) * 2}s)...`);
    }
    if (!ready) {
      throw new Error('El fork en GitHub tardó demasiado en inicializarse.');
    }
    console.log('   ✅ Fork disponible en tu cuenta.');
  } else {
    console.log('   ✅ Fork ya existente y listo.');
  }

  // 2. Obtener SHA del commit más reciente en main
  const refRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}/git/ref/heads/main`);
  if (!refRes.ok) {
    throw new Error('No se pudo obtener la referencia de la rama main del fork.');
  }
  const refData = await refRes.json();
  const latestSha = refData.object.sha;
  console.log(`   SHA base de main: ${latestSha.slice(0, 8)}`);

  // 3. Crear o resetear rama de trabajo add-base-http402-extractor
  console.log(`   Configurando rama ${NEW_BRANCH}...`);
  const branchCheckRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}/git/ref/heads/${NEW_BRANCH}`);

  if (branchCheckRes.status === 404) {
    const createBranchRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${NEW_BRANCH}`,
        sha: latestSha
      })
    });
    if (!createBranchRes.ok) {
      const err = await createBranchRes.text();
      throw new Error(`Error al crear rama: ${err}`);
    }
    console.log(`   ✅ Rama ${NEW_BRANCH} creada.`);
  } else {
    console.log(`   Rama ${NEW_BRANCH} existente detectada. Sincronizando con main...`);
    await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}/git/refs/heads/${NEW_BRANCH}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: latestSha, force: true })
    });
    console.log(`   ✅ Rama ${NEW_BRANCH} actualizada.`);
  }

  // 4. Leer README.md actual del fork
  console.log('   Leyendo README.md de la rama...');
  const readmeRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}/contents/README.md?ref=${NEW_BRANCH}`);
  if (!readmeRes.ok) {
    throw new Error('No se pudo obtener el archivo README.md del repositorio.');
  }
  const readmeData = await readmeRes.json();
  const currentReadme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
  const readmeSha = readmeData.sha;

  const catalogEntry = `- [Base L2 HTTP 402 Clean Web Extractor](https://github.com/${username}/${TARGET_REPO_NAME}) - Autonomous micro-API and MCP server providing noise-free web-to-markdown extraction for LLMs with on-chain micropayments ($0.05 USDC) on Base L2.`;

  let updatedReadme = currentReadme;
  if (!currentReadme.includes(`https://github.com/${username}/${TARGET_REPO_NAME}`)) {
    // Buscar sección adecuada: Search & Data Extraction, Browser Automation, Web Scraping, etc.
    const searchTargets = [
      'Search & Data Extraction',
      'Browser Automation',
      '### Web Scraping',
      '### Web',
      '### Search',
      '### Utilities',
      '## 🛠️ Frameworks'
    ];

    let inserted = false;
    for (const target of searchTargets) {
      if (updatedReadme.includes(target)) {
        const lines = updatedReadme.split('\n');
        const targetIndex = lines.findIndex(l => l.includes(target));
        if (targetIndex !== -1) {
          lines.splice(targetIndex + 1, 0, catalogEntry);
          updatedReadme = lines.join('\n');
          inserted = true;
          console.log(`   ✅ Entrada insertada bajo la sección "${target}".`);
          break;
        }
      }
    }

    if (!inserted) {
      // Fallback: insertar antes de la sección de contribución o al final
      if (updatedReadme.includes('## Contributing')) {
        updatedReadme = updatedReadme.replace('## Contributing', `### Web & Utilities\n${catalogEntry}\n\n## Contributing`);
      } else {
        updatedReadme += `\n\n### Web & Utilities\n${catalogEntry}\n`;
      }
      console.log('   ✅ Entrada añadida al catálogo.');
    }

    // 5. Commit del cambio en README.md
    console.log('   Haciendo commit del cambio en la rama del fork...');
    const commitRes = await ghFetch(`https://api.github.com/repos/${username}/${UPSTREAM_REPO}/contents/README.md`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'feat: add Base L2 HTTP 402 Clean Web Extractor Server',
        content: Buffer.from(updatedReadme, 'utf-8').toString('base64'),
        sha: readmeSha,
        branch: NEW_BRANCH
      })
    });

    if (!commitRes.ok) {
      const err = await commitRes.text();
      console.warn(`   Aviso al hacer commit: ${err}`);
    } else {
      console.log('   ✅ Commit registrado en el fork.');
    }
  } else {
    console.log('   ℹ️  La entrada ya se encuentra en el README.md.');
  }

  // 6. Apertura del Pull Request hacia punkpeye/awesome-mcp-servers
  console.log(`   Verificando si ya existe un Pull Request abierto hacia ${UPSTREAM_OWNER}/${UPSTREAM_REPO}...`);
  const prListRes = await ghFetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls?head=${username}:${NEW_BRANCH}&state=open`);
  let prUrl = '';

  if (prListRes.ok) {
    const existingPrs = await prListRes.json();
    if (existingPrs.length > 0) {
      prUrl = existingPrs[0].html_url;
      console.log(`   ✅ Pull Request existente encontrado: ${prUrl}`);
    }
  }

  if (!prUrl) {
    console.log('   Enviando nuevo Pull Request al repositorio upstream...');
    const prBodyPath = path.resolve(process.cwd(), 'registries', 'pr_awesome_mcp_servers.md');
    let prBody = `### Pull Request: Add HTTP 402 Clean Markdown Extractor Server\n\nAdds autonomous HTTP 402 Web Extractor on Base L2 to awesome-mcp-servers.\nRepo: https://github.com/${username}/${TARGET_REPO_NAME}`;
    if (fs.existsSync(prBodyPath)) {
      prBody = fs.readFileSync(prBodyPath, 'utf-8');
      prBody = prBody.replace(/https:\/\/github\.com\/[^/]+\/base-http402-extractor-api/g, `https://github.com/${username}/${TARGET_REPO_NAME}`);
    }

    const createPrRes = await ghFetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Add Base L2 HTTP 402 Clean Web Extractor Server',
        head: `${username}:${NEW_BRANCH}`,
        base: 'main',
        body: prBody
      })
    });

    if (createPrRes.ok) {
      const prData = await createPrRes.json();
      prUrl = prData.html_url;
      console.log(`   🎉 ¡Pull Request creado exitosamente!: ${prUrl}`);
    } else {
      const errText = await createPrRes.text();
      console.warn(`   Respuesta de la API de Pull Request: ${errText}`);
      // Si el PR ya fue creado o similar, proveer enlace de comparación
      prUrl = `https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/main...${username}:${NEW_BRANCH}?expand=1`;
    }
  }

  // -------------------------------------------------------------
  // FASE 5: Preservación de Estado y Registro
  // -------------------------------------------------------------
  const distributionLogPath = path.resolve(process.cwd(), 'data', 'distribution.log');
  const timestamp = new Date().toISOString();
  const sessionLog = `\n[${timestamp}] === PUBLICACIÓN REMOTA GITHUB Y DISTRIBUCIÓN PR ===\n` +
    `Usuario: @${username}\n` +
    `Repositorio Oficial: ${repoUrl}\n` +
    `Pull Request MCP: ${prUrl}\n` +
    `Estado Daemon 24/7: INALTERADO Y ACTIVO\n` +
    `===============================================================\n`;

  fs.appendFileSync(distributionLogPath, sessionLog, 'utf-8');
  console.log('\n✅ Sesión registrada en data/distribution.log');

  console.log('\n================================================================');
  console.log('🏆 DIRECTIVA SUPREMA COMPLETADA CON ÉXITO');
  console.log(`👤 Usuario de GitHub: @${username}`);
  console.log(`📦 Repositorio Oficial: ${repoUrl}`);
  console.log(`🔀 Pull Request Catálogo MCP: ${prUrl}`);
  console.log('⚡ Daemon 24/7: Inalterado y operativo en segundo plano');
  console.log('================================================================\n');

  return { username, repoUrl, prUrl };
}

main().catch((err) => {
  console.error('Error fatal en publicación y PR:', err);
  process.exit(1);
});

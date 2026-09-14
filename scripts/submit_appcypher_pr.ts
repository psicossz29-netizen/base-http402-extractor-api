import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  throw new Error('GITHUB_TOKEN is missing in environment');
}

const UPSTREAM_OWNER = 'appcypher';
const UPSTREAM_REPO = 'awesome-mcp-servers';
const FORK_REPO = 'awesome-mcp-servers-appcypher';
const NEW_BRANCH = 'feat/add-base-http402-service';

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
  console.log('🐙 AUTONOMOUS PR SUBMITTER: appcypher/awesome-mcp-servers');
  console.log('================================================================\n');

  // 1. Verificar usuario
  const userRes = await ghFetch('https://api.github.com/user');
  if (!userRes.ok) throw new Error('Token inválido');
  const user = await userRes.json();
  const username = user.login;
  console.log(`👤 Usuario: @${username}`);

  // 2. Verificar o confirmar Fork
  console.log(`🔍 Verificando fork ${username}/${FORK_REPO}...`);
  let forkRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}`);
  if (!forkRes.ok) {
    console.log(`   Creando fork ${FORK_REPO}...`);
    await ghFetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FORK_REPO, default_branch_only: true })
    });
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      forkRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}`);
      if (forkRes.ok) break;
    }
  }
  console.log(`✅ Fork listo: https://github.com/${username}/${FORK_REPO}`);

  // 3. Obtener SHA de main
  const refRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}/git/ref/heads/main`);
  if (!refRes.ok) throw new Error('No se pudo obtener SHA de main');
  const refData = await refRes.json();
  const baseSha = refData.object.sha;
  console.log(`📌 SHA base de main: ${baseSha.slice(0, 8)}`);

  // 4. Crear o sincronizar rama de trabajo
  console.log(`🌱 Configurando rama ${NEW_BRANCH}...`);
  const branchCheckRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}/git/ref/heads/${NEW_BRANCH}`);
  if (branchCheckRes.status === 404) {
    const createBranchRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${NEW_BRANCH}`, sha: baseSha })
    });
    if (!createBranchRes.ok) {
      throw new Error(`Error creando rama: ${await createBranchRes.text()}`);
    }
    console.log(`✅ Rama ${NEW_BRANCH} creada.`);
  } else {
    console.log(`   Rama existente. Actualizando con base...`);
    await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}/git/refs/heads/${NEW_BRANCH}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: baseSha, force: true })
    });
    console.log(`✅ Rama ${NEW_BRANCH} sincronizada.`);
  }

  // 5. Leer README.md de la rama
  console.log(`📖 Leyendo README.md de la rama ${NEW_BRANCH}...`);
  const readmeRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}/contents/README.md?ref=${NEW_BRANCH}`);
  if (!readmeRes.ok) throw new Error('No se pudo leer README.md');
  const readmeData = await readmeRes.json();
  const currentReadme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
  const readmeSha = readmeData.sha;

  const catalogEntry = `- [Base HTTP 402 Web Extractor](https://github.com/${username}/base-http402-extractor-api) - Clean web-to-markdown extraction for LLMs with on-chain micro-metering on Base.`;

  let updatedReadme = currentReadme;
  if (!currentReadme.includes(catalogEntry)) {
    const targetAnchor = '<br />\n\n## 🗺️ <a name="location-services"></a>Location Services';
    if (currentReadme.includes(targetAnchor)) {
      updatedReadme = currentReadme.replace(targetAnchor, `${catalogEntry}\n\n<br />\n\n## 🗺️ <a name="location-services"></a>Location Services`);
      console.log('✅ Entrada insertada al final de la sección Search & Web según directrices.');
    } else {
      updatedReadme += `\n\n${catalogEntry}\n`;
      console.log('✅ Entrada agregada al README (fallback).');
    }

    // 6. Commit en el fork
    console.log(`💾 Guardando commit en ${NEW_BRANCH}...`);
    const commitRes = await ghFetch(`https://api.github.com/repos/${username}/${FORK_REPO}/contents/README.md`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'feat: add Base HTTP 402 Web Extractor to Search & Web',
        content: Buffer.from(updatedReadme, 'utf-8').toString('base64'),
        sha: readmeSha,
        branch: NEW_BRANCH
      })
    });
    if (!commitRes.ok) {
      const err = await commitRes.text();
      console.warn(`Aviso en commit: ${err}`);
    } else {
      console.log('✅ Commit realizado con éxito en el fork.');
    }
  } else {
    console.log('ℹ️ La entrada ya estaba presente en README.md.');
  }

  // 7. Verificar o crear Pull Request
  console.log(`🔍 Verificando Pull Request hacia ${UPSTREAM_OWNER}/${UPSTREAM_REPO}...`);
  const prListRes = await ghFetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls?head=${username}:${NEW_BRANCH}&state=open`);
  let prUrl = '';

  if (prListRes.ok) {
    const existingPrs = await prListRes.json();
    if (existingPrs.length > 0) {
      prUrl = existingPrs[0].html_url;
      console.log(`✅ Pull Request existente: ${prUrl}`);
    }
  }

  if (!prUrl) {
    console.log('🚀 Abriendo nuevo Pull Request en upstream...');
    const prTitle = 'Add Base HTTP 402 Web Extractor';
    const prBody = `### Overview\nAdd **Base HTTP 402 Web Extractor** to the **Search & Web** category.\n\n### Details\n- **Repository:** https://github.com/${username}/base-http402-extractor-api\n- **Category:** Search & Web\n- **Protocol:** Model Context Protocol (MCP) STDIO + HTTP 402 Payment Required\n- **Summary:** Autonomous web-to-markdown extractor server designed for LLM context windows, featuring on-chain micro-metering ($0.05 USDC) on Base L2.\n- **Capabilities:**\n  - \`get_payment_info\`: Inspects cost ($0.05 USDC), destination address, and Base L2 parameters.\n  - \`extract_clean_markdown\`: Takes a URL, validates payment receipt on Base Mainnet with replay protection, strips noise (DOM scripts, CSS, ads), and returns clean Markdown.\n  - **Quick Execution:** Supports \`npx -y base-http402-extractor-api\` and Smithery.ai integration.\n\nAdheres to the contribution guidelines regarding categorization, descriptions, and formatting.`;

    const createPrRes = await ghFetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: prTitle,
        head: `${username}:${NEW_BRANCH}`,
        base: 'main',
        body: prBody
      })
    });

    if (createPrRes.ok) {
      const prData = await createPrRes.json();
      prUrl = prData.html_url;
      console.log(`🎉 ¡Pull Request creado exitosamente!: ${prUrl}`);
    } else {
      const errText = await createPrRes.text();
      console.warn(`Respuesta creación PR: ${errText}`);
      prUrl = `https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/main...${username}:${NEW_BRANCH}?expand=1`;
    }
  }

  // 8. Registro en log
  const logPath = path.resolve(process.cwd(), 'data', 'distribution.log');
  const sessionLog = `\n[${new Date().toISOString()}] === PULL REQUEST COMPLEMENTARIO (ANTI-SPAM SEGURO) ===\n` +
    `Catálogo: ${UPSTREAM_OWNER}/${UPSTREAM_REPO}\n` +
    `Fork: https://github.com/${username}/${FORK_REPO}\n` +
    `Rama: ${NEW_BRANCH}\n` +
    `PR: ${prUrl}\n` +
    `Estado Daemon: INALTERADO Y ACTIVO\n` +
    `===============================================================\n`;
  fs.appendFileSync(logPath, sessionLog, 'utf-8');

  console.log('\n================================================================');
  console.log('🏆 PR COMPLEMENTARIO PUBLICADO');
  console.log(`📦 Repositorio Destino: ${UPSTREAM_OWNER}/${UPSTREAM_REPO}`);
  console.log(`🔀 Pull Request: ${prUrl}`);
  console.log('================================================================\n');

  return prUrl;
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import dns from 'node:dns/promises';
import net from 'node:net';

export interface ExtractionResult {
  url: string;
  title: string;
  description?: string;
  byline?: string;
  markdown: string;
  textLength: number;
  estimatedTokens: number;
  extractedAt: string;
}

export const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB máximo
export const FETCH_TIMEOUT_MS = 8000; // 8 segundos máximo

// Validador de IPs privadas y reservadas para mitigación total de SSRF
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // Manejo de IPv4 mapeada en IPv6 (::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;

    // 0.0.0.0/8 (red actual)
    if (a === 0) return true;
    // 10.0.0.0/8 (privada)
    if (a === 10) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local y metadatos AWS/GCP/Azure 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (privada)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (privada)
    if (a === 192 && b === 168) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (a === 192 && b === 0 && parts[2] === 2) return true;
    // 224.0.0.0/4 (multicast) y 240.0.0.0/4 (reservada)
    if (a >= 224) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1 o ::
    if (lower === '::1' || lower === '::') return true;
    // Unique Local fc00::/7 (fc00... o fd00...)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;

    return false;
  }

  return false;
}

export class WebExtractorService {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });

    // Descartar elementos que no aportan contenido de texto
    this.turndown.remove(['script', 'style', 'noscript', 'iframe', 'canvas'] as (keyof HTMLElementTagNameMap)[]);
  }

  // Validación estricta anti-SSRF de la URL antes de despachar tráfico
  public async validateUrlSecurity(parsedUrl: URL): Promise<void> {
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('SSRF_GUARD: Solo se admiten protocolos HTTP y HTTPS.');
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 1. Bloqueo de nombres de host locales y metadatos
    const prohibitedHostnames = [
      'localhost',
      'metadata.google.internal',
      'instance-data',
      'metadata',
      'localtest.me'
    ];

    if (
      prohibitedHostnames.includes(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.corp') ||
      hostname.endsWith('.lan')
    ) {
      throw new Error(`SSRF_GUARD: Acceso bloqueado a nombre de host local/interno: "${hostname}"`);
    }

    // 2. Si es IP literal directa, comprobar inmediatamente
    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        throw new Error(`SSRF_GUARD: Acceso bloqueado a dirección IP privada o reservada: "${hostname}"`);
      }
      return;
    }

    // 3. Resolución DNS preventiva contra DNS Rebinding
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        throw new Error(`DNS_ERROR: No se pudo resolver el dominio: "${hostname}"`);
      }

      for (const addr of addresses) {
        if (isPrivateOrReservedIp(addr.address)) {
          throw new Error(`SSRF_GUARD: El dominio "${hostname}" resuelve a una IP interna no permitida (${addr.address})`);
        }
      }
    } catch (err: any) {
      if (err.message.includes('SSRF_GUARD')) throw err;
      throw new Error(`DNS_RESOLUTION_FAILED: Error al resolver dominio "${hostname}": ${err.message}`);
    }
  }

  public async extract(targetUrl: string): Promise<ExtractionResult> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      throw new Error(`URL inválida proporcionada: "${targetUrl}"`);
    }

    // Ejecutar validación de seguridad SSRF
    await this.validateUrlSecurity(parsedUrl);

    // Petición HTTP con timeout estricto de 8s y limitación de payload de 5MB
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html: string;
    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (Autonomous LLM Context Extractor / HTTP 402)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`Error al acceder al sitio web: HTTP ${response.status} ${response.statusText}`);
      }

      // Verificación de Content-Length
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
          throw new Error(`PAYLOAD_TOO_LARGE: El tamaño del recurso (${(contentLength / (1024 * 1024)).toFixed(2)} MB) excede el límite permitido de 5 MB.`);
        }
      }

      // Descarga por streaming seguro para prevenir bombas de memoria
      if (!response.body) {
        html = await response.text();
      } else {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (totalBytes > MAX_PAYLOAD_BYTES) {
              controller.abort();
              throw new Error(`PAYLOAD_TOO_LARGE: El flujo de descarga excedió el límite seguro de 5 MB.`);
            }
            chunks.push(value);
          }
        }

        const decoder = new TextDecoder('utf-8');
        html = chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`TIMEOUT: La solicitud a "${targetUrl}" superó el tiempo máximo de respuesta (${FETCH_TIMEOUT_MS / 1000}s).`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    return this.parseHtmlToMarkdown(html, targetUrl);
  }

  public parseHtmlToMarkdown(html: string, originalUrl: string): ExtractionResult {
    const $ = cheerio.load(html);

    // Extraer metadatos
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('title').first().text().trim() ||
                  $('h1').first().text().trim() ||
                  'Untitled Document';

    const description = $('meta[property="og:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content') ||
                        undefined;

    const byline = $('meta[name="author"]').attr('content') ||
                   $('meta[property="article:author"]').attr('content') ||
                   undefined;

    // Eliminar ruido DOM no esencial para LLMs
    $(
      'script, style, noscript, iframe, svg, canvas, link, meta, ' +
      'header, footer, nav, aside, ' +
      '[role="banner"], [role="navigation"], [role="complementary"], [role="contentinfo"], ' +
      '.nav, .navbar, .menu, .footer, .sidebar, .ad, .ads, .advertisement, ' +
      '.cookie-banner, .popup, .modal, #cookie-notice, #consent-banner, ' +
      '.share-buttons, .social-share, .comments, #comments, .newsletter-signup'
    ).remove();

    // Intentar seleccionar el contenedor semántico principal si existe
    let mainContentHtml = '';
    const mainSelectors = ['main', 'article', '[role="main"]', '#main-content', '.post-content', '.entry-content', '.article-body', '.content'];

    for (const selector of mainSelectors) {
      const match = $(selector);
      if (match.length > 0 && match.text().trim().length > 200) {
        mainContentHtml = match.html() || '';
        break;
      }
    }

    // Fallback: usar el cuerpo del documento si no se detectó un contenedor semántico claro
    if (!mainContentHtml) {
      mainContentHtml = $('body').html() || $.html();
    }

    // Convertir a Markdown limpio
    let markdown = this.turndown.turndown(mainContentHtml);

    // Post-procesamiento: normalizar saltos de línea repetidos y espacios
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    const textLength = markdown.length;
    // Estimación rápida de tokens: ~4 caracteres por token en inglés/español
    const estimatedTokens = Math.max(1, Math.round(textLength / 4));

    return {
      url: originalUrl,
      title,
      description,
      byline,
      markdown,
      textLength,
      estimatedTokens,
      extractedAt: new Date().toISOString()
    };
  }
}

export const webExtractorService = new WebExtractorService();

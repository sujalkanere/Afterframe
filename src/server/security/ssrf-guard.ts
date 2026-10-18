import dns from 'node:dns/promises';
import { isPrivateOrInternalHost } from '../../shared/url-canonicalizer.js';

export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED';
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  allowLocalTestServer?: boolean;
  skipDnsLookup?: boolean;
}

/**
 * Validates URL and every redirect hop against SSRF rules (NFR-021).
 * Blocks loopback, private, link-local, cloud metadata, and non-HTTP(S) targets.
 */
export async function validateOutboundUrl(
  rawUrl: string,
  options: { allowLocalTestServer?: boolean; skipDnsLookup?: boolean } = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('Malformed outbound URL.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SsrfBlockedError(
      `Unsupported outbound protocol: ${parsed.protocol}`
    );
  }

  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError(
      'Outbound URLs with embedded credentials are blocked.'
    );
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isLocal =
    host === '127.0.0.1' || host === 'localhost' || host === '[::1]';

  if (isLocal && options.allowLocalTestServer) {
    return parsed;
  }

  if (isPrivateOrInternalHost(host)) {
    throw new SsrfBlockedError(
      `Blocked outbound request to restricted host: ${host}`
    );
  }

  if (!options.skipDnsLookup) {
    try {
      const records = await dns.lookup(host, { all: true });
      for (const rec of records) {
        if (isPrivateOrInternalHost(rec.address)) {
          throw new SsrfBlockedError(
            `DNS resolution for ${host} pointed to restricted address.`
          );
        }
      }
    } catch (err) {
      if (err instanceof SsrfBlockedError) throw err;
      // If DNS lookup itself fails in a restricted sandbox, let fetch report network error
    }
  }

  return parsed;
}

/**
 * Safe HTTP fetch that manually follows redirects up to maxRedirects (default 3)
 * and re-validates every redirect destination against SSRF rules (NFR-021).
 */
export async function safeFetch(
  initialUrl: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 12000;
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = await validateOutboundUrl(currentUrl, {
      allowLocalTestServer: options.allowLocalTestServer,
      skipDnsLookup: options.skipDnsLookup,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(validated.toString(), {
        method: hop === 0 ? (options.method ?? 'GET') : 'GET',
        headers: options.headers,
        body: hop === 0 ? options.body : undefined,
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308
    ) {
      if (hop === maxRedirects) {
        throw new SsrfBlockedError('Maximum redirect hops exceeded.');
      }
      const location = response.headers.get('location');
      if (!location) {
        throw new SsrfBlockedError('Redirect response missing Location header.');
      }
      currentUrl = new URL(location, validated).toString();
      continue;
    }

    return response;
  }

  throw new SsrfBlockedError('Redirect validation loop terminated.');
}

import { createHash } from 'node:crypto';
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici';
import { SecError, userAgentConfigured } from './errors.ts';

const ALLOWED_HOSTS = new Set(['data.sec.gov', 'www.sec.gov']);
const MAX_BYTES = 30 * 1024 * 1024;
export interface SecDocument {
  data: unknown;
  text: string;
  url: string;
  sha256: string;
  retrievedAt: string;
}

type Transport = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal; redirect: 'error' },
) => Promise<Response>;
interface Options {
  userAgent?: string;
  transport?: Transport;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxCacheEntries?: number;
  maxCacheBytes?: number;
}

/** One client per server: serialized requests, at most 2/second, bounded memory cache. */
export class SecClient {
  private cache = new Map<string, { document: SecDocument; expires: number; bytes: number }>();
  private cacheBytes = 0;
  private pending = new Map<string, Promise<SecDocument>>();
  private queue: Promise<void> = Promise.resolve();
  private lastRequest = -Infinity;
  private blockedUntil = 0;
  private transport: Transport;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private proxy: EnvHttpProxyAgent | undefined;
  constructor(private options: Options) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    if (options.transport) this.transport = options.transport;
    else {
      // Honor the platform HTTPS proxy and injected authentication. Never bypass TLS verification.
      this.proxy = new EnvHttpProxyAgent();
      this.transport = async (url, init) =>
        (await proxyFetch(url, { ...init, dispatcher: this.proxy })) as unknown as Response;
    }
  }
  get configured() {
    return userAgentConfigured(this.options.userAgent);
  }
  async close() {
    await this.proxy?.close();
  }

  getJson(url: string): Promise<SecDocument> {
    if (!this.configured)
      return Promise.reject(
        new SecError(
          'SEC_CONTACT_REQUIRED',
          'Configure SEC_USER_AGENT on the server with the application name and a genuine contact email before retrieving SEC filings.',
          503,
        ),
      );
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      !ALLOWED_HOSTS.has(parsed.hostname) ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return Promise.reject(
        new SecError('INVALID_SEC_URL', 'Only fixed SEC HTTPS data URLs are permitted.', 400),
      );
    }
    const cached = this.cache.get(url);
    if (cached && cached.expires > this.now()) return Promise.resolve(cached.document);
    if (cached) {
      this.cache.delete(url);
      this.cacheBytes -= cached.bytes;
    }
    const active = this.pending.get(url);
    if (active) return active;
    if (this.pending.size >= 24)
      return Promise.reject(
        new SecError('SERVER_BUSY', 'The SEC request queue is busy. Try again shortly.', 503),
      );
    const job = this.queue.then(() => this.request(url));
    this.queue = job.then(
      () => undefined,
      () => undefined,
    );
    this.pending.set(url, job);
    void job.then(
      () => this.pending.delete(url),
      () => this.pending.delete(url),
    );
    return job;
  }

  private async request(url: string): Promise<SecDocument> {
    if (this.now() < this.blockedUntil)
      throw new SecError(
        'SEC_RATE_LIMIT',
        'SEC requested a pause. Try again after its rate-limit window has passed.',
        503,
      );
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.sleep(
        Math.max(0, (this.options.intervalMs ?? 500) - (this.now() - this.lastRequest)),
      );
      this.lastRequest = this.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 12_000);
      try {
        const response = await this.transport(url, {
          headers: { 'User-Agent': this.options.userAgent!, Accept: 'application/json' },
          redirect: 'error',
          signal: controller.signal,
        });
        if (response.status === 429 || response.status === 503) {
          await response.body?.cancel();
          const hint = response.headers.get('retry-after');
          const seconds =
            hint !== null && /^\d+$/.test(hint)
              ? Number(hint)
              : hint
                ? (Date.parse(hint) - this.now()) / 1000
                : NaN;
          const waitMs = Number.isFinite(seconds)
            ? Math.max(1000, seconds * 1000)
            : 1000 * 2 ** attempt;
          this.blockedUntil = this.now() + waitMs;
          // Do not retry earlier than the server requests. Long waits are surfaced to the user.
          if (seconds > 10 || attempt === 2)
            throw new SecError(
              'SEC_RATE_LIMIT',
              'SEC requested a pause. Retry later; the server will not bypass this limit.',
              503,
            );
          clearTimeout(timer);
          await this.sleep(waitMs);
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 403)
            throw new SecError(
              'SEC_ACCESS_DENIED',
              'SEC or the environment proxy denied access. Check SEC domain access and the identifying User-Agent; no alternate source was substituted.',
              502,
            );
          if (response.status === 404)
            throw new SecError(
              'SEC_NOT_FOUND',
              'No SEC record was found for this identifier or filing.',
              404,
            );
          throw new SecError(
            'SEC_UNAVAILABLE',
            `SEC returned HTTP ${response.status}. Try again later.`,
            502,
          );
        }
        const bytes = await readLimited(response);
        const text = bytes.toString('utf8');
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new SecError(
            'SEC_INVALID_RESPONSE',
            'SEC did not return valid JSON. The response was not used.',
          );
        }
        const document: SecDocument = {
          data,
          text,
          url,
          retrievedAt: new Date(this.now()).toISOString(),
          sha256: createHash('sha256').update(bytes).digest('hex'),
        };
        const entryLimit = this.options.maxCacheEntries ?? 40;
        const byteLimit = this.options.maxCacheBytes ?? 64 * 1024 * 1024;
        if (bytes.length <= byteLimit && entryLimit > 0) {
          while (this.cache.size >= entryLimit || this.cacheBytes + bytes.length > byteLimit) {
            const oldest = this.cache.keys().next().value;
            if (oldest === undefined) break;
            this.cacheBytes -= this.cache.get(oldest)!.bytes;
            this.cache.delete(oldest);
          }
          this.cache.set(url, {
            document,
            bytes: bytes.length,
            expires: this.now() + (this.options.cacheTtlMs ?? 15 * 60_000),
          });
          this.cacheBytes += bytes.length;
        }
        return document;
      } catch (error) {
        if (error instanceof SecError) throw error;
        if (controller.signal.aborted)
          throw new SecError(
            'SEC_TIMEOUT',
            'The SEC request timed out. No partial response was used.',
            504,
          );
        // Do not expose proxy credentials, contact values, or raw upstream errors to the browser.
        throw new SecError(
          'SEC_NETWORK_ERROR',
          'Could not reach SEC through the configured network route. Check access to data.sec.gov and www.sec.gov and retry.',
          502,
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw new SecError('SEC_UNAVAILABLE', 'SEC did not respond successfully.');
  }
}

async function readLimited(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new SecError('SEC_INVALID_RESPONSE', 'SEC returned an empty response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES)
        throw new SecError(
          'SEC_RESPONSE_TOO_LARGE',
          'The SEC response exceeds the supported 30 MB limit.',
        );
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

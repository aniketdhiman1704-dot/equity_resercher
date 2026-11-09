import { describe, expect, it, vi } from 'vitest';
import { SecClient } from '../../server/sec-client';
import { userAgentConfigured } from '../../server/errors';
import { factsUrl, fixtureContact, submissionsUrl } from '../fixtures/sec';

function clock() {
  let value = Date.parse('2026-11-02T00:00:00Z');
  const waits: number[] = [];
  return {
    now: () => value,
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
      value += ms;
    },
    advance: (ms: number) => {
      value += ms;
    },
  };
}
describe('SEC transport', () => {
  it('requires an owner-supplied identifying contact and never exposes a placeholder as configured', async () => {
    for (const value of [
      undefined,
      '',
      'EquityResearcher',
      'EquityResearcher contact@example.com',
      'Name a@b.com\r\nInjected: true',
    ])
      expect(userAgentConfigured(value)).toBe(false);
    const transport = vi.fn(async () => Response.json({}));
    const client = new SecClient({ transport });
    await expect(client.getJson(factsUrl)).rejects.toMatchObject({ code: 'SEC_CONTACT_REQUIRED' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('sends identity only upstream, enforces HTTPS hosts and rejects redirects', async () => {
    const transport = vi.fn(async () => Response.json({ cik: 789019 }));
    const client = new SecClient({ userAgent: fixtureContact, transport, ...clock() });
    for (const url of [
      'https://example.org/data',
      'http://data.sec.gov/data',
      'https://data.sec.gov.evil.test/data',
      'https://user:password@data.sec.gov/data',
      'https://data.sec.gov:999/data',
    ]) {
      await expect(client.getJson(url)).rejects.toMatchObject({ code: 'INVALID_SEC_URL' });
    }
    const record = await client.getJson(factsUrl);
    expect(transport.mock.calls[0]).toEqual([
      factsUrl,
      expect.objectContaining({
        headers: { 'User-Agent': fixtureContact, Accept: 'application/json' },
        redirect: 'error',
      }),
    ]);
    expect(JSON.stringify(record)).not.toContain(fixtureContact);
  });
  it('deduplicates concurrent requests, caches successful bytes and expires them', async () => {
    const c = clock();
    const transport = vi.fn(async () => new Response('{"cik":789019}\n'));
    const client = new SecClient({ userAgent: fixtureContact, transport, ...c, cacheTtlMs: 1000 });
    const [first, second] = await Promise.all([client.getJson(factsUrl), client.getJson(factsUrl)]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.text).toBe('{"cik":789019}\n');
    expect((await client.getJson(factsUrl)).retrievedAt).toBe(first.retrievedAt);
    c.advance(1001);
    expect((await client.getJson(factsUrl)).retrievedAt).not.toBe(first.retrievedAt);
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('paces distinct requests at no more than two per second', async () => {
    const c = clock();
    const started: number[] = [];
    const client = new SecClient({
      userAgent: fixtureContact,
      ...c,
      transport: async () => {
        started.push(c.now());
        return Response.json({});
      },
    });
    await Promise.all([client.getJson(factsUrl), client.getJson(submissionsUrl)]);
    expect(started[1] - started[0]).toBeGreaterThanOrEqual(500);
  });
  it('honors Retry-After and does not retry denials or cache failures', async () => {
    const c = clock();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const client = new SecClient({ userAgent: fixtureContact, transport, ...c });
    expect((await client.getJson(factsUrl)).data).toEqual({ ok: true });
    expect(c.waits).toContain(2000);
    const denied = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const other = new SecClient({ userAgent: fixtureContact, transport: denied, ...clock() });
    await expect(other.getJson(factsUrl)).rejects.toMatchObject({ code: 'SEC_ACCESS_DENIED' });
    expect(denied).toHaveBeenCalledTimes(1);
    await other.getJson(factsUrl);
    expect(denied).toHaveBeenCalledTimes(2);
  });
  it('respects a long server pause across all queued requests', async () => {
    const c = clock();
    const transport = vi.fn(
      async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } }),
    );
    const client = new SecClient({ userAgent: fixtureContact, transport, ...c });
    await expect(client.getJson(factsUrl)).rejects.toMatchObject({ code: 'SEC_RATE_LIMIT' });
    await expect(client.getJson(submissionsUrl)).rejects.toMatchObject({ code: 'SEC_RATE_LIMIT' });
    expect(transport).toHaveBeenCalledTimes(1);
    c.advance(60_001);
    await expect(client.getJson(submissionsUrl)).rejects.toMatchObject({ code: 'SEC_RATE_LIMIT' });
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('caps attempts, rejects bad JSON, and suppresses sensitive network error details', async () => {
    const busy = vi.fn(async () => new Response('', { status: 503 }));
    await expect(
      new SecClient({ userAgent: fixtureContact, transport: busy, ...clock() }).getJson(factsUrl),
    ).rejects.toMatchObject({ code: 'SEC_RATE_LIMIT' });
    expect(busy).toHaveBeenCalledTimes(3);
    const bad = new SecClient({
      userAgent: fixtureContact,
      transport: async () => new Response('<html>access denied</html>'),
      ...clock(),
    });
    await expect(bad.getJson(factsUrl)).rejects.toMatchObject({ code: 'SEC_INVALID_RESPONSE' });
    const broken = new SecClient({
      userAgent: fixtureContact,
      transport: async () => {
        throw new Error('https://user:private@proxy.invalid');
      },
      ...clock(),
    });
    await expect(broken.getJson(factsUrl)).rejects.toMatchObject({ code: 'SEC_NETWORK_ERROR' });
    await expect(broken.getJson(factsUrl)).rejects.not.toThrow('private');
  });
  it('aborts a stalled request with a bounded timeout', async () => {
    const client = new SecClient({
      userAgent: fixtureContact,
      timeoutMs: 5,
      ...clock(),
      transport: async (_url, init) =>
        await new Promise<Response>((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
        ),
    });
    await expect(client.getJson(factsUrl)).rejects.toMatchObject({ code: 'SEC_TIMEOUT' });
  });
  it('evicts old cache entries instead of accumulating issuers indefinitely', async () => {
    const transport = vi.fn(async () => Response.json({}));
    const client = new SecClient({
      userAgent: fixtureContact,
      transport,
      ...clock(),
      maxCacheEntries: 1,
    });
    await client.getJson(factsUrl);
    await client.getJson(submissionsUrl);
    await client.getJson(factsUrl);
    expect(transport).toHaveBeenCalledTimes(3);
  });
});

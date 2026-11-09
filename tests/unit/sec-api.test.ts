import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../server/app';
import { SecClient } from '../../server/sec-client';
import { cik, fixtureContact, fixtureTransport } from '../fixtures/sec';
import { sampleAssumptions } from '../../src/lib/sample';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});
async function start(configured = true) {
  const client = new SecClient({
    userAgent: configured ? fixtureContact : undefined,
    transport: fixtureTransport(),
    intervalMs: 0,
  });
  const server = createApp(client);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('SEC HTTP boundary', () => {
  it('exposes configuration status without the contact and returns actionable missing-config errors', async () => {
    const base = await start(false);
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health.secConfigured).toBe(false);
    expect(health.liveAccess).toBe('not-verified');
    const response = await fetch(`${base}/api/sec/company?identifier=MSFT&years=5`);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('SEC_CONTACT_REQUIRED');
  });
  it('serves validated discovery and preserves the exact raw facts fingerprint on download', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/sec/company?identifier=MSFT&years=3`);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.periods).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain(fixtureContact);
    const raw = await fetch(`${base}${result.facts.downloadPath}`);
    expect(raw.headers.get('content-disposition')).toContain('attachment');
    expect((await raw.json()).cik).toBe(789019);
    const changed = await fetch(`${base}/api/sec/facts?cik=${cik}&sha256=${'0'.repeat(64)}`);
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe('SEC_SOURCE_CHANGED');
  });
  it('rejects unsupported histories, unknown routes, and private upload requests', async () => {
    const base = await start();
    expect((await fetch(`${base}/api/sec/company?identifier=MSFT&years=8`)).status).toBe(400);
    expect((await fetch(`${base}/api/sec/company?identifier=https://evil.test`)).status).toBe(400);
    expect((await fetch(`${base}/api/unknown`)).status).toBe(404);
    expect(
      (await fetch(`${base}/api/sec/company`, { method: 'POST', body: 'private contents' })).status,
    ).toBe(405);
  });
  it('runs calculation research over HTTP and enforces JSON, same-origin and private-data boundaries', async () => {
    const base = await start();
    const body = {
      source: { kind: 'demo' },
      assumptions: sampleAssumptions,
      approved: true,
    };
    const send = (
      value: unknown,
      headers: Record<string, string> = { 'Content-Type': 'application/json' },
    ) => fetch(`${base}/api/research`, { method: 'POST', headers, body: JSON.stringify(value) });
    const good = await send(body);
    expect(good.status).toBe(200);
    expect((await good.json()).agents.map((a: { role: string }) => a.role)).toEqual([
      'reports',
      'fundamentals',
      'dcf',
    ]);
    expect((await send(body, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect(
      (await send(body, { 'Content-Type': 'application/json', Origin: 'https://unrelated.test' }))
        .status,
    ).toBe(403);
    expect(
      (await send({ ...body, source: { kind: 'upload', data: 'private financial contents' } }))
        .status,
    ).toBe(400);
    expect((await send({ ...body, useAI: true })).status).toBe(400);
    const invalid = await fetch(`${base}/api/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(invalid.status).toBe(400);
    expect((await send({ ...body, extra: 'x'.repeat(200_001) })).status).toBe(413);
    expect((await send(body)).status).toBe(200);
  });
});

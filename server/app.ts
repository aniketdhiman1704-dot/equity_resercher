import { createServer, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { SecError } from './errors.ts';
import type { SecClient } from './sec-client.ts';
import { SecService, parseHistoryYears } from './sec-service.ts';
import { normalizeReports } from './normalize.ts';
import { research } from './research-service.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

export function createApp(client: SecClient, staticDirectory?: string) {
  const service = new SecService(client);
  let activeResearch = false;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/api/research' && request.method === 'POST') {
        if (
          (request.headers.origin &&
            new URL(request.headers.origin).host !== request.headers.host) ||
          request.headers['sec-fetch-site'] === 'cross-site'
        )
          throw new SecError(
            'ORIGIN_REJECTED',
            'Research requests must come from this website.',
            403,
          );
        if (!request.headers['content-type']?.startsWith('application/json'))
          throw new SecError('JSON_REQUIRED', 'Use a JSON research request.', 415);
        if (activeResearch)
          throw new SecError(
            'RESEARCH_BUSY',
            'Another research run is active. Try again when it finishes.',
            429,
          );
        activeResearch = true;
        try {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of request) {
            bytes += chunk.length;
            if (bytes > 200_000)
              throw new SecError(
                'REQUEST_TOO_LARGE',
                'Research request exceeds the size limit.',
                413,
              );
            chunks.push(Buffer.from(chunk));
          }
          let body: unknown;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            throw new SecError('INVALID_JSON', 'Invalid JSON request.', 400);
          }
          json(response, 200, await research(service, body));
        } finally {
          activeResearch = false;
        }
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.setHeader('Allow', 'GET, HEAD');
        json(response, 405, {
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message:
              'This service only reads public filings. Private file uploads are not accepted.',
          },
        });
        return;
      }
      if (url.pathname === '/api/health') {
        json(response, 200, {
          status: 'ok',
          secConfigured: client.configured,
          liveAccess: 'not-verified',
          researchMode: 'deterministic',
          paidServicesRequired: false,
          version: '0.5.0',
        });
        return;
      }
      if (url.pathname === '/api/sec/normalized') {
        const reports = await service.companyReports(
          url.searchParams.get('identifier') ?? '',
          parseHistoryYears(url.searchParams.get('years')),
        );
        if (url.searchParams.get('sha256') !== reports.facts.sha256)
          throw new SecError(
            'SEC_SOURCE_CHANGED',
            'Refresh filing discovery before reviewing financial history.',
            409,
          );
        json(
          response,
          200,
          normalizeReports(reports, await service.companyFacts(reports.company.cik)),
        );
        return;
      }
      if (url.pathname === '/api/sec/company') {
        if (!url.searchParams.has('identifier'))
          throw new SecError('INVALID_IDENTIFIER', 'Provide a ticker or CIK.', 400);
        const result = await service.companyReports(
          url.searchParams.get('identifier')!,
          parseHistoryYears(url.searchParams.get('years')),
        );
        json(response, 200, result);
        return;
      }
      if (url.pathname === '/api/sec/facts') {
        const expectedHash = url.searchParams.get('sha256');
        if (expectedHash !== null && !/^[a-f0-9]{64}$/.test(expectedHash))
          throw new SecError('INVALID_FINGERPRINT', 'Invalid source fingerprint.', 400);
        const facts = await service.companyFacts(url.searchParams.get('cik') ?? '');
        if (expectedHash && expectedHash !== facts.sha256)
          throw new SecError(
            'SEC_SOURCE_CHANGED',
            'SEC financial facts have changed since this lookup. Search again to refresh the source record before downloading.',
            409,
          );
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sec-company-facts.json"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(facts.text);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        json(response, 404, { error: { code: 'NOT_FOUND', message: 'Unknown API route.' } });
        return;
      }
      if (staticDirectory) {
        const root = resolve(staticDirectory);
        const file = resolve(
          root,
          `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
        );
        if (!file.startsWith(`${root}${sep}`))
          throw new SecError('INVALID_PATH', 'Invalid file path.', 400);
        try {
          const info = await stat(file);
          if (info.isFile()) {
            response.writeHead(200, {
              'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
              'Content-Length': info.size,
              'X-Content-Type-Options': 'nosniff',
              'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
            });
            if (request.method === 'HEAD') response.end();
            else
              createReadStream(file)
                .on('error', () => response.destroy())
                .pipe(response);
            return;
          }
        } catch {
          /* Return a clear 404 rather than an HTML response for missing assets. */
        }
      }
      json(response, 404, {
        error: {
          code: 'NOT_FOUND',
          message: 'Not found. Build the website before starting the production server.',
        },
      });
    } catch (error) {
      if (error instanceof SecError)
        json(response, error.status, { error: { code: error.code, message: error.message } });
      else
        json(response, 500, {
          error: {
            code: 'SERVER_ERROR',
            message: 'The request could not be completed. No partial data was used.',
          },
        });
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 15_000;
  return server;
}

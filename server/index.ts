import { resolve } from 'node:path';
import { createApp } from './app.ts';
import { SecClient } from './sec-client.ts';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid TCP port.');
const client = new SecClient({ userAgent: process.env.SEC_USER_AGENT });
const server = createApp(client, resolve('dist'));
server.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(
    `Equity API listening on port ${port}. SEC contact ${client.configured ? 'configured' : 'not configured'}.`,
  );
});
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  server.close();
  server.closeAllConnections();
  await client.close();
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

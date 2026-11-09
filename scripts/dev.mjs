import { spawn } from 'node:child_process';

const children = [
  spawn(
    process.execPath,
    ['--watch', '--env-file-if-exists=.env', '--import', 'tsx', 'server/index.ts'],
    {
      stdio: 'inherit',
      env: { ...process.env, HOST: '127.0.0.1', PORT: '3001' },
    },
  ),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], {
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => {
    console.error('Development process failed:', error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

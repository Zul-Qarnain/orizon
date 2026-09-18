import path from 'path';
import { buildApp } from './app.js';

function loadLocalEnv(): void {
  const load = (process as NodeJS.Process & { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (typeof load !== 'function') return;

  const dirs = [process.cwd(), path.resolve(process.cwd(), '../..'), path.resolve(process.cwd(), '..')];
  for (const dir of dirs) {
    for (const file of ['.env.local', '.env']) {
      try {
        load(path.join(dir, file));
      } catch {
        // File is optional.
      }
    }
  }
}

loadLocalEnv();

const app = buildApp();
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host }, (err: Error | null, address: string) => {
  if (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
  console.log(`GridWise HTTP API listening on ${address}`);
});

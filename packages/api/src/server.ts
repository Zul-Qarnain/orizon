import { buildApp } from './app.js';

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

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: false
  }
};

let appPromise: Promise<{ server: { emit: (event: string, req: unknown, res: unknown) => void } }> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = import('../packages/api/dist/app.js').then(async (mod) => {
      const app = mod.buildApp();
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  app.server.emit('request', req, res);
}

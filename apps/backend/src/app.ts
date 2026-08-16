import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify();

  app.get('/health/live', () => ({ status: 'ok' }));

  return app;
}

import { Hono } from 'hono';

const app = new Hono();

// Forward all API traffic to the backend worker
app.use('/api/*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `https://med-greybrain-worker.satish-9f4.workers.dev${url.pathname}${url.search}`;
  
  const proxyReq = new Request(targetUrl, c.req.raw);
  proxyReq.headers.delete('host');
  
  return fetch(proxyReq);
});

// Proxy everything else to the consolidated Pages project
app.use('*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `https://med-greybrain.pages.dev${url.pathname}${url.search}`;
  
  const proxyReq = new Request(targetUrl, c.req.raw);
  proxyReq.headers.delete('host');
  
  return fetch(proxyReq);
});

export default app;

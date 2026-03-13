import { Hono } from 'hono';

const app = new Hono();

// Proxy all /app/* traffic to the new LMS Pages Project
app.use('/app*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `https://med-greybrain-app.pages.dev${url.pathname}${url.search}`;
  
  // Clone the request to forward headers (except host)
  const proxyReq = new Request(targetUrl, c.req.raw);
  proxyReq.headers.delete('host');
  
  return fetch(proxyReq);
});

// Proxy all other traffic to the original Marketing Pages Project
app.use('*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `https://gbdeelearn.pages.dev${url.pathname}${url.search}`;
  
  const proxyReq = new Request(targetUrl, c.req.raw);
  proxyReq.headers.delete('host');
  
  return fetch(proxyReq);
});

export default app;

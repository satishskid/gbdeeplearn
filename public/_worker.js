const API_WORKER_BASE = 'https://deeplearn-worker.satish-9f4.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const target = new URL(`${url.pathname}${url.search}`, API_WORKER_BASE);
      const method = request.method.toUpperCase();
      const upstreamRequest = new Request(target.toString(), {
        method,
        headers: request.headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
        redirect: 'follow'
      });

      return fetch(upstreamRequest);
    }

    return env.ASSETS.fetch(request);
  }
};

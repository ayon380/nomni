/**
 * Standalone Uber Eats Mock API Server
 *
 * Implements the official Uber Eats Get Order v2 endpoint:
 *   GET /v2/eats/order/:order_id
 *
 * Can be run independently in development/test:
 *   npx tsx uber-mock-api/server.ts
 */

import http from 'node:http';
import { buildMockOrder } from './mock-order';

const DEFAULT_PORT = Number(process.env.UBER_MOCK_PORT) || 3001;
const EXPECTED_TOKEN = process.env.UBER_API_TOKEN || process.env.UBER_MOCK_TOKEN || 'uber_mock_dev_token';

export function createMockServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/v2\/eats\/order\/(.+)$/);

    if (req.method !== 'GET' || !match) {
      console.warn(`[Uber Mock API] 404 Not Found: ${req.method} ${url.pathname}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || token !== EXPECTED_TOKEN) {
      console.warn(`[Uber Mock API] 401 Unauthorized: Missing or invalid Bearer token for ${url.pathname}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid Authorization: Bearer <token>' }));
      return;
    }

    const orderId = decodeURIComponent(match[1]);
    if (!orderId || orderId.trim() === '') {
      console.warn(`[Uber Mock API] 400 Bad Request: Missing order id in ${url.pathname}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing order id' }));
      return;
    }

    const order = buildMockOrder(orderId);
    console.log(
      `[Uber Mock API] 200 OK: Dispatched order ${orderId} (display_id: ${order.display_id}, state: ${order.current_state})`
    );
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Nomni-Mock': 'true',
    });
    res.end(JSON.stringify(order));
  });
}

// When run directly as a script
if (require.main === module) {
  const port = DEFAULT_PORT;
  const server = createMockServer();
  server.listen(port, () => {
    console.log(`[Uber Mock API] Server running on http://localhost:${port}`);
    console.log(`[Uber Mock API] Endpoint: GET http://localhost:${port}/v2/eats/order/:order_id`);
  });
}

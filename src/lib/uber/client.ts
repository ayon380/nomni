export class UberFetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'UberFetchError';
  }
}

export interface UberOrderClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface UberOrderClient {
  /** Fetches the full order for the given order ID. Throws on non-2xx or timeout. */
  getOrder(orderId: string, options?: UberOrderClientOptions): Promise<Record<string, unknown>>;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.UBER_FETCH_TIMEOUT_MS) || 5000;

let autoMockStarted = false;
function ensureDevMockServer(): void {
  if (process.env.NODE_ENV === 'production' || autoMockStarted) return;
  autoMockStarted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMockServer } = require('../../../uber-mock-api/server');
    const mockServer = createMockServer();
    const mockPort = Number(process.env.UBER_MOCK_PORT) || 3001;
    mockServer.listen(mockPort);
    mockServer.on('error', () => {
      // Standalone server already running on port
    });
  } catch {
    // Ignore in non-Node or bundled environments
  }
}

function resolveBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) return explicitBaseUrl;
  if (process.env.UBER_API_BASE_URL) return process.env.UBER_API_BASE_URL;

  // In production, default to official Uber Eats API
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.uber.com';
  }

  // In development, default to standalone uber-mock-api server
  ensureDevMockServer();
  const mockPort = process.env.UBER_MOCK_PORT || '3001';
  const host = process.env.UBER_MOCK_HOST || 'localhost';
  return `http://${host}:${mockPort}`;
}

const getApiToken = () =>
  process.env.UBER_API_TOKEN || process.env.UBER_MOCK_TOKEN || 'uber_mock_dev_token';

class UberClient implements UberOrderClient {
  async getOrder(orderId: string, options?: UberOrderClientOptions): Promise<Record<string, unknown>> {
    const baseUrl = resolveBaseUrl(options?.baseUrl).replace(/\/$/, '');
    const token = getApiToken();
    const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/v2/eats/order/${encodeURIComponent(orderId)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: unknown) {
      const isTimeout = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError';
      const msg = isTimeout
        ? `Uber GET /v2/eats/order/${orderId} timed out after ${timeoutMs}ms`
        : `Uber GET /v2/eats/order/${orderId} connection failed: ${(err as Error)?.message}`;
      throw new UberFetchError(msg, 502);
    }

    if (!res.ok) {
      throw new UberFetchError(
        `Uber GET /v2/eats/order/${orderId} returned HTTP ${res.status}: ${await res.text()}`,
        res.status,
      );
    }

    return res.json() as Promise<Record<string, unknown>>;
  }
}

export const uberClient: UberOrderClient = new UberClient();

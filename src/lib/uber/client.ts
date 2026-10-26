export class UberFetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'UberFetchError';
  }
}

export interface UberOrderClient {
  /** Fetches the full order for the given order ID. Throws on non-2xx. */
  getOrder(orderId: string): Promise<Record<string, unknown>>;
}

const getBaseUrl = () => process.env.UBER_API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const getApiToken = () => process.env.UBER_API_TOKEN || 'uber_mock_dev_token';

class UberClient implements UberOrderClient {
  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const token = getApiToken();
    const url = `${baseUrl}/v2/eats/order/${encodeURIComponent(orderId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

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

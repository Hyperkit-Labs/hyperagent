/**
 * x402 payment and HTTP error handling for deployment and paid API calls.
 */

export const MAX_PAYMENT_ALLOWED = 100;

/**
 * Handle fetch errors (network, 402 payment flow, etc.). Rethrows with a clear message.
 */
export function handleX402FetchError(error: unknown): never {
  if (error instanceof Error) {
    throw new Error(`Request failed: ${error.message}`);
  }
  throw new Error('Request failed');
}

/**
 * Handle non-OK HTTP response. Throws with status and body text.
 */
export async function handleHttpErrorResponse(response: Response): Promise<never> {
  const text = await response.text();
  throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
}

/**
 * Parse response body as JSON.
 */
export async function parseResponseData<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON response');
  }
}

import { QueryClient, type DefaultOptions } from "@tanstack/react-query";
import { isNonRetryableClientError } from "./errors.js";

const MAX_FAILURES = 3;

function defaultRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_FAILURES) return false;
  if (isNonRetryableClientError(error)) return false;
  return true;
}

function defaultRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

export const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: defaultRetry,
    retryDelay: defaultRetryDelay,
  },
  mutations: {
    retry: 0,
  },
};

export function createAppQueryClient(
  overrides?: Partial<DefaultOptions>
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...defaultQueryOptions.queries,
        ...overrides?.queries,
      },
      mutations: {
        ...defaultQueryOptions.mutations,
        ...overrides?.mutations,
      },
    },
  });
}

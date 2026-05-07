// Generic retry helper used by all providers. The `isPermanent` predicate
// lets each provider opt out of retrying obviously-fatal errors (e.g. 401
// from a missing key, 400 from a malformed request).

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  isPermanent?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 500;
  const isPermanent = opts.isPermanent ?? (() => false);

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isPermanent(err)) throw err;
      if (i < attempts - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Operation failed after retries");
}

// AbortController helper for fetch-style providers. Returns the controller
// so the caller can `signal: ctrl.signal` and the cleanup is automatic.
export function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

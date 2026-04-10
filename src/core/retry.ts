/**
 * Retry mechanism with exponential backoff and idempotency support.
 */

import { sleep } from "./utils.js";
import { CexError, CexErrorCode } from "./errors.js";

/** Options for the retry wrapper */
export interface RetryOptions {
  /** Maximum number of attempts (including the first) */
  maxAttempts?: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs?: number;
  /** Jitter factor (0–1) added to delay to avoid thundering herds */
  jitter?: number;
  /** Custom predicate: return true if error is retryable */
  isRetryable?: (err: unknown) => boolean;
  /** Callback invoked before each retry attempt */
  onRetry?: (attempt: number, err: unknown) => void;
}

/** Default retry predicate: retries on CexError.isRetryable() */
function defaultIsRetryable(err: unknown): boolean {
  if (err instanceof CexError) {
    return err.isRetryable();
  }
  // Retry on generic network-related errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("socket hang up")
    );
  }
  return false;
}

/**
 * Executes an async function with exponential backoff retry.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of fn on success
 * @throws The last error if all attempts fail
 *
 * @example
 * ```ts
 * const result = await withRetry(() => api.getBalance(), { maxAttempts: 3 });
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    jitter = 0.2,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxAttempts || !isRetryable(err)) {
        throw err;
      }

      // Exponential backoff with jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitterAmount = exponentialDelay * jitter * Math.random();
      const delay = Math.min(exponentialDelay + jitterAmount, maxDelayMs);

      onRetry?.(attempt, err);
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript requires it
  throw lastError;
}

/** Tracks executed idempotency keys to prevent duplicate submissions */
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();

/** TTL for idempotency cache entries (ms) */
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Executes an async function with idempotency guarantee.
 * If the same key is called again within the TTL, returns the cached result.
 *
 * @param key - Unique idempotency key
 * @param fn - Async function to execute
 * @returns Result of fn (cached or fresh)
 *
 * @example
 * ```ts
 * const order = await withIdempotency("order-xyz-123", () => placeOrder(params));
 * ```
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Clean expired entries
  const now = Date.now();
  for (const [k, v] of idempotencyCache.entries()) {
    if (v.expiresAt <= now) {
      idempotencyCache.delete(k);
    }
  }

  const cached = idempotencyCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.result as T;
  }

  const result = await fn();

  idempotencyCache.set(key, {
    result,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });

  return result;
}

/**
 * Clears the idempotency cache.
 * Useful for testing.
 */
export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

/**
 * Wraps a function with both retry and idempotency.
 *
 * @param key - Idempotency key
 * @param fn - Async function to execute
 * @param retryOptions - Retry configuration
 */
export async function withRetryAndIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return withIdempotency(key, () => withRetry(fn, retryOptions));
}

/**
 * Guards a write operation against READ_ONLY mode.
 * @param readOnly - Whether the server is in read-only mode
 * @throws CexError with READ_ONLY_MODE if readOnly is true
 */
export function assertWriteAllowed(readOnly: boolean): void {
  if (readOnly) {
    throw new CexError(
      CexErrorCode.READ_ONLY_MODE,
      "Server is in read-only mode; write operations are not allowed"
    );
  }
}

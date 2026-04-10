/**
 * Token bucket rate limiter.
 * Allows bursts up to the bucket capacity while enforcing an average rate.
 */

import { sleep } from "./utils.js";
import { CexError, CexErrorCode } from "./errors.js";

/** Options for the RateLimiter */
export interface RateLimiterOptions {
  /** Maximum requests per second (token refill rate) */
  requestsPerSecond: number;
  /** Maximum burst capacity (default: equal to requestsPerSecond) */
  burstCapacity?: number;
  /** Maximum time to wait for a token before throwing (ms, 0 = no wait) */
  maxWaitMs?: number;
}

/**
 * Token bucket rate limiter.
 *
 * Each call to `acquire()` consumes one token.
 * Tokens are replenished at `requestsPerSecond` per second.
 * If no token is available and `maxWaitMs` is set, the call waits.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ requestsPerSecond: 10 });
 * await limiter.acquire();
 * // safe to make API call
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefillTime: number;
  private readonly maxWaitMs: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = options.burstCapacity ?? options.requestsPerSecond;
    this.tokens = this.capacity;
    this.refillRate = options.requestsPerSecond / 1_000; // convert to per-ms
    this.lastRefillTime = Date.now();
    this.maxWaitMs = options.maxWaitMs ?? 5_000;
  }

  /**
   * Refills tokens based on elapsed time since last refill.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefillTime = now;
  }

  /**
   * Acquires a token, waiting if necessary.
   * Throws CexError with RATE_LIMIT_EXCEEDED if wait exceeds maxWaitMs.
   */
  async acquire(): Promise<void> {
    const deadline = Date.now() + this.maxWaitMs;

    while (true) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      const now = Date.now();
      if (now >= deadline) {
        throw new CexError(
          CexErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded: waited ${this.maxWaitMs}ms for a token`
        );
      }

      // Calculate time until next token is available
      const tokensNeeded = 1 - this.tokens;
      const waitMs = Math.ceil(tokensNeeded / this.refillRate);
      const safeWait = Math.min(waitMs, deadline - now, 100);
      await sleep(safeWait);
    }
  }

  /**
   * Returns the current number of available tokens (may be fractional).
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Resets the bucket to full capacity.
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
  }
}

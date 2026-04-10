/**
 * Utility functions for the CEX trader MCP server.
 * Covers precision handling, HMAC signing, and general validation.
 */

import { createHmac } from "crypto";
import BigNumber from "bignumber.js";

// Configure BigNumber for financial precision
BigNumber.config({
  DECIMAL_PLACES: 18,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-20, 20],
});

/**
 * Adds two decimal strings with full precision.
 * @param a - First operand
 * @param b - Second operand
 * @returns Sum as string
 */
export function addDecimal(a: string, b: string): string {
  return new BigNumber(a).plus(new BigNumber(b)).toFixed();
}

/**
 * Subtracts b from a with full precision.
 * @param a - Minuend
 * @param b - Subtrahend
 * @returns Difference as string
 */
export function subtractDecimal(a: string, b: string): string {
  return new BigNumber(a).minus(new BigNumber(b)).toFixed();
}

/**
 * Multiplies two decimal strings.
 * @param a - First factor
 * @param b - Second factor
 * @returns Product as string
 */
export function multiplyDecimal(a: string, b: string): string {
  return new BigNumber(a).multipliedBy(new BigNumber(b)).toFixed();
}

/**
 * Divides a by b with full precision.
 * @param a - Dividend
 * @param b - Divisor (must not be zero)
 * @returns Quotient as string
 * @throws Error if divisor is zero
 */
export function divideDecimal(a: string, b: string): string {
  const divisor = new BigNumber(b);
  if (divisor.isZero()) {
    throw new Error("Division by zero");
  }
  return new BigNumber(a).dividedBy(divisor).toFixed();
}

/**
 * Rounds a decimal string to a given number of decimal places.
 * @param value - Value to round
 * @param decimals - Number of decimal places
 * @returns Rounded value as string
 */
export function roundDecimal(value: string, decimals: number): string {
  return new BigNumber(value).toFixed(decimals, BigNumber.ROUND_HALF_UP);
}

/**
 * Compares two decimal strings.
 * @param a - First value
 * @param b - Second value
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  return new BigNumber(a).comparedTo(new BigNumber(b)) as -1 | 0 | 1;
}

/**
 * Returns true if value is greater than threshold.
 */
export function isGreaterThan(value: string, threshold: string): boolean {
  return new BigNumber(value).isGreaterThan(new BigNumber(threshold));
}

/**
 * Returns true if value is less than threshold.
 */
export function isLessThan(value: string, threshold: string): boolean {
  return new BigNumber(value).isLessThan(new BigNumber(threshold));
}

/**
 * Returns true if value is zero.
 */
export function isZero(value: string): boolean {
  return new BigNumber(value).isZero();
}

/**
 * Generates an HMAC-SHA256 signature encoded in base64.
 * Used by OKX API authentication.
 *
 * @param secret - Secret key
 * @param message - Message to sign
 * @returns Base64-encoded signature
 */
export function hmacSha256Base64(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64");
}

/**
 * Generates an HMAC-SHA256 signature encoded in hex.
 * Used by Binance API authentication.
 *
 * @param secret - Secret key
 * @param message - Message to sign
 * @returns Hex-encoded signature
 */
export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Returns the current UTC timestamp in ISO 8601 format.
 * Required by OKX API for the OK-ACCESS-TIMESTAMP header.
 */
export function getUtcTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Returns the current Unix timestamp in milliseconds.
 */
export function getNowMs(): number {
  return Date.now();
}

/**
 * Generates a unique client order ID using a prefix and current time.
 * @param prefix - Prefix string (max 16 chars)
 * @returns Client order ID string
 */
export function generateClientOrderId(prefix = "cex"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${rand}`.slice(0, 32);
}

/**
 * Validates that a symbol string is non-empty.
 * @param symbol - Symbol to validate
 * @throws Error if symbol is invalid
 */
export function validateSymbol(symbol: string): void {
  if (!symbol || typeof symbol !== "string" || symbol.trim().length === 0) {
    throw new Error(`Invalid symbol: "${symbol}"`);
  }
}

/**
 * Validates that a quantity string is a positive number.
 * @param quantity - Quantity string to validate
 * @throws Error if quantity is invalid
 */
export function validateQuantity(quantity: string): void {
  const bn = new BigNumber(quantity);
  if (bn.isNaN() || !bn.isFinite() || bn.isLessThanOrEqualTo(0)) {
    throw new Error(`Invalid quantity: "${quantity}" must be a positive number`);
  }
}

/**
 * Validates that a price string is a positive number.
 * @param price - Price string to validate
 * @throws Error if price is invalid
 */
export function validatePrice(price: string): void {
  const bn = new BigNumber(price);
  if (bn.isNaN() || !bn.isFinite() || bn.isLessThanOrEqualTo(0)) {
    throw new Error(`Invalid price: "${price}" must be a positive number`);
  }
}

/**
 * Serialises a plain object into a URL query string.
 * Skips undefined values.
 * @param params - Key-value pairs
 * @returns URL-encoded query string (without leading ?)
 */
export function toQueryString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

/**
 * Sleeps for the specified number of milliseconds.
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses a JSON string; returns null on parse error.
 * @param json - JSON string
 */
export function safeParseJson<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

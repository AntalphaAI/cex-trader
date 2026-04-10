/**
 * Error codes and custom error class for the CEX trader MCP server.
 */

/** Enumeration of all possible error codes */
export enum CexErrorCode {
  // General errors
  UNKNOWN = "UNKNOWN",
  INVALID_PARAMS = "INVALID_PARAMS",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  TIMEOUT = "TIMEOUT",
  READ_ONLY_MODE = "READ_ONLY_MODE",

  // Authentication errors
  AUTH_FAILED = "AUTH_FAILED",
  INVALID_API_KEY = "INVALID_API_KEY",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  IP_RESTRICTED = "IP_RESTRICTED",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Order errors
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  ORDER_ALREADY_CANCELLED = "ORDER_ALREADY_CANCELLED",
  ORDER_ALREADY_FILLED = "ORDER_ALREADY_FILLED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_QUANTITY = "INVALID_QUANTITY",
  INVALID_PRICE = "INVALID_PRICE",
  MIN_NOTIONAL_NOT_MET = "MIN_NOTIONAL_NOT_MET",

  // Futures-specific errors
  POSITION_NOT_FOUND = "POSITION_NOT_FOUND",
  LEVERAGE_EXCEEDS_LIMIT = "LEVERAGE_EXCEEDS_LIMIT",
  MARGIN_INSUFFICIENT = "MARGIN_INSUFFICIENT",
  LIQUIDATION_RISK = "LIQUIDATION_RISK",

  // Risk management errors
  RISK_LIMIT_EXCEEDED = "RISK_LIMIT_EXCEEDED",
  DAILY_TRADE_LIMIT = "DAILY_TRADE_LIMIT",
  POSITION_LIMIT_EXCEEDED = "POSITION_LIMIT_EXCEEDED",
  MARGIN_WARNING = "MARGIN_WARNING",
  MARGIN_DANGER = "MARGIN_DANGER",

  // Exchange errors
  EXCHANGE_NOT_CONFIGURED = "EXCHANGE_NOT_CONFIGURED",
  EXCHANGE_ERROR = "EXCHANGE_ERROR",
  SYMBOL_NOT_FOUND = "SYMBOL_NOT_FOUND",
}

/** Custom error class for CEX trader operations */
export class CexError extends Error {
  /** Error code from CexErrorCode enum */
  public readonly code: CexErrorCode;

  /** HTTP status code, if applicable */
  public readonly httpStatus?: number;

  /** Original error, if wrapping another error */
  public readonly cause?: unknown;

  /** Additional context data */
  public readonly context?: Record<string, unknown>;

  /**
   * Creates a new CexError.
   * @param code - Error code
   * @param message - Human-readable error message
   * @param options - Additional error options
   */
  constructor(
    code: CexErrorCode,
    message: string,
    options?: {
      httpStatus?: number;
      cause?: unknown;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "CexError";
    this.code = code;
    this.httpStatus = options?.httpStatus;
    this.cause = options?.cause;
    this.context = options?.context;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CexError);
    }
  }

  /**
   * Converts the error to a plain object suitable for JSON serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      context: this.context,
    };
  }

  /**
   * Creates a CexError from an unknown caught value.
   * @param err - The caught error value
   * @param defaultCode - Default code if err is not a CexError
   */
  static from(
    err: unknown,
    defaultCode: CexErrorCode = CexErrorCode.UNKNOWN
  ): CexError {
    if (err instanceof CexError) {
      return err;
    }
    if (err instanceof Error) {
      return new CexError(defaultCode, err.message, { cause: err });
    }
    return new CexError(defaultCode, String(err), { cause: err });
  }

  /**
   * Returns true if this error indicates a rate limit issue.
   */
  isRateLimit(): boolean {
    return this.code === CexErrorCode.RATE_LIMIT_EXCEEDED;
  }

  /**
   * Returns true if this error indicates an authentication failure.
   */
  isAuthError(): boolean {
    return [
      CexErrorCode.AUTH_FAILED,
      CexErrorCode.INVALID_API_KEY,
      CexErrorCode.INVALID_SIGNATURE,
      CexErrorCode.IP_RESTRICTED,
    ].includes(this.code);
  }

  /**
   * Returns true if this error is retryable.
   */
  isRetryable(): boolean {
    return [
      CexErrorCode.NETWORK_ERROR,
      CexErrorCode.RATE_LIMIT_EXCEEDED,
      CexErrorCode.SERVICE_UNAVAILABLE,
      CexErrorCode.TIMEOUT,
    ].includes(this.code);
  }
}

/**
 * OKX REST API client with HMAC-SHA256 request signing.
 *
 * Signing algorithm:
 *   prehash = timestamp + method.toUpperCase() + requestPath + body
 *   signature = HMAC-SHA256(secretKey, prehash) → base64
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { OKX_BASE_URL, OKX_API_VERSION, DEFAULT_TIMEOUT_MS } from "../../core/constants.js";
import { hmacSha256Base64, getUtcTimestamp, toQueryString } from "../../core/utils.js";
import { CexError, CexErrorCode } from "../../core/errors.js";
import { RateLimiter } from "../../core/rate-limiter.js";

/** OKX API credentials */
export interface OkxCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

/** OKX raw API response envelope */
interface OkxApiEnvelope<T = unknown> {
  code: string;
  msg: string;
  data: T;
}

/**
 * Low-level OKX REST client.
 * Handles signing, rate limiting, and error parsing.
 */
export class OkxClient {
  private readonly http: AxiosInstance;
  private readonly credentials?: OkxCredentials;
  private readonly rateLimiter: RateLimiter;

  constructor(options: {
    credentials?: OkxCredentials;
    timeout?: number;
    rateLimit?: number;
    testnet?: boolean;
  }) {
    const baseURL = options.testnet
      ? "https://www.okx.com" // OKX uses same base for demo; flag is per-request header
      : OKX_BASE_URL;

    this.http = axios.create({
      baseURL,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.credentials = options.credentials;

    this.rateLimiter = new RateLimiter({
      requestsPerSecond: options.rateLimit ?? 10,
      maxWaitMs: 10_000,
    });

    if (options.testnet) {
      // OKX demo/testnet flag
      this.http.defaults.headers.common["x-simulated-trading"] = "1";
    }
  }

  /**
   * Builds the OKX authentication headers for a signed request.
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param requestPath - Full path including query string, e.g. "/api/v5/account/balance?ccy=BTC"
   * @param body - Request body string (empty string for GET)
   */
  private buildAuthHeaders(
    method: string,
    requestPath: string,
    body: string
  ): Record<string, string> {
    if (!this.credentials) {
      throw new CexError(
        CexErrorCode.AUTH_FAILED,
        "OKX credentials not configured"
      );
    }

    const timestamp = getUtcTimestamp();
    const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
    const signature = hmacSha256Base64(this.credentials.secretKey, prehash);

    return {
      "OK-ACCESS-KEY": this.credentials.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.credentials.passphrase,
    };
  }

  /**
   * Parses an OKX API response envelope and throws on API-level errors.
   */
  private parseEnvelope<T>(response: AxiosResponse<OkxApiEnvelope<T>>): T {
    const { code, msg, data } = response.data;

    if (code !== "0") {
      const errorCode = this.mapOkxErrorCode(code);
      throw new CexError(errorCode, `OKX API error [${code}]: ${msg}`, {
        context: { okxCode: code, okxMsg: msg },
      });
    }

    return data;
  }

  /**
   * Maps OKX error codes to CexErrorCode.
   */
  private mapOkxErrorCode(okxCode: string): CexErrorCode {
    const mapping: Record<string, CexErrorCode> = {
      "50001": CexErrorCode.SERVICE_UNAVAILABLE,
      "50004": CexErrorCode.TIMEOUT,
      "50011": CexErrorCode.RATE_LIMIT_EXCEEDED,
      "50013": CexErrorCode.SERVICE_UNAVAILABLE,
      "50014": CexErrorCode.INVALID_PARAMS,
      "50100": CexErrorCode.INVALID_API_KEY,
      "50101": CexErrorCode.INVALID_API_KEY,
      "50102": CexErrorCode.AUTH_FAILED,
      "50103": CexErrorCode.INVALID_SIGNATURE,
      "50104": CexErrorCode.AUTH_FAILED,
      "50105": CexErrorCode.AUTH_FAILED,
      "50106": CexErrorCode.AUTH_FAILED,
      "50110": CexErrorCode.IP_RESTRICTED,
      "51000": CexErrorCode.INVALID_PARAMS,
      "51001": CexErrorCode.SYMBOL_NOT_FOUND,
      "51008": CexErrorCode.INSUFFICIENT_BALANCE,
      "51010": CexErrorCode.ORDER_NOT_FOUND,
      "51017": CexErrorCode.ORDER_ALREADY_CANCELLED,
      "51401": CexErrorCode.LEVERAGE_EXCEEDS_LIMIT,
    };
    return mapping[okxCode] ?? CexErrorCode.EXCHANGE_ERROR;
  }

  /**
   * Performs a signed GET request.
   *
   * @param path - API path (without base URL), e.g. "/api/v5/account/balance"
   * @param params - Query parameters
   */
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    await this.rateLimiter.acquire();

    const queryString = params ? toQueryString(params) : "";
    const requestPath = queryString ? `${path}?${queryString}` : path;

    try {
      const config: AxiosRequestConfig = { url: requestPath, method: "GET" };

      if (this.credentials) {
        config.headers = this.buildAuthHeaders("GET", requestPath, "");
      }

      const response = await this.http.request<OkxApiEnvelope<T>>(config);
      return this.parseEnvelope(response);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw this.wrapAxiosError(err);
    }
  }

  /**
   * Performs a signed POST request.
   *
   * @param path - API path
   * @param body - Request body object
   */
  async post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    await this.rateLimiter.acquire();

    const bodyStr = JSON.stringify(body);

    try {
      const config: AxiosRequestConfig = {
        url: path,
        method: "POST",
        data: bodyStr,
      };

      if (this.credentials) {
        config.headers = this.buildAuthHeaders("POST", path, bodyStr);
      }

      const response = await this.http.request<OkxApiEnvelope<T>>(config);
      return this.parseEnvelope(response);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw this.wrapAxiosError(err);
    }
  }

  /**
   * Wraps an Axios error into a CexError.
   */
  private wrapAxiosError(err: unknown): CexError {
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
        return new CexError(CexErrorCode.TIMEOUT, `Request timed out: ${err.message}`, {
          cause: err,
        });
      }
      if (!err.response) {
        return new CexError(CexErrorCode.NETWORK_ERROR, `Network error: ${err.message}`, {
          cause: err,
        });
      }
      const status = err.response.status;
      if (status === 429) {
        return new CexError(CexErrorCode.RATE_LIMIT_EXCEEDED, "HTTP 429: Too Many Requests", {
          httpStatus: status,
          cause: err,
        });
      }
      if (status >= 500) {
        return new CexError(CexErrorCode.SERVICE_UNAVAILABLE, `HTTP ${status}: Service error`, {
          httpStatus: status,
          cause: err,
        });
      }
      return new CexError(CexErrorCode.EXCHANGE_ERROR, `HTTP ${status}: ${err.message}`, {
        httpStatus: status,
        cause: err,
      });
    }
    return CexError.from(err);
  }
}

/** Convenience path builder */
export function okxPath(endpoint: string): string {
  return `${OKX_API_VERSION}${endpoint}`;
}

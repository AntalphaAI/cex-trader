/**
 * Global constants for the CEX trader MCP server.
 */

/** OKX API base URL */
export const OKX_BASE_URL = "https://www.okx.com";

/** OKX API version prefix */
export const OKX_API_VERSION = "/api/v5";

/** Binance Spot API base URL */
export const BINANCE_BASE_URL = "https://api.binance.com";

/** Binance Futures API base URL */
export const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com";

/** Default HTTP request timeout (ms) */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Default maximum retry attempts */
export const DEFAULT_MAX_RETRIES = 3;

/** Default retry backoff base (ms) */
export const DEFAULT_RETRY_BACKOFF_MS = 1_000;

/** Default rate limit: requests per second */
export const DEFAULT_RATE_LIMIT_RPS = 10;

/** Token bucket refill interval (ms) */
export const RATE_LIMIT_INTERVAL_MS = 1_000;

/** Maximum number of orders returned per list query */
export const MAX_ORDERS_LIMIT = 100;

/** Maximum order book depth */
export const MAX_ORDERBOOK_DEPTH = 400;

/** MCP server name */
export const MCP_SERVER_NAME = "cex-trader";

/** MCP server version */
export const MCP_SERVER_VERSION = "1.0.0";

/** Audit log directory */
export const AUDIT_LOG_DIR = "~/.trader";

/** Audit log filename */
export const AUDIT_LOG_FILE = "audit.log";

/** OKX instrument type for spot trading */
export const OKX_INST_TYPE_SPOT = "SPOT";

/** OKX instrument type for USDT-margined perpetual swap */
export const OKX_INST_TYPE_SWAP = "SWAP";

/** OKX instrument type for futures */
export const OKX_INST_TYPE_FUTURES = "FUTURES";

/** OKX trade mode for cash (spot) */
export const OKX_TD_MODE_CASH = "cash";

/** OKX trade mode for cross margin */
export const OKX_TD_MODE_CROSS = "cross";

/** OKX trade mode for isolated margin */
export const OKX_TD_MODE_ISOLATED = "isolated";

/** Supported kline intervals mapped to OKX bar values */
export const OKX_KLINE_INTERVALS: Record<string, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "2h": "2H",
  "4h": "4H",
  "6h": "6H",
  "12h": "12H",
  "1d": "1D",
  "1w": "1W",
  "1M": "1M",
};

/** Supported kline intervals mapped to Binance intervals */
export const BINANCE_KLINE_INTERVALS: Record<string, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "6h": "6h",
  "12h": "12h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M",
};

/** OKX order type mappings */
export const OKX_ORDER_TYPES: Record<string, string> = {
  market: "market",
  limit: "limit",
  limit_maker: "post_only",
  ioc: "ioc",
  fok: "fok",
};

/** OKX order side mappings */
export const OKX_ORDER_SIDES: Record<string, string> = {
  buy: "buy",
  sell: "sell",
};

/** OKX order status mappings (OKX -> unified) */
export const OKX_ORDER_STATUS_MAP: Record<string, string> = {
  live: "open",
  partially_filled: "partially_filled",
  filled: "filled",
  canceled: "cancelled",
};

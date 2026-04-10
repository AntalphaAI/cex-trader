/**
 * Core type definitions for the CEX trader MCP server.
 * Provides unified interfaces across OKX, Binance, and future exchanges.
 */

/** Supported exchange identifiers */
export type ExchangeId = "okx" | "binance";

/** Order side */
export type OrderSide = "buy" | "sell";

/** Order type */
export type OrderType = "market" | "limit" | "limit_maker" | "ioc" | "fok";

/** Order status */
export type OrderStatus =
  | "pending"
  | "open"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected";

/** Futures position side */
export type PositionSide = "long" | "short" | "net";

/** Margin mode */
export type MarginMode = "cross" | "isolated";

/** Candle/Kline interval */
export type KlineInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "1w"
  | "1M";

/** Exchange configuration */
export interface ExchangeConfig {
  /** Exchange identifier */
  id: ExchangeId;
  /** API key */
  apiKey: string;
  /** API secret */
  secretKey: string;
  /** Passphrase (required for OKX) */
  passphrase?: string;
  /** Use testnet/sandbox environment */
  testnet?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Rate limit: max requests per second */
  rateLimit?: number;
}

/** Application configuration */
export interface AppConfig {
  /** Default exchange to use */
  defaultExchange: ExchangeId;
  /** Log level */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Read-only mode: disallows all write operations */
  readOnly: boolean;
  /** Exchange configurations */
  exchanges: Partial<Record<ExchangeId, ExchangeConfig>>;
  /** Risk profiles */
  profiles?: Record<string, RiskProfile>;
}

/** Risk profile for a trading session */
export interface RiskProfile {
  futures?: {
    maxLeverage: number;
    maxPositionUsd: number;
    dailyLimitUsd: number;
    marginWarningRatio: number;
    marginDangerRatio: number;
  };
  risk?: {
    maxDailyTrades: number;
    stopLossRatio: number;
  };
}

/** Ticker (market price snapshot) */
export interface Ticker {
  /** Trading pair symbol, e.g. BTC-USDT */
  symbol: string;
  /** Last traded price */
  lastPrice: string;
  /** 24h open price */
  open24h: string;
  /** 24h highest price */
  high24h: string;
  /** 24h lowest price */
  low24h: string;
  /** 24h volume in base currency */
  volume24h: string;
  /** 24h volume in quote currency */
  quoteVolume24h: string;
  /** Best bid price */
  bidPrice: string;
  /** Best bid size */
  bidSize: string;
  /** Best ask price */
  askPrice: string;
  /** Best ask size */
  askSize: string;
  /** Timestamp in milliseconds */
  timestamp: number;
}

/** Kline / OHLCV candlestick data */
export interface Kline {
  /** Open time in milliseconds */
  openTime: number;
  /** Open price */
  open: string;
  /** High price */
  high: string;
  /** Low price */
  low: string;
  /** Close price */
  close: string;
  /** Volume in base currency */
  volume: string;
  /** Volume in quote currency */
  quoteVolume: string;
}

/** Order book entry */
export interface OrderBookEntry {
  /** Price level */
  price: string;
  /** Available quantity */
  size: string;
}

/** Order book snapshot */
export interface OrderBook {
  /** Trading pair symbol */
  symbol: string;
  /** Bid orders (descending price) */
  bids: OrderBookEntry[];
  /** Ask orders (ascending price) */
  asks: OrderBookEntry[];
  /** Timestamp in milliseconds */
  timestamp: number;
}

/** Unified order */
export interface Order {
  /** Exchange order ID */
  orderId: string;
  /** Client-assigned order ID */
  clientOrderId?: string;
  /** Trading pair symbol */
  symbol: string;
  /** Order side */
  side: OrderSide;
  /** Order type */
  type: OrderType;
  /** Order status */
  status: OrderStatus;
  /** Order price (empty for market orders) */
  price: string;
  /** Quantity */
  quantity: string;
  /** Filled quantity */
  filledQuantity: string;
  /** Average fill price */
  avgFillPrice: string;
  /** Creation time in milliseconds */
  createTime: number;
  /** Last update time in milliseconds */
  updateTime: number;
  /** Exchange raw data */
  raw?: Record<string, unknown>;
}

/** Parameters for placing a spot order */
export interface PlaceSpotOrderParams {
  /** Trading pair symbol */
  symbol: string;
  /** Order side */
  side: OrderSide;
  /** Order type */
  type: OrderType;
  /** Quantity */
  quantity: string;
  /** Price (required for limit orders) */
  price?: string;
  /** Client order ID for idempotency */
  clientOrderId?: string;
}

/** Parameters for cancelling an order */
export interface CancelOrderParams {
  /** Trading pair symbol */
  symbol: string;
  /** Exchange order ID */
  orderId?: string;
  /** Client order ID */
  clientOrderId?: string;
}

/** Parameters for querying orders */
export interface GetOrdersParams {
  /** Trading pair symbol */
  symbol?: string;
  /** Order status filter */
  status?: OrderStatus;
  /** Maximum number of results */
  limit?: number;
  /** Start time in milliseconds */
  startTime?: number;
  /** End time in milliseconds */
  endTime?: number;
}

/** Asset balance */
export interface Balance {
  /** Currency/asset code */
  currency: string;
  /** Total balance */
  total: string;
  /** Available balance */
  available: string;
  /** Frozen/locked balance */
  frozen: string;
}

/** Account information */
export interface AccountInfo {
  /** Account user ID */
  userId?: string;
  /** Account type */
  accountType?: string;
  /** Account level */
  accountLevel?: string;
  /** Fee tier */
  feeTier?: string;
  /** Whether unified account is enabled */
  isUnified?: boolean;
}

/** Futures position */
export interface Position {
  /** Position ID */
  positionId?: string;
  /** Trading pair / instrument ID */
  symbol: string;
  /** Position side */
  positionSide: PositionSide;
  /** Margin mode */
  marginMode: MarginMode;
  /** Leverage */
  leverage: number;
  /** Position size (positive = long, negative = short) */
  positionAmt: string;
  /** Entry (average) price */
  entryPrice: string;
  /** Mark price */
  markPrice: string;
  /** Liquidation price */
  liquidationPrice: string;
  /** Unrealized PnL */
  unrealizedPnl: string;
  /** Margin balance */
  margin: string;
  /** Margin ratio (maintenance margin / margin balance) */
  marginRatio: string;
  /** Timestamp in milliseconds */
  timestamp: number;
}

/** Parameters for placing a futures order */
export interface PlaceFuturesOrderParams {
  /** Instrument ID, e.g. BTC-USDT-SWAP */
  symbol: string;
  /** Trading action */
  action: "open_long" | "open_short" | "close_long" | "close_short";
  /** Order type */
  type: OrderType;
  /** Contract quantity */
  quantity: string;
  /** Price (required for limit orders) */
  price?: string;
  /** Leverage (optional, if changing) */
  leverage?: number;
  /** Client order ID for idempotency */
  clientOrderId?: string;
}

/** Parameters for setting leverage */
export interface SetLeverageParams {
  /** Instrument ID */
  symbol: string;
  /** Leverage multiplier */
  leverage: number;
  /** Margin mode */
  marginMode?: MarginMode;
  /** Position side (for isolated margin) */
  positionSide?: PositionSide;
}

/** API request options */
export interface RequestOptions {
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Retry on failure */
  retry?: boolean;
  /** Idempotency key */
  idempotencyKey?: string;
}

/** Generic API response wrapper */
export interface ApiResponse<T> {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data */
  data: T;
  /** Error message if failed */
  error?: string;
  /** Request timestamp in milliseconds */
  timestamp: number;
}

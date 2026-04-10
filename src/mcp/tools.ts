/**
 * MCP tool schemas defined with Zod.
 * Each tool has an input schema and a description.
 */

import { z } from "zod";

// ─────────────── Shared schemas ───────────────

/** Supported exchange IDs */
const exchangeSchema = z
  .enum(["okx", "binance"])
  .optional()
  .describe("Exchange to use (default: configured default_exchange)");

/** Order side */
const sideSchema = z.enum(["buy", "sell"]).describe("Order side");

/** Order type */
const orderTypeSchema = z
  .enum(["market", "limit", "limit_maker", "ioc", "fok"])
  .describe("Order type");

/** Kline interval */
const intervalSchema = z
  .enum(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w", "1M"])
  .describe("Candle interval");

/** Position side */
const positionSideSchema = z
  .enum(["long", "short"])
  .describe("Position side");

/** Margin mode */
const marginModeSchema = z
  .enum(["cross", "isolated"])
  .optional()
  .describe("Margin mode");

// ─────────────── Market tools ───────────────

/**
 * cex-market-get-ticker
 * Fetches the latest price snapshot for a trading pair.
 */
export const marketGetTickerSchema = z.object({
  symbol: z.string().min(1).describe("Trading pair symbol, e.g. BTC-USDT or BTC-USDT-SWAP"),
  exchange: exchangeSchema,
});

export type MarketGetTickerInput = z.infer<typeof marketGetTickerSchema>;

/**
 * cex-market-get-kline
 * Fetches OHLCV candlestick data.
 */
export const marketGetKlineSchema = z.object({
  symbol: z.string().min(1).describe("Trading pair symbol"),
  interval: intervalSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(300)
    .optional()
    .default(100)
    .describe("Number of candles to return (max 300)"),
  exchange: exchangeSchema,
});

export type MarketGetKlineInput = z.infer<typeof marketGetKlineSchema>;

/**
 * cex-market-get-orderbook
 * Fetches the current order book snapshot.
 */
export const marketGetOrderbookSchema = z.object({
  symbol: z.string().min(1).describe("Trading pair symbol"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(400)
    .optional()
    .default(20)
    .describe("Number of price levels per side (max 400)"),
  exchange: exchangeSchema,
});

export type MarketGetOrderbookInput = z.infer<typeof marketGetOrderbookSchema>;

// ─────────────── Spot tools ───────────────

/**
 * cex-spot-place-order
 * Places a spot order. Requires write access.
 */
export const spotPlaceOrderSchema = z.object({
  symbol: z.string().min(1).describe("Trading pair symbol, e.g. BTC-USDT"),
  side: sideSchema,
  type: orderTypeSchema,
  quantity: z.string().min(1).describe("Order quantity in base currency"),
  price: z
    .string()
    .optional()
    .describe("Order price (required for limit orders)"),
  clientOrderId: z
    .string()
    .max(32)
    .optional()
    .describe("Client-assigned order ID for idempotency (max 32 chars)"),
  exchange: exchangeSchema,
});

export type SpotPlaceOrderInput = z.infer<typeof spotPlaceOrderSchema>;

/**
 * cex-spot-cancel-order
 * Cancels an existing spot order.
 */
export const spotCancelOrderSchema = z.object({
  symbol: z.string().min(1).describe("Trading pair symbol"),
  orderId: z.string().optional().describe("Exchange order ID"),
  clientOrderId: z.string().optional().describe("Client order ID"),
  exchange: exchangeSchema,
}).refine(
  (data) => data.orderId || data.clientOrderId,
  { message: "Either orderId or clientOrderId must be provided" }
);

export type SpotCancelOrderInput = z.infer<typeof spotCancelOrderSchema>;

/**
 * cex-spot-get-order
 * Fetches details of a single spot order.
 */
export const spotGetOrderSchema = z.object({
  symbol: z.string().min(1).describe("Trading pair symbol"),
  orderId: z.string().min(1).describe("Exchange order ID"),
  exchange: exchangeSchema,
});

export type SpotGetOrderInput = z.infer<typeof spotGetOrderSchema>;

/**
 * cex-spot-get-orders
 * Lists spot orders with optional filters.
 */
export const spotGetOrdersSchema = z.object({
  symbol: z.string().optional().describe("Filter by trading pair symbol"),
  status: z
    .enum(["pending", "open", "partially_filled", "filled", "cancelled", "rejected"])
    .optional()
    .describe("Filter by order status"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Maximum number of results"),
  startTime: z.number().int().optional().describe("Start time filter (Unix ms)"),
  endTime: z.number().int().optional().describe("End time filter (Unix ms)"),
  exchange: exchangeSchema,
});

export type SpotGetOrdersInput = z.infer<typeof spotGetOrdersSchema>;

// ─────────────── Account tools ───────────────

/**
 * cex-account-get-balance
 * Fetches account asset balances.
 */
export const accountGetBalanceSchema = z.object({
  currencies: z
    .array(z.string())
    .optional()
    .describe("Filter by currency codes, e.g. ['BTC', 'USDT']"),
  exchange: exchangeSchema,
});

export type AccountGetBalanceInput = z.infer<typeof accountGetBalanceSchema>;

/**
 * cex-account-get-info
 * Fetches account configuration and info.
 */
export const accountGetInfoSchema = z.object({
  exchange: exchangeSchema,
});

export type AccountGetInfoInput = z.infer<typeof accountGetInfoSchema>;

// ─────────────── Futures tools ───────────────

/**
 * cex-futures-place-order
 * Places a futures/perpetual swap order using semantic action notation.
 */
export const futuresPlaceOrderSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .describe("Instrument ID, e.g. BTC-USDT-SWAP"),
  action: z
    .enum(["open_long", "open_short", "close_long", "close_short"])
    .describe("Trading action (open_long | open_short | close_long | close_short)"),
  type: orderTypeSchema,
  quantity: z.string().min(1).describe("Number of contracts"),
  price: z
    .string()
    .optional()
    .describe("Limit price (required for limit orders)"),
  leverage: z
    .number()
    .int()
    .min(1)
    .max(125)
    .optional()
    .describe("Leverage to set before placing order"),
  clientOrderId: z
    .string()
    .max(32)
    .optional()
    .describe("Client order ID for idempotency"),
  exchange: exchangeSchema,
});

export type FuturesPlaceOrderInput = z.infer<typeof futuresPlaceOrderSchema>;

/**
 * cex-futures-cancel-order
 * Cancels an existing futures order.
 */
export const futuresCancelOrderSchema = z.object({
  symbol: z.string().min(1).describe("Instrument ID"),
  orderId: z.string().optional().describe("Exchange order ID"),
  clientOrderId: z.string().optional().describe("Client order ID"),
  exchange: exchangeSchema,
}).refine(
  (data) => data.orderId || data.clientOrderId,
  { message: "Either orderId or clientOrderId must be provided" }
);

export type FuturesCancelOrderInput = z.infer<typeof futuresCancelOrderSchema>;

/**
 * cex-futures-get-positions
 * Fetches open futures positions.
 */
export const futuresGetPositionsSchema = z.object({
  symbol: z
    .string()
    .optional()
    .describe("Filter by instrument ID (optional)"),
  exchange: exchangeSchema,
});

export type FuturesGetPositionsInput = z.infer<typeof futuresGetPositionsSchema>;

/**
 * cex-futures-set-leverage
 * Sets the leverage for a futures instrument.
 */
export const futuresSetLeverageSchema = z.object({
  symbol: z.string().min(1).describe("Instrument ID"),
  leverage: z
    .number()
    .int()
    .min(1)
    .max(125)
    .describe("Leverage multiplier (1–125)"),
  marginMode: marginModeSchema,
  positionSide: positionSideSchema.optional(),
  exchange: exchangeSchema,
});

export type FuturesSetLeverageInput = z.infer<typeof futuresSetLeverageSchema>;

/**
 * cex-futures-close-position
 * Closes an open futures position at market price.
 */
export const futuresClosePositionSchema = z.object({
  symbol: z.string().min(1).describe("Instrument ID"),
  positionSide: positionSideSchema,
  exchange: exchangeSchema,
});

export type FuturesClosePositionInput = z.infer<typeof futuresClosePositionSchema>;

// ─────────────── Tool registry ───────────────

/** All MCP tool definitions */
export const TOOL_DEFINITIONS = [
  {
    name: "cex-market-get-ticker",
    description: "Get the latest price ticker (last price, bid, ask, 24h OHLCV) for a trading pair",
    inputSchema: marketGetTickerSchema,
  },
  {
    name: "cex-market-get-kline",
    description: "Get OHLCV candlestick (kline) data for a trading pair",
    inputSchema: marketGetKlineSchema,
  },
  {
    name: "cex-market-get-orderbook",
    description: "Get the current order book snapshot (bids and asks) for a trading pair",
    inputSchema: marketGetOrderbookSchema,
  },
  {
    name: "cex-spot-place-order",
    description: "Place a spot order (buy or sell). Requires write access.",
    inputSchema: spotPlaceOrderSchema,
  },
  {
    name: "cex-spot-cancel-order",
    description: "Cancel an existing spot order",
    inputSchema: spotCancelOrderSchema,
  },
  {
    name: "cex-spot-get-order",
    description: "Get details of a single spot order by ID",
    inputSchema: spotGetOrderSchema,
  },
  {
    name: "cex-spot-get-orders",
    description: "List spot orders with optional filters (symbol, status, time range)",
    inputSchema: spotGetOrdersSchema,
  },
  {
    name: "cex-account-get-balance",
    description: "Get account asset balances (available, frozen, total)",
    inputSchema: accountGetBalanceSchema,
  },
  {
    name: "cex-account-get-info",
    description: "Get account configuration and information",
    inputSchema: accountGetInfoSchema,
  },
  {
    name: "cex-futures-place-order",
    description:
      "Place a futures/perpetual swap order using semantic actions: open_long, open_short, close_long, close_short. Requires write access.",
    inputSchema: futuresPlaceOrderSchema,
  },
  {
    name: "cex-futures-cancel-order",
    description: "Cancel an existing futures order",
    inputSchema: futuresCancelOrderSchema,
  },
  {
    name: "cex-futures-get-positions",
    description: "Get open futures positions",
    inputSchema: futuresGetPositionsSchema,
  },
  {
    name: "cex-futures-set-leverage",
    description: "Set leverage for a futures instrument. Requires write access.",
    inputSchema: futuresSetLeverageSchema,
  },
  {
    name: "cex-futures-close-position",
    description:
      "Close an open futures position at market price. Requires write access.",
    inputSchema: futuresClosePositionSchema,
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]["name"];

/**
 * Abstract Exchange interface.
 * All exchange implementations must satisfy this contract.
 */

import type {
  Ticker,
  Kline,
  KlineInterval,
  OrderBook,
  Order,
  PlaceSpotOrderParams,
  CancelOrderParams,
  GetOrdersParams,
  Balance,
  AccountInfo,
  Position,
  PlaceFuturesOrderParams,
  SetLeverageParams,
} from "./types.js";

/**
 * Abstract base class for CEX exchange adapters.
 * Provides a unified API surface over spot and futures trading,
 * market data, and account queries.
 */
export abstract class Exchange {
  /** Exchange identifier (e.g. "okx", "binance") */
  abstract readonly id: string;

  // ────────────────────────── Market Data ──────────────────────────

  /**
   * Fetches the latest ticker for a symbol.
   * @param symbol - Trading pair, e.g. "BTC-USDT"
   */
  abstract getTicker(symbol: string): Promise<Ticker>;

  /**
   * Fetches OHLCV candlestick data.
   * @param symbol - Trading pair
   * @param interval - Candle interval
   * @param limit - Number of candles to return (default: 100)
   */
  abstract getKlines(
    symbol: string,
    interval: KlineInterval,
    limit?: number
  ): Promise<Kline[]>;

  /**
   * Fetches the current order book snapshot.
   * @param symbol - Trading pair
   * @param depth - Number of price levels on each side (default: 20)
   */
  abstract getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;

  // ────────────────────────── Spot Trading ──────────────────────────

  /**
   * Places a spot order.
   * @param params - Order parameters
   */
  abstract placeSpotOrder(params: PlaceSpotOrderParams): Promise<Order>;

  /**
   * Cancels an existing spot order.
   * @param params - Cancellation parameters
   */
  abstract cancelSpotOrder(params: CancelOrderParams): Promise<Order>;

  /**
   * Fetches a single spot order by ID.
   * @param symbol - Trading pair
   * @param orderId - Exchange order ID
   */
  abstract getSpotOrder(symbol: string, orderId: string): Promise<Order>;

  /**
   * Lists spot orders with optional filters.
   * @param params - Query parameters
   */
  abstract getSpotOrders(params: GetOrdersParams): Promise<Order[]>;

  // ────────────────────────── Futures Trading ──────────────────────────

  /**
   * Places a futures / perpetual swap order.
   * @param params - Futures order parameters
   */
  abstract placeFuturesOrder(params: PlaceFuturesOrderParams): Promise<Order>;

  /**
   * Cancels an existing futures order.
   * @param params - Cancellation parameters
   */
  abstract cancelFuturesOrder(params: CancelOrderParams): Promise<Order>;

  /**
   * Fetches open futures positions.
   * @param symbol - Optional instrument ID filter
   */
  abstract getFuturesPositions(symbol?: string): Promise<Position[]>;

  /**
   * Sets the leverage for a futures instrument.
   * @param params - Leverage parameters
   */
  abstract setLeverage(params: SetLeverageParams): Promise<void>;

  /**
   * Closes an open futures position at market price.
   * @param symbol - Instrument ID
   * @param positionSide - Side to close ("long" | "short")
   */
  abstract closePosition(
    symbol: string,
    positionSide: "long" | "short"
  ): Promise<Order>;

  // ────────────────────────── Account ──────────────────────────

  /**
   * Fetches asset balances for the account.
   * @param currencies - Optional list of currencies to filter
   */
  abstract getBalance(currencies?: string[]): Promise<Balance[]>;

  /**
   * Fetches general account information.
   */
  abstract getAccountInfo(): Promise<AccountInfo>;
}

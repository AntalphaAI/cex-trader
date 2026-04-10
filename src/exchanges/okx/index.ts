/**
 * OKXExchange — unified Exchange implementation for OKX.
 * Composes market, spot, futures, and account services.
 */

import { Exchange } from "../../core/exchange.js";
import type {
  ExchangeConfig,
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
} from "../../core/types.js";
import { OkxClient } from "./client.js";
import { OkxMarketService } from "./market.js";
import { OkxSpotService } from "./spot.js";
import { OkxFuturesService } from "./futures.js";
import { OkxAccountService } from "./account.js";
import { CexError, CexErrorCode } from "../../core/errors.js";

/**
 * OKX exchange adapter.
 * Implements the Exchange abstract class using dedicated service classes.
 */
export class OKXExchange extends Exchange {
  public readonly id = "okx";

  private readonly market: OkxMarketService;
  private readonly spot: OkxSpotService;
  private readonly futures: OkxFuturesService;
  private readonly account: OkxAccountService;

  /**
   * Creates an OKXExchange instance.
   * @param config - Exchange configuration
   */
  constructor(config: ExchangeConfig) {
    super();

    if (!config.apiKey || !config.secretKey || !config.passphrase) {
      throw new CexError(
        CexErrorCode.EXCHANGE_NOT_CONFIGURED,
        "OKX requires apiKey, secretKey, and passphrase"
      );
    }

    const client = new OkxClient({
      credentials: {
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        passphrase: config.passphrase,
      },
      timeout: config.timeout,
      rateLimit: config.rateLimit,
      testnet: config.testnet,
    });

    this.market = new OkxMarketService(client);
    this.spot = new OkxSpotService(client);
    this.futures = new OkxFuturesService(client);
    this.account = new OkxAccountService(client);
  }

  // ─────────────── Market Data ───────────────

  /** @inheritdoc */
  async getTicker(symbol: string): Promise<Ticker> {
    return this.market.getTicker(symbol);
  }

  /** @inheritdoc */
  async getKlines(
    symbol: string,
    interval: KlineInterval,
    limit?: number
  ): Promise<Kline[]> {
    return this.market.getKlines(symbol, interval, limit);
  }

  /** @inheritdoc */
  async getOrderBook(symbol: string, depth?: number): Promise<OrderBook> {
    return this.market.getOrderBook(symbol, depth);
  }

  // ─────────────── Spot Trading ───────────────

  /** @inheritdoc */
  async placeSpotOrder(params: PlaceSpotOrderParams): Promise<Order> {
    return this.spot.placeOrder(params);
  }

  /** @inheritdoc */
  async cancelSpotOrder(params: CancelOrderParams): Promise<Order> {
    return this.spot.cancelOrder(params);
  }

  /** @inheritdoc */
  async getSpotOrder(symbol: string, orderId: string): Promise<Order> {
    return this.spot.getOrder(symbol, orderId);
  }

  /** @inheritdoc */
  async getSpotOrders(params: GetOrdersParams): Promise<Order[]> {
    return this.spot.getOrders(params);
  }

  // ─────────────── Futures Trading ───────────────

  /** @inheritdoc */
  async placeFuturesOrder(params: PlaceFuturesOrderParams): Promise<Order> {
    return this.futures.placeOrder(params);
  }

  /** @inheritdoc */
  async cancelFuturesOrder(params: CancelOrderParams): Promise<Order> {
    return this.futures.cancelOrder(params);
  }

  /** @inheritdoc */
  async getFuturesPositions(symbol?: string): Promise<Position[]> {
    return this.futures.getPositions(symbol);
  }

  /** @inheritdoc */
  async setLeverage(params: SetLeverageParams): Promise<void> {
    return this.futures.setLeverage(params);
  }

  /** @inheritdoc */
  async closePosition(
    symbol: string,
    positionSide: "long" | "short"
  ): Promise<Order> {
    return this.futures.closePosition(symbol, positionSide);
  }

  // ─────────────── Account ───────────────

  /** @inheritdoc */
  async getBalance(currencies?: string[]): Promise<Balance[]> {
    return this.account.getBalance(currencies);
  }

  /** @inheritdoc */
  async getAccountInfo(): Promise<AccountInfo> {
    return this.account.getAccountInfo();
  }
}

/**
 * OKX market data service.
 * Provides ticker, kline, and order book data.
 */

import { OkxClient, okxPath } from "./client.js";
import type { Ticker, Kline, KlineInterval, OrderBook, OrderBookEntry } from "../../core/types.js";
import { OKX_KLINE_INTERVALS } from "../../core/constants.js";
import { CexError, CexErrorCode } from "../../core/errors.js";

/** OKX raw ticker data */
interface OkxTicker {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  vol24h: string;
  volCcy24h: string;
  bidPx: string;
  bidSz: string;
  askPx: string;
  askSz: string;
  ts: string;
}

/** OKX raw kline entry: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm] */
type OkxKlineEntry = [string, string, string, string, string, string, string, string, string];

/** OKX raw order book */
interface OkxOrderBook {
  bids: [string, string, string, string][];
  asks: [string, string, string, string][];
  ts: string;
}

/**
 * OKX market data service.
 */
export class OkxMarketService {
  constructor(private readonly client: OkxClient) {}

  /**
   * Fetches the latest ticker for a spot or swap instrument.
   * @param symbol - Instrument ID, e.g. "BTC-USDT" or "BTC-USDT-SWAP"
   */
  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const data = await this.client.get<OkxTicker[]>(okxPath("/market/ticker"), {
        instId: symbol,
      });

      if (!data || data.length === 0) {
        throw new CexError(
          CexErrorCode.SYMBOL_NOT_FOUND,
          `No ticker found for symbol: ${symbol}`
        );
      }

      const raw = data[0];
      return {
        symbol: raw.instId,
        lastPrice: raw.last,
        open24h: raw.open24h,
        high24h: raw.high24h,
        low24h: raw.low24h,
        volume24h: raw.vol24h,
        quoteVolume24h: raw.volCcy24h,
        bidPrice: raw.bidPx,
        bidSize: raw.bidSz,
        askPrice: raw.askPx,
        askSize: raw.askSz,
        timestamp: parseInt(raw.ts, 10),
      };
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Fetches OHLCV candlestick data.
   * @param symbol - Instrument ID
   * @param interval - Unified interval string
   * @param limit - Number of candles (max 300)
   */
  async getKlines(
    symbol: string,
    interval: KlineInterval,
    limit = 100
  ): Promise<Kline[]> {
    try {
      const bar = OKX_KLINE_INTERVALS[interval];
      if (!bar) {
        throw new CexError(
          CexErrorCode.INVALID_PARAMS,
          `Unsupported kline interval: ${interval}`
        );
      }

      const data = await this.client.get<OkxKlineEntry[]>(okxPath("/market/candles"), {
        instId: symbol,
        bar,
        limit: Math.min(limit, 300),
      });

      return (data ?? []).map((entry) => ({
        openTime: parseInt(entry[0], 10),
        open: entry[1],
        high: entry[2],
        low: entry[3],
        close: entry[4],
        volume: entry[5],
        quoteVolume: entry[7],
      }));
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Fetches the order book snapshot.
   * @param symbol - Instrument ID
   * @param depth - Number of price levels per side (max 400)
   */
  async getOrderBook(symbol: string, depth = 20): Promise<OrderBook> {
    try {
      const sz = Math.min(depth, 400);
      const data = await this.client.get<OkxOrderBook[]>(okxPath("/market/books"), {
        instId: symbol,
        sz,
      });

      if (!data || data.length === 0) {
        throw new CexError(
          CexErrorCode.SYMBOL_NOT_FOUND,
          `No order book found for symbol: ${symbol}`
        );
      }

      const raw = data[0];

      const mapEntries = (
        entries: [string, string, string, string][]
      ): OrderBookEntry[] =>
        entries.map(([price, size]) => ({ price, size }));

      return {
        symbol,
        bids: mapEntries(raw.bids),
        asks: mapEntries(raw.asks),
        timestamp: parseInt(raw.ts, 10),
      };
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }
}

/**
 * OKX futures/perpetual swap trading service.
 * Converts semantic actions (open_long, close_short, etc.) to OKX side+posSide.
 */

import { OkxClient, okxPath } from "./client.js";
import type {
  Order,
  Position,
  PlaceFuturesOrderParams,
  CancelOrderParams,
  SetLeverageParams,
} from "../../core/types.js";
import {
  OKX_ORDER_TYPES,
  OKX_ORDER_STATUS_MAP,
  OKX_TD_MODE_CROSS,
} from "../../core/constants.js";
import { CexError, CexErrorCode } from "../../core/errors.js";

/** OKX raw order for futures */
interface OkxFuturesOrder {
  ordId: string;
  clOrdId: string;
  instId: string;
  side: string;
  posSide: string;
  ordType: string;
  state: string;
  px: string;
  sz: string;
  fillSz: string;
  avgPx: string;
  cTime: string;
  uTime: string;
}

/** OKX raw position */
interface OkxPosition {
  posId: string;
  instId: string;
  posSide: string;
  mgnMode: string;
  lever: string;
  pos: string;
  avgPx: string;
  markPx: string;
  liqPx: string;
  upl: string;
  imr: string;
  mgnRatio: string;
  uTime: string;
}

/** OKX place order response */
interface OkxPlaceOrderResponse {
  ordId: string;
  clOrdId: string;
  sCode: string;
  sMsg: string;
}

/**
 * Translates a semantic action to OKX (side, posSide) pair.
 *
 * OKX futures use dual-position mode:
 *   open_long  → side=buy,  posSide=long
 *   open_short → side=sell, posSide=short
 *   close_long → side=sell, posSide=long
 *   close_short→ side=buy,  posSide=short
 */
function actionToOkxSides(action: PlaceFuturesOrderParams["action"]): {
  side: "buy" | "sell";
  posSide: "long" | "short";
} {
  const map: Record<
    PlaceFuturesOrderParams["action"],
    { side: "buy" | "sell"; posSide: "long" | "short" }
  > = {
    open_long: { side: "buy", posSide: "long" },
    open_short: { side: "sell", posSide: "short" },
    close_long: { side: "sell", posSide: "long" },
    close_short: { side: "buy", posSide: "short" },
  };
  return map[action];
}

/** Maps OKX raw futures order to unified Order */
function mapOkxFuturesOrder(raw: OkxFuturesOrder): Order {
  return {
    orderId: raw.ordId,
    clientOrderId: raw.clOrdId || undefined,
    symbol: raw.instId,
    side: raw.side === "buy" ? "buy" : "sell",
    type: "limit",
    status: OKX_ORDER_STATUS_MAP[raw.state] as Order["status"] ?? "pending",
    price: raw.px ?? "0",
    quantity: raw.sz,
    filledQuantity: raw.fillSz ?? "0",
    avgFillPrice: raw.avgPx ?? "0",
    createTime: parseInt(raw.cTime, 10),
    updateTime: parseInt(raw.uTime, 10),
    raw: raw as unknown as Record<string, unknown>,
  };
}

/** Maps OKX raw position to unified Position */
function mapOkxPosition(raw: OkxPosition): Position {
  return {
    positionId: raw.posId,
    symbol: raw.instId,
    positionSide: raw.posSide === "long" ? "long" : raw.posSide === "short" ? "short" : "net",
    marginMode: raw.mgnMode === "cross" ? "cross" : "isolated",
    leverage: parseFloat(raw.lever),
    positionAmt: raw.pos,
    entryPrice: raw.avgPx,
    markPrice: raw.markPx,
    liquidationPrice: raw.liqPx ?? "0",
    unrealizedPnl: raw.upl,
    margin: raw.imr ?? "0",
    marginRatio: raw.mgnRatio ?? "0",
    timestamp: parseInt(raw.uTime, 10),
  };
}

/**
 * OKX futures / perpetual swap trading service.
 */
export class OkxFuturesService {
  constructor(private readonly client: OkxClient) {}

  /**
   * Places a futures order using semantic action notation.
   * @param params - Futures order parameters
   */
  async placeOrder(params: PlaceFuturesOrderParams): Promise<Order> {
    try {
      const okxType = OKX_ORDER_TYPES[params.type];
      if (!okxType) {
        throw new CexError(
          CexErrorCode.INVALID_PARAMS,
          `Unsupported order type: ${params.type}`
        );
      }

      const { side, posSide } = actionToOkxSides(params.action);

      const body: Record<string, unknown> = {
        instId: params.symbol,
        tdMode: OKX_TD_MODE_CROSS,
        side,
        posSide,
        ordType: okxType,
        sz: params.quantity,
      };

      if (params.price) body["px"] = params.price;
      if (params.clientOrderId) body["clOrdId"] = params.clientOrderId;

      const data = await this.client.post<OkxPlaceOrderResponse[]>(
        okxPath("/trade/order"),
        body
      );

      if (!data || data.length === 0) {
        throw new CexError(CexErrorCode.EXCHANGE_ERROR, "Empty response from place order");
      }

      const resp = data[0];

      if (resp.sCode !== "0") {
        throw new CexError(
          CexErrorCode.EXCHANGE_ERROR,
          `OKX futures place order error [${resp.sCode}]: ${resp.sMsg}`,
          { context: { sCode: resp.sCode, sMsg: resp.sMsg } }
        );
      }

      return this.getOrder(params.symbol, resp.ordId);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Cancels an existing futures order.
   * @param params - Cancellation parameters
   */
  async cancelOrder(params: CancelOrderParams): Promise<Order> {
    try {
      if (!params.orderId && !params.clientOrderId) {
        throw new CexError(
          CexErrorCode.INVALID_PARAMS,
          "Either orderId or clientOrderId is required"
        );
      }

      const body: Record<string, unknown> = { instId: params.symbol };
      if (params.orderId) body["ordId"] = params.orderId;
      if (params.clientOrderId) body["clOrdId"] = params.clientOrderId;

      interface OkxCancelResponse {
        ordId: string;
        clOrdId: string;
        sCode: string;
        sMsg: string;
      }

      const data = await this.client.post<OkxCancelResponse[]>(
        okxPath("/trade/cancel-order"),
        body
      );

      if (!data || data.length === 0) {
        throw new CexError(CexErrorCode.EXCHANGE_ERROR, "Empty response from cancel order");
      }

      const resp = data[0];

      if (resp.sCode !== "0") {
        throw new CexError(
          CexErrorCode.EXCHANGE_ERROR,
          `OKX futures cancel error [${resp.sCode}]: ${resp.sMsg}`,
          { context: { sCode: resp.sCode, sMsg: resp.sMsg } }
        );
      }

      return this.getOrder(params.symbol, resp.ordId);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Fetches a single futures order.
   */
  async getOrder(symbol: string, orderId: string): Promise<Order> {
    try {
      const data = await this.client.get<OkxFuturesOrder[]>(okxPath("/trade/order"), {
        instId: symbol,
        ordId: orderId,
      });

      if (!data || data.length === 0) {
        throw new CexError(CexErrorCode.ORDER_NOT_FOUND, `Futures order not found: ${orderId}`);
      }

      return mapOkxFuturesOrder(data[0]);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Fetches open futures positions.
   * @param symbol - Optional instrument ID filter
   */
  async getPositions(symbol?: string): Promise<Position[]> {
    try {
      const query: Record<string, unknown> = { instType: "SWAP" };
      if (symbol) query["instId"] = symbol;

      const data = await this.client.get<OkxPosition[]>(
        okxPath("/account/positions"),
        query
      );

      return (data ?? []).map(mapOkxPosition);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Sets leverage for a futures instrument.
   * @param params - Leverage parameters
   */
  async setLeverage(params: SetLeverageParams): Promise<void> {
    try {
      const body: Record<string, unknown> = {
        instId: params.symbol,
        lever: params.leverage.toString(),
        mgnMode: params.marginMode ?? "cross",
      };

      if (params.positionSide && params.marginMode === "isolated") {
        body["posSide"] = params.positionSide;
      }

      interface OkxLeverageResponse {
        instId: string;
        mgnMode: string;
        posSide: string;
        lever: string;
      }

      await this.client.post<OkxLeverageResponse[]>(
        okxPath("/account/set-leverage"),
        body
      );
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Closes an open futures position at market price.
   * @param symbol - Instrument ID
   * @param positionSide - Side to close
   */
  async closePosition(
    symbol: string,
    positionSide: "long" | "short"
  ): Promise<Order> {
    try {
      // Fetch the current position to determine size
      const positions = await this.getPositions(symbol);
      const position = positions.find(
        (p) => p.symbol === symbol && p.positionSide === positionSide
      );

      if (!position) {
        throw new CexError(
          CexErrorCode.POSITION_NOT_FOUND,
          `No open ${positionSide} position found for ${symbol}`
        );
      }

      const absSize = position.positionAmt.startsWith("-")
        ? position.positionAmt.slice(1)
        : position.positionAmt;

      const action =
        positionSide === "long" ? "close_long" : "close_short";

      return this.placeOrder({
        symbol,
        action,
        type: "market",
        quantity: absSize,
      });
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }
}

/**
 * OKX spot trading service.
 * Handles order placement, cancellation, and querying.
 */

import { OkxClient, okxPath } from "./client.js";
import type {
  Order,
  PlaceSpotOrderParams,
  CancelOrderParams,
  GetOrdersParams,
} from "../../core/types.js";
import {
  OKX_ORDER_TYPES,
  OKX_ORDER_STATUS_MAP,
  OKX_TD_MODE_CASH,
} from "../../core/constants.js";
import { CexError, CexErrorCode } from "../../core/errors.js";

/** OKX raw order object */
interface OkxOrder {
  ordId: string;
  clOrdId: string;
  instId: string;
  side: string;
  ordType: string;
  state: string;
  px: string;
  sz: string;
  fillSz: string;
  avgPx: string;
  cTime: string;
  uTime: string;
}

/** OKX place order response */
interface OkxPlaceOrderResponse {
  ordId: string;
  clOrdId: string;
  tag: string;
  sCode: string;
  sMsg: string;
}

/**
 * Maps an OKX raw order to the unified Order interface.
 */
function mapOkxOrder(raw: OkxOrder): Order {
  return {
    orderId: raw.ordId,
    clientOrderId: raw.clOrdId || undefined,
    symbol: raw.instId,
    side: raw.side === "buy" ? "buy" : "sell",
    type: mapOkxOrderType(raw.ordType),
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

/** Maps OKX order type back to unified type */
function mapOkxOrderType(okxType: string): Order["type"] {
  const reverseMap: Record<string, Order["type"]> = {
    market: "market",
    limit: "limit",
    post_only: "limit_maker",
    ioc: "ioc",
    fok: "fok",
  };
  return reverseMap[okxType] ?? "limit";
}

/**
 * OKX spot trading service.
 */
export class OkxSpotService {
  constructor(private readonly client: OkxClient) {}

  /**
   * Places a spot order.
   * @param params - Order parameters
   */
  async placeOrder(params: PlaceSpotOrderParams): Promise<Order> {
    try {
      const okxType = OKX_ORDER_TYPES[params.type];
      if (!okxType) {
        throw new CexError(
          CexErrorCode.INVALID_PARAMS,
          `Unsupported order type: ${params.type}`
        );
      }

      const body: Record<string, unknown> = {
        instId: params.symbol,
        tdMode: OKX_TD_MODE_CASH,
        side: params.side,
        ordType: okxType,
        sz: params.quantity,
      };

      if (params.price) {
        body["px"] = params.price;
      }

      if (params.clientOrderId) {
        body["clOrdId"] = params.clientOrderId;
      }

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
          `OKX place order error [${resp.sCode}]: ${resp.sMsg}`,
          { context: { sCode: resp.sCode, sMsg: resp.sMsg } }
        );
      }

      // Fetch the placed order details
      return this.getOrder(params.symbol, resp.ordId);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Cancels an existing spot order.
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

      const body: Record<string, unknown> = {
        instId: params.symbol,
      };

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
          `OKX cancel order error [${resp.sCode}]: ${resp.sMsg}`,
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
   * Fetches a single spot order.
   * @param symbol - Instrument ID
   * @param orderId - OKX order ID
   */
  async getOrder(symbol: string, orderId: string): Promise<Order> {
    try {
      const data = await this.client.get<OkxOrder[]>(okxPath("/trade/order"), {
        instId: symbol,
        ordId: orderId,
      });

      if (!data || data.length === 0) {
        throw new CexError(CexErrorCode.ORDER_NOT_FOUND, `Order not found: ${orderId}`);
      }

      return mapOkxOrder(data[0]);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Lists spot orders with optional filters.
   * @param params - Query parameters
   */
  async getOrders(params: GetOrdersParams): Promise<Order[]> {
    try {
      const query: Record<string, unknown> = {
        instType: "SPOT",
      };

      if (params.symbol) query["instId"] = params.symbol;
      if (params.limit) query["limit"] = Math.min(params.limit, 100);

      // Choose endpoint based on status filter
      let endpoint: string;
      if (!params.status || params.status === "open" || params.status === "partially_filled") {
        endpoint = okxPath("/trade/orders-pending");
      } else {
        endpoint = okxPath("/trade/orders-history");
        // OKX history requires a date range if not providing instId
        if (params.startTime) query["begin"] = params.startTime;
        if (params.endTime) query["end"] = params.endTime;
      }

      const data = await this.client.get<OkxOrder[]>(endpoint, query);
      return (data ?? []).map(mapOkxOrder);
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }
}

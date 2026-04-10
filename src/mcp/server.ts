/**
 * MCP Server for CEX Trader.
 * Uses stdio transport and the official @modelcontextprotocol/sdk.
 * Supports READ_ONLY mode which disables all write operations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

import type { AppConfig } from "../core/types.js";
import { CexError, CexErrorCode } from "../core/errors.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../core/constants.js";
import { assertWriteAllowed } from "../core/retry.js";
import { auditLog } from "../security/audit-log.js";
import { OKXExchange } from "../exchanges/okx/index.js";
import type { Exchange } from "../core/exchange.js";
import {
  TOOL_DEFINITIONS,
  marketGetTickerSchema,
  marketGetKlineSchema,
  marketGetOrderbookSchema,
  spotPlaceOrderSchema,
  spotCancelOrderSchema,
  spotGetOrderSchema,
  spotGetOrdersSchema,
  accountGetBalanceSchema,
  accountGetInfoSchema,
  futuresPlaceOrderSchema,
  futuresCancelOrderSchema,
  futuresGetPositionsSchema,
  futuresSetLeverageSchema,
  futuresClosePositionSchema,
} from "./tools.js";

/** Write-mode tool names */
const WRITE_TOOLS = new Set([
  "cex-spot-place-order",
  "cex-spot-cancel-order",
  "cex-futures-place-order",
  "cex-futures-cancel-order",
  "cex-futures-set-leverage",
  "cex-futures-close-position",
]);

/**
 * Converts a Zod schema to a JSON Schema object for MCP tool registration.
 * This is a simplified converter for the schemas used in this project.
 */
function zodToJsonSchema(schema: import("zod").ZodTypeAny): Record<string, unknown> {
  // Use a simple approach: describe top-level object properties
  if (schema._def.typeName === "ZodObject") {
    const shape = (schema as import("zod").ZodObject<import("zod").ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as import("zod").ZodTypeAny;
      const isOptional =
        fieldSchema._def.typeName === "ZodOptional" ||
        fieldSchema._def.typeName === "ZodDefault";

      if (!isOptional) {
        required.push(key);
      }

      properties[key] = { type: "string", description: fieldSchema.description ?? key };
    }

    return {
      type: "object",
      properties,
      required,
    };
  }
  return { type: "object" };
}

/**
 * Formats a successful tool result as MCP CallToolResult.
 */
function successResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Formats an error as MCP CallToolResult with isError=true.
 */
function errorResult(err: unknown): CallToolResult {
  const message =
    err instanceof CexError
      ? `[${err.code}] ${err.message}`
      : err instanceof Error
      ? err.message
      : String(err);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Creates and starts the MCP stdio server.
 * @param config - Application configuration
 */
export async function startMcpServer(config: AppConfig): Promise<void> {
  const readOnly = config.readOnly;

  // Build exchange registry
  const exchanges: Map<string, Exchange> = new Map();

  for (const [id, exchangeConfig] of Object.entries(config.exchanges)) {
    if (!exchangeConfig) continue;
    try {
      if (id === "okx") {
        exchanges.set("okx", new OKXExchange(exchangeConfig));
      }
      // Binance would be added here in Phase 2
    } catch (err) {
      console.error(`[cex-trader] Failed to initialize exchange ${id}:`, err);
    }
  }

  /**
   * Resolves the exchange to use for a request.
   * Falls back to config.defaultExchange if not specified.
   */
  function resolveExchange(requestedId?: string): Exchange {
    const id = requestedId ?? config.defaultExchange;
    const exchange = exchanges.get(id);
    if (!exchange) {
      throw new CexError(
        CexErrorCode.EXCHANGE_NOT_CONFIGURED,
        `Exchange "${id}" is not configured. Available: ${[...exchanges.keys()].join(", ")}`
      );
    }
    return exchange;
  }

  // Create MCP server
  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startMs = Date.now();

    // Guard write operations in read-only mode
    if (WRITE_TOOLS.has(name)) {
      try {
        assertWriteAllowed(readOnly);
      } catch (err) {
        await auditLog.logError("system.error", { code: "READ_ONLY_MODE", message: String(err) });
        return errorResult(err);
      }
    }

    try {
      const result = await dispatchTool(name, args ?? {}, resolveExchange);

      const durationMs = Date.now() - startMs;
      // Best-effort audit log
      await auditLog.logSuccess(mapToolToAction(name), {
        durationMs,
        params: args as Record<string, unknown>,
      }).catch(() => undefined);

      return successResult(result);
    } catch (err) {
      const durationMs = Date.now() - startMs;

      const errObj =
        err instanceof Error ? { code: (err as CexError).code ?? "ERROR", message: err.message } : { code: "ERROR", message: String(err) };

      await auditLog.logError(mapToolToAction(name), errObj, {
        durationMs,
        params: args as Record<string, unknown>,
      }).catch(() => undefined);

      return errorResult(err);
    }
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  await auditLog.logSuccess("system.startup", {
    result: { readOnly, exchanges: [...exchanges.keys()] },
  });

  console.error(
    `[cex-trader] MCP server started (readOnly=${readOnly}, exchanges=${[...exchanges.keys()].join(",")})`
  );
}

/**
 * Dispatches a tool call to the correct exchange method.
 */
async function dispatchTool(
  name: string,
  rawArgs: Record<string, unknown>,
  resolveExchange: (id?: string) => Exchange
): Promise<unknown> {
  switch (name) {
    case "cex-market-get-ticker": {
      const args = marketGetTickerSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getTicker(args.symbol);
    }

    case "cex-market-get-kline": {
      const args = marketGetKlineSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getKlines(args.symbol, args.interval, args.limit);
    }

    case "cex-market-get-orderbook": {
      const args = marketGetOrderbookSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getOrderBook(args.symbol, args.depth);
    }

    case "cex-spot-place-order": {
      const args = spotPlaceOrderSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.placeSpotOrder({
        symbol: args.symbol,
        side: args.side,
        type: args.type,
        quantity: args.quantity,
        price: args.price,
        clientOrderId: args.clientOrderId,
      });
    }

    case "cex-spot-cancel-order": {
      const args = spotCancelOrderSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.cancelSpotOrder({
        symbol: args.symbol,
        orderId: args.orderId,
        clientOrderId: args.clientOrderId,
      });
    }

    case "cex-spot-get-order": {
      const args = spotGetOrderSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getSpotOrder(args.symbol, args.orderId);
    }

    case "cex-spot-get-orders": {
      const args = spotGetOrdersSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getSpotOrders({
        symbol: args.symbol,
        status: args.status,
        limit: args.limit,
        startTime: args.startTime,
        endTime: args.endTime,
      });
    }

    case "cex-account-get-balance": {
      const args = accountGetBalanceSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getBalance(args.currencies);
    }

    case "cex-account-get-info": {
      const args = accountGetInfoSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getAccountInfo();
    }

    case "cex-futures-place-order": {
      const args = futuresPlaceOrderSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);

      // Optionally set leverage before placing
      if (args.leverage !== undefined) {
        await ex.setLeverage({
          symbol: args.symbol,
          leverage: args.leverage,
        });
      }

      return ex.placeFuturesOrder({
        symbol: args.symbol,
        action: args.action,
        type: args.type,
        quantity: args.quantity,
        price: args.price,
        clientOrderId: args.clientOrderId,
      });
    }

    case "cex-futures-cancel-order": {
      const args = futuresCancelOrderSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.cancelFuturesOrder({
        symbol: args.symbol,
        orderId: args.orderId,
        clientOrderId: args.clientOrderId,
      });
    }

    case "cex-futures-get-positions": {
      const args = futuresGetPositionsSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.getFuturesPositions(args.symbol);
    }

    case "cex-futures-set-leverage": {
      const args = futuresSetLeverageSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      await ex.setLeverage({
        symbol: args.symbol,
        leverage: args.leverage,
        marginMode: args.marginMode,
        positionSide: args.positionSide,
      });
      return { success: true, symbol: args.symbol, leverage: args.leverage };
    }

    case "cex-futures-close-position": {
      const args = futuresClosePositionSchema.parse(rawArgs);
      const ex = resolveExchange(args.exchange);
      return ex.closePosition(args.symbol, args.positionSide);
    }

    default:
      throw new CexError(
        CexErrorCode.NOT_IMPLEMENTED,
        `Unknown tool: ${name}`
      );
  }
}

/** Maps tool name to audit action */
function mapToolToAction(name: string): import("../security/audit-log.js").AuditAction {
  const map: Record<string, import("../security/audit-log.js").AuditAction> = {
    "cex-market-get-ticker": "market.getTicker",
    "cex-market-get-kline": "market.getKline",
    "cex-market-get-orderbook": "market.getOrderBook",
    "cex-spot-place-order": "spot.placeOrder",
    "cex-spot-cancel-order": "spot.cancelOrder",
    "cex-spot-get-order": "spot.getOrder",
    "cex-spot-get-orders": "spot.getOrders",
    "cex-account-get-balance": "account.getBalance",
    "cex-account-get-info": "account.getInfo",
    "cex-futures-place-order": "futures.placeOrder",
    "cex-futures-cancel-order": "futures.cancelOrder",
    "cex-futures-get-positions": "futures.getPositions",
    "cex-futures-set-leverage": "futures.setLeverage",
    "cex-futures-close-position": "futures.closePosition",
  };
  return map[name] ?? "system.error";
}

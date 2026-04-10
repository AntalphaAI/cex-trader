#!/usr/bin/env node
/**
 * CEX Trader MCP Server — entry point.
 *
 * Loads configuration from environment variables and optional TOML config file,
 * then starts the MCP stdio server.
 */

import { config as loadDotenv } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as TOML from "toml";

import type { AppConfig, ExchangeConfig } from "./core/types.js";
import { startMcpServer } from "./mcp/server.js";

// Load .env file if present
loadDotenv();

/**
 * Resolves a path relative to the project root.
 */
function projectPath(...parts: string[]): string {
  return join(__dirname, "..", ...parts);
}

/**
 * Loads the TOML configuration file if it exists.
 * Falls back to empty object if file is missing.
 */
function loadTomlConfig(): Record<string, unknown> {
  const configPath = projectPath("config", "default.toml");
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = readFileSync(configPath, "utf8");
    return TOML.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error("[cex-trader] Failed to parse config/default.toml:", err);
    return {};
  }
}

/**
 * Builds the AppConfig from environment variables and TOML config.
 */
function buildConfig(): AppConfig {
  const toml = loadTomlConfig();
  const general = (toml["general"] ?? {}) as Record<string, unknown>;

  const readOnly =
    process.env["READ_ONLY"] === "true" ||
    general["read_only"] === true;

  const logLevel = (
    process.env["LOG_LEVEL"] ??
    general["log_level"] ??
    "info"
  ) as AppConfig["logLevel"];

  const defaultExchange = (
    process.env["DEFAULT_EXCHANGE"] ??
    general["default_exchange"] ??
    "okx"
  ) as AppConfig["defaultExchange"];

  // Build exchange configs from environment
  const exchanges: Partial<Record<string, ExchangeConfig>> = {};

  const okxApiKey = process.env["OKX_API_KEY"];
  const okxSecretKey = process.env["OKX_SECRET_KEY"];
  const okxPassphrase = process.env["OKX_PASSPHRASE"];

  if (okxApiKey && okxSecretKey && okxPassphrase) {
    exchanges["okx"] = {
      id: "okx",
      apiKey: okxApiKey,
      secretKey: okxSecretKey,
      passphrase: okxPassphrase,
      testnet: process.env["OKX_TESTNET"] === "true",
      timeout: parseInt(process.env["OKX_TIMEOUT"] ?? "10000", 10),
      rateLimit: parseInt(process.env["OKX_RATE_LIMIT"] ?? "10", 10),
    };
  }

  const binanceApiKey = process.env["BINANCE_API_KEY"];
  const binanceSecretKey = process.env["BINANCE_SECRET_KEY"];

  if (binanceApiKey && binanceSecretKey) {
    exchanges["binance"] = {
      id: "binance",
      apiKey: binanceApiKey,
      secretKey: binanceSecretKey,
      testnet: process.env["BINANCE_TESTNET"] === "true",
      timeout: parseInt(process.env["BINANCE_TIMEOUT"] ?? "10000", 10),
      rateLimit: parseInt(process.env["BINANCE_RATE_LIMIT"] ?? "10", 10),
    };
  }

  // Load risk profiles from TOML
  const profiles = toml["profiles"] as Record<string, unknown> | undefined;

  return {
    defaultExchange,
    logLevel,
    readOnly,
    exchanges,
    profiles: profiles as AppConfig["profiles"],
  };
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    const config = buildConfig();
    await startMcpServer(config);
  } catch (err) {
    console.error("[cex-trader] Fatal error during startup:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[cex-trader] Unhandled error:", err);
  process.exit(1);
});

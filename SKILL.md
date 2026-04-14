---
name: cex-trader
version: 2.0.2
description: |
  Unified CEX trading capability layer for AI agents. Supports OKX and Binance spot and futures
  trading, account balance queries, order management, position queries, leverage settings,
  margin mode configuration, and guided API key setup flow. MCP tools: cex-spot-place-order,
  cex-spot-cancel-order, cex-futures-place-order, cex-futures-cancel-order,
  cex-futures-get-positions, cex-futures-set-leverage, cex-futures-close-position,
  cex-account-get-balance, cex-account-get-info, cex-setup-check, cex-setup-save,
  cex-setup-verify. Supports action semantics (open_long/open_short/close_long/close_short)
  and native side+posSide parameters. Built-in idempotency check, rate limiting,
  and risk controls (margin monitoring, position limits). Supports OKX and Binance exchanges.
  Swap tokens, buy crypto, sell crypto, CEX trade, exchange order, spot order, futures order,
  perpetual contract, leverage trading, close position, binance trade, okx trade.
license: MIT
metadata:
  openclaw:
    requires:
      bins: []
      env:
        - name: CEX_OKX_API_KEY
          description: OKX API key. Required if trading on OKX.
          required: false
        - name: CEX_OKX_API_SECRET
          description: OKX API secret. Required if trading on OKX.
          required: false
        - name: CEX_OKX_PASSPHRASE
          description: OKX API passphrase. Required if trading on OKX.
          required: false
        - name: CEX_BINANCE_API_KEY
          description: Binance API key. Required if trading on Binance.
          required: false
        - name: CEX_BINANCE_API_SECRET
          description: Binance API secret. Required if trading on Binance.
          required: false
        - name: MCP_SERVER_URL
          description: MCP server base URL for the CLI script. Defaults to http://localhost:3000. Set to https://mcp-skills.ai.antalpha.com/mcp to use the hosted server.
          required: false
    credentials:
      primary: env
      note: |
        API keys are transmitted to the MCP server (see mcp.url or MCP_SERVER_URL).
        The ~/.trader/config.toml written by install.sh stores risk parameters only — never API keys.
        Credentials are NOT stored on disk by this skill.
  mcp:
    url: "https://mcp-skills.ai.antalpha.com/mcp"
    tools:
      - name: cex-spot-place-order
        description: Place a spot order (market or limit) on OKX or Binance
      - name: cex-spot-cancel-order
        description: Cancel an existing spot order on OKX or Binance
      - name: cex-account-get-balance
        description: Query account balance for all assets on OKX or Binance
      - name: cex-futures-place-order
        description: Place a futures/perpetual order with action semantics or native params on OKX or Binance
      - name: cex-futures-cancel-order
        description: Cancel an existing futures order on OKX or Binance
      - name: cex-futures-get-positions
        description: Query open futures positions on OKX or Binance
      - name: cex-futures-set-leverage
        description: Set leverage for a futures instrument on OKX or Binance
      - name: cex-futures-close-position
        description: Close an open futures position on OKX or Binance
      - name: cex-account-get-info
        description: Get account configuration and summary on OKX or Binance
      - name: cex-setup-check
        description: Check whether API credentials are configured for OKX or Binance. Call this at the start of every session.
      - name: cex-setup-save
        description: Save OKX or Binance API credentials (apiKey, secretKey, and passphrase for OKX)
      - name: cex-setup-verify
        description: Verify saved API credentials by making a test call to the exchange
---

# cex-trader

> v2.0.2 · Unified CEX Trading Capability Layer for AI Agents

⚠️ **Risk Warning**: Futures trading involves high leverage and may result in significant losses.
Only use funds you can afford to lose.

## Overview

`cex-trader` is a unified CEX trading MCP server that enables AI agents to trade on
centralized exchanges (OKX, Binance) through a consistent interface.

## Supported Exchanges

- **OKX** — Spot + Futures (MVP-α, production ready)
- **Binance** — Spot + Futures (MVP-β, production ready)

## MCP Tools (12 total)

### Setup Tools

| Tool | Description |
|------|-------------|
| `cex-setup-check` | Check if API credentials are configured |
| `cex-setup-save` | Save API credentials for OKX or Binance |
| `cex-setup-verify` | Verify credentials via a test API call |

### Spot Tools

| Tool | Description |
|------|-------------|
| `cex-spot-place-order` | Place spot market or limit order |
| `cex-spot-cancel-order` | Cancel spot order |
| `cex-account-get-balance` | Query account balance |

### Futures Tools

| Tool | Description |
|------|-------------|
| `cex-futures-place-order` | Place futures order (action semantics or native params) |
| `cex-futures-cancel-order` | Cancel futures order |
| `cex-futures-get-positions` | Query open positions |
| `cex-futures-set-leverage` | Set leverage (1-20x) |
| `cex-futures-close-position` | Close position |
| `cex-account-get-info` | Get account config and summary |

## Changelog

### v2.0.2 (2026-04-14)
- Fix: Corrected MCP server URL from mcp.antalpha.com/cex-trader to mcp-skills.ai.antalpha.com/mcp in mcp.url and MCP_SERVER_URL description

### v2.0.1 (2026-04-14)
- Docs: Declared required env vars (CEX_OKX_*, CEX_BINANCE_*, MCP_SERVER_URL) in SKILL.md metadata
- Docs: Clarified credential transmission path (env vars → MCP server; ~/.trader/config.toml stores risk params only)
- Docs: Aligned MCP_SERVER_URL default (localhost:3000) with hosted URL in SKILL.md

### v2.0.0 (2026-04-13)
- Added: Full Binance exchange support (Spot + Futures, MVP-β)
- Added: ExchangeRouter, BinanceClientService (HMAC-SHA256 signing)
- Added: cex-setup-check / cex-setup-save / cex-setup-verify onboarding tools
- Fixed: BINANCE_ERROR_MAP error code mappings
- Fixed: closePosition dual-side mode handling
- All original tools now accept exchange parameter (defaults to okx, backward-compatible)

### v1.0.0 (2026-04-10)
- Initial release: OKX spot + futures trading (MVP-α)
- 9 MCP tools, action semantics, idempotency, risk controls

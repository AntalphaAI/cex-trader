---
name: cex-trader
version: 1.0.0
description: |
  Unified CEX trading capability layer for AI agents. Supports OKX spot and futures trading,
  account balance queries, order management, position queries, leverage settings,
  and margin mode configuration. MCP tools: cex-spot-place-order, cex-spot-cancel-order,
  cex-futures-place-order, cex-futures-cancel-order, cex-futures-get-positions,
  cex-futures-set-leverage, cex-futures-close-position, cex-account-get-balance,
  cex-account-get-info. Supports action semantics (open_long/open_short/close_long/close_short)
  and native side+posSide parameters. Built-in idempotency check, rate limiting,
  and risk controls (margin monitoring, position limits).
license: MIT
metadata:
  openclaw:
    requires:
      bins: []
  mcp:
    url: "https://mcp.antalpha.com/cex-trader"
    tools:
      - name: cex-spot-place-order
        description: Place a spot order (market or limit) on OKX or Binance
      - name: cex-spot-cancel-order
        description: Cancel an existing spot order
      - name: cex-account-get-balance
        description: Query account balance for all assets
      - name: cex-futures-place-order
        description: Place a futures/perpetual order with action semantics or native params
      - name: cex-futures-cancel-order
        description: Cancel an existing futures order
      - name: cex-futures-get-positions
        description: Query open futures positions
      - name: cex-futures-set-leverage
        description: Set leverage for a futures instrument
      - name: cex-futures-close-position
        description: Close an open futures position
      - name: cex-account-get-info
        description: Get account configuration and summary
---

# cex-trader

> v1.0.0 · Unified CEX Trading Capability Layer for AI Agents

⚠️ **Risk Warning**: Futures trading involves high leverage and may result in significant losses.
Only use funds you can afford to lose.

## Overview

`cex-trader` is a unified CEX trading MCP server that enables AI agents to trade on
centralized exchanges (OKX, Binance) through a consistent interface. It abstracts
exchange-specific differences so AI agents don't need to handle them.

## Supported Exchanges

- **OKX** — Spot + Futures (MVP-α, fully tested)
- **Binance** — Spot + Futures (MVP-β, planned)

## MCP Tools

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
| `cex-futures-close-position` | Close position (auto-detects margin mode) |
| `cex-account-get-info` | Get account config and summary |

## Quick Start

### Spot Trading

```python
# Place a limit buy order
result = mcp.call("cex-spot-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT",
    "side": "buy",
    "ordType": "limit",
    "sz": "0.001",
    "px": "50000"
})
```

### Futures Trading — Action Semantics (Recommended for AI Agents)

```python
# Open long position (100 USDT, 10x leverage, isolated margin)
result = mcp.call("cex-futures-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT-SWAP",
    "action": "open_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})

# Close long position
result = mcp.call("cex-futures-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT-SWAP",
    "action": "close_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})
```

### Futures Trading — Native Params (Advanced Users)

```python
# Open long (side=buy + posSide=long)
result = mcp.call("cex-futures-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT-SWAP",
    "side": "buy",
    "posSide": "long",
    "ordType": "limit",
    "sz": "1",
    "px": "50000",
    "leverage": 10,
    "mgnMode": "isolated"
})
```

## Action Semantics

The `action` parameter simplifies futures order direction:

| Action | side | posSide | Description |
|--------|------|---------|-------------|
| `open_long` | buy | long | Open long position |
| `open_short` | sell | short | Open short position |
| `close_long` | sell | long | Close long position |
| `close_short` | buy | short | Close short position |

If both `action` and native `side+posSide` are provided:
- If semantically consistent → `action` takes priority
- If conflicting → returns `ACTION_CONFLICT (4009)` error

## Configuration

Credentials are stored in environment variables (never in config files):

```bash
export CEX_OKX_API_KEY="your-api-key"
export CEX_OKX_API_SECRET="your-secret"
export CEX_OKX_PASSPHRASE="your-passphrase"
```

Risk parameters are configured in `~/.trader/config.toml`:

```toml
[general]
default_exchange = "okx"
log_level = "info"

[profiles.ai-trading.futures]
max_leverage = 10
max_position_usd = 5000
daily_limit_usd = 10000
margin_warning_ratio = 1.05
margin_danger_ratio = 1.02
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1001 | NETWORK_ERROR | Network connectivity issue |
| 1002 | RATE_LIMIT_EXCEEDED | Too many requests |
| 2001 | INSUFFICIENT_BALANCE | Not enough balance |
| 2002 | INVALID_API_KEY | API key authentication failed |
| 3001 | INVALID_PRICE | Order price out of range |
| 4001 | INSUFFICIENT_MARGIN | Not enough margin for position |
| 4002 | POSITION_NOT_FOUND | Position does not exist |
| 4003 | INVALID_LEVERAGE | Leverage value out of range |
| 4004 | LIQUIDATION_RISK | Position near liquidation |
| 4007 | DUPLICATE_ORDER | Duplicate clientOrderId detected |
| 4008 | INVALID_POSITION_SIDE | Invalid side+posSide combination |
| 4009 | ACTION_CONFLICT | action conflicts with native params |

## Security

- API keys stored in environment variables only (never in config files)
- Withdrawal and transfer permissions must NOT be granted to the API key
- IP allowlist recommended
- Built-in rate limiting (token bucket algorithm)
- Demo/simulation mode supported (`x-simulated-trading: 1`)

## Changelog

### v1.0.0 (2026-04-10)
- Initial release: OKX spot + futures trading (MVP-α)
- 9 MCP tools: spot/futures/account modules
- Action semantics: open_long/open_short/close_long/close_short
- Idempotency check via clientOrderId (crypto.randomUUID)
- Risk controls: margin monitoring, position limits
- Futures error codes: 4001-4009
- Verified on OKX demo trading environment (acctLv=2, long_short_mode)

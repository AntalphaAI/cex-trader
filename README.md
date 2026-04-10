# cex-trader

> v1.0.0 · Unified CEX Trading Capability Layer for AI Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/AntalphaAI/cex-trader)

⚠️ **Risk Warning**: Futures/perpetual contract trading involves high leverage and significant
risk of loss. Only use funds you can afford to lose entirely.

---

## Overview

`cex-trader` is a unified CEX trading MCP (Model Context Protocol) server that enables
AI agents to trade on centralized exchanges through a consistent, exchange-agnostic interface.

- **One configuration** — supports OKX (MVP-α), Binance (MVP-β, planned)
- **Unified interface** — AI agents don't need to handle exchange-specific differences
- **Safety first** — built-in rate limiting, idempotency checks, margin monitoring
- **Action semantics** — simplified `open_long/open_short/close_long/close_short` for AI agents

---

## Supported Exchanges

| Exchange | Spot | Futures | Status |
|----------|------|---------|--------|
| OKX | ✅ | ✅ | MVP-α (production ready) |
| Binance | 🔜 | 🔜 | MVP-β (planned) |

---

## MCP Tools (9 total)

### Spot Module

| Tool | Description |
|------|-------------|
| `cex-spot-place-order` | Place spot market or limit order |
| `cex-spot-cancel-order` | Cancel an existing spot order |
| `cex-account-get-balance` | Query account balance for all assets |

### Futures Module

| Tool | Description |
|------|-------------|
| `cex-futures-place-order` | Place futures order with action semantics or native params |
| `cex-futures-cancel-order` | Cancel an existing futures order |
| `cex-futures-get-positions` | Query all open positions |
| `cex-futures-set-leverage` | Set leverage (1–20x, isolated or cross margin) |
| `cex-futures-close-position` | Close position (auto-detects margin mode from current position) |
| `cex-account-get-info` | Get account configuration and summary |

---

## Quick Start

### 1. Set up credentials

```bash
export CEX_OKX_API_KEY="your-api-key"
export CEX_OKX_API_SECRET="your-secret-key"
export CEX_OKX_PASSPHRASE="your-passphrase"
```

> ⚠️ Never grant withdrawal or transfer permissions to the API key.

### 2. Configure risk parameters

```toml
# ~/.trader/config.toml
[general]
default_exchange = "okx"
log_level = "info"

[profiles.ai-trading.futures]
max_leverage = 10           # max allowed leverage
max_position_usd = 5000     # max position size in USD
daily_limit_usd = 10000     # daily trading limit
margin_warning_ratio = 1.05 # margin ratio warning threshold
margin_danger_ratio = 1.02  # margin ratio danger threshold
```

### 3. Use via MCP

```python
# Spot: place a limit buy
mcp.call("cex-spot-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT",
    "side": "buy",
    "ordType": "limit",
    "sz": "0.001",
    "px": "50000"
})

# Futures: open long (action semantics — recommended for AI agents)
mcp.call("cex-futures-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT-SWAP",
    "action": "open_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})

# Futures: close long
mcp.call("cex-futures-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT-SWAP",
    "action": "close_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})
```

---

## Action Semantics

The `action` parameter simplifies futures order direction for AI agents:

| action | side | posSide | meaning |
|--------|------|---------|---------|
| `open_long` | buy | long | Open a long position |
| `open_short` | sell | short | Open a short position |
| `close_long` | sell | long | Close a long position |
| `close_short` | buy | short | Close a short position |

**Conflict detection**: If both `action` and native `side+posSide` are provided:
- Semantically consistent → `action` takes priority, native params used as-is
- Semantically conflicting → returns `ACTION_CONFLICT (4009)` error

---

## Error Codes

| Code | Name | Category | Description |
|------|------|----------|-------------|
| 1001 | NETWORK_ERROR | General | Network error |
| 1002 | RATE_LIMIT_EXCEEDED | General | Rate limit hit |
| 1003 | TIMEOUT | General | Request timed out |
| 2001 | INSUFFICIENT_BALANCE | Account | Not enough balance |
| 2002 | INVALID_API_KEY | Account | Authentication failed |
| 2003 | PERMISSION_DENIED | Account | Missing permission |
| 3001 | INVALID_PRICE | Spot | Price out of range |
| 3002 | INVALID_SIZE | Spot | Size invalid |
| 3003 | ORDER_NOT_FOUND | Spot | Order not found |
| 3004 | ORDER_REJECTED | Spot | Order rejected by exchange |
| 4001 | INSUFFICIENT_MARGIN | Futures | Not enough margin |
| 4002 | POSITION_NOT_FOUND | Futures | Position does not exist |
| 4003 | INVALID_LEVERAGE | Futures | Leverage out of allowed range |
| 4004 | LIQUIDATION_RISK | Futures | Near liquidation price |
| 4005 | MARGIN_RATIO_WARNING | Futures | Margin ratio below warning threshold |
| 4006 | POSITION_LIMIT_EXCEEDED | Futures | Position size exceeds limit |
| 4007 | DUPLICATE_ORDER | Futures | Duplicate clientOrderId |
| 4008 | INVALID_POSITION_SIDE | Futures | Invalid side+posSide combination |
| 4009 | ACTION_CONFLICT | Futures | action conflicts with native params |
| 5001 | PRECISION_ERROR | Precision | Size/price precision error |

---

## Security

- ✅ API credentials stored in environment variables only
- ✅ Withdrawal and transfer permissions **must NOT** be granted
- ✅ IP allowlist recommended
- ✅ Built-in token bucket rate limiting
- ✅ Demo/simulation mode (`x-simulated-trading: 1`)
- ✅ Idempotency via `clientOrderId` (crypto.randomUUID, prevents duplicate orders)
- ✅ Audit logging to `~/.trader/audit.log`

---

## Architecture

```
cex-trader/
├── core/           # Abstract interfaces, types, errors, rate limiter, retry
├── exchanges/
│   ├── okx/        # OKX adapter (market, spot, futures, account)
│   └── binance/    # Binance adapter (MVP-β)
├── mcp/            # MCP server entry point and tool definitions
├── security/       # Keychain, audit log, anomaly detection
├── risk/           # Margin monitor, liquidation alert, position limits
└── skills/         # Skill definition markdown files
```

---

## OKX Account Requirements

For futures trading on OKX, the account must be in:
- **Account mode**: Single-currency margin or Multi-currency margin (`acctLv >= 2`)
- **Position mode**: Long/short mode (`posMode = long_short_mode`)

Simple account mode (`acctLv=1`) does NOT support perpetual futures.

---

## Changelog

### v1.0.0 (2026-04-10)
- Initial release: OKX spot + futures trading (MVP-α)
- 9 MCP tools across spot/futures/account modules
- Action semantics: `open_long`, `open_short`, `close_long`, `close_short`
- Idempotency check via `clientOrderId` using `crypto.randomUUID()`
- Risk controls: margin ratio monitoring (configurable thresholds), position limits
- Unified error code system (1001–5001)
- Verified on OKX demo trading environment (`acctLv=2`, `long_short_mode`)
- `closePosition` dynamically fetches `mgnMode` from current position (no hardcoding)

---

## License

MIT © Antalpha AI

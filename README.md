[🇺🇸 English](#english) · [🇨🇳 中文](#chinese)

---

<a name="english"></a>

# cex-trader

> v2.0.2 · Unified CEX Trading Capability Layer for AI Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.2-blue.svg)](https://github.com/AntalphaAI/cex-trader)

⚠️ **Risk Warning**: Futures/perpetual contract trading involves high leverage and significant risk of loss. Only use funds you can afford to lose entirely.

---

## Overview

`cex-trader` is a unified CEX trading MCP (Model Context Protocol) server that enables AI agents to trade on centralized exchanges through a consistent, exchange-agnostic interface.

- **One configuration** — supports OKX (MVP-α) and Binance (MVP-β)
- **Unified interface** — AI agents don't need to handle exchange-specific differences
- **Safety first** — built-in rate limiting, idempotency checks, margin monitoring
- **Action semantics** — simplified `open_long / open_short / close_long / close_short` for AI agents
- **Guided setup** — conversational API key onboarding via `cex-setup-*` tools

---

## Supported Exchanges

| Exchange | Spot | Futures | Status |
|----------|------|---------|--------|
| OKX      | ✅   | ✅      | MVP-α (production ready) |
| Binance  | ✅   | ✅      | MVP-β (production ready) |

---

## MCP Tools (12 total)

### Setup Module

| Tool | Description |
|------|-------------|
| `cex-setup-check` | Check if API credentials are configured |
| `cex-setup-save` | Save API credentials for OKX or Binance |
| `cex-setup-verify` | Verify credentials via a test API call |

### Spot Module

| Tool | Description |
|------|-------------|
| `cex-spot-place-order` | Place spot market or limit order |
| `cex-spot-cancel-order` | Cancel an existing spot order |
| `cex-account-get-balance` | Query account balance for all assets |

### Futures Module

| Tool | Description |
|------|-------------|
| `cex-futures-place-order` | Place futures order (action semantics or native params) |
| `cex-futures-cancel-order` | Cancel futures order |
| `cex-futures-get-positions` | Query open positions |
| `cex-futures-set-leverage` | Set leverage (1-20x) |
| `cex-futures-close-position` | Close position (auto-detects margin mode) |
| `cex-account-get-info` | Get account config and summary |

---

## Quick Start

### Step 1 — Configure API Credentials

```python
# Check if already set up
mcp.call("cex-setup-check", {})

# Save OKX credentials (requires API Key + Secret + Passphrase)
mcp.call("cex-setup-save", {
    "exchange": "okx",
    "apiKey": "your-api-key",
    "secretKey": "your-secret-key",
    "passphrase": "your-passphrase"
})

# Save Binance credentials (requires API Key + Secret only)
mcp.call("cex-setup-save", {
    "exchange": "binance",
    "apiKey": "your-api-key",
    "secretKey": "your-secret-key"
})

# Verify credentials
mcp.call("cex-setup-verify", {"exchange": "binance"})
```

### Spot Trading

```python
# Binance — Limit buy
result = mcp.call("cex-spot-place-order", {
    "exchange": "binance",
    "instId": "BTC-USDT",
    "side": "buy",
    "ordType": "limit",
    "sz": "0.001",
    "px": "50000"
})

# OKX — Market sell
result = mcp.call("cex-spot-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT",
    "side": "sell",
    "ordType": "market",
    "sz": "0.001"
})
```

### Futures Trading — Action Semantics (Recommended for AI Agents)

```python
# Open long position — 10x leverage, isolated margin
result = mcp.call("cex-futures-place-order", {
    "exchange": "binance",
    "instId": "BTC-USDT-SWAP",
    "action": "open_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})

# Close long position
result = mcp.call("cex-futures-place-order", {
    "exchange": "binance",
    "instId": "BTC-USDT-SWAP",
    "action": "close_long",
    "ordType": "market",
    "sz": "1"
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

---

## Action Semantics

| Action | side | posSide | Description |
|--------|------|---------|-------------|
| `open_long` | buy | long | Open long position |
| `open_short` | sell | short | Open short position |
| `close_long` | sell | long | Close long position |
| `close_short` | buy | short | Close short position |

If both `action` and native `side+posSide` are provided:
- Semantically consistent → `action` takes priority
- Conflicting → returns `ACTION_CONFLICT (4009)` error

---

## Configuration

```bash
# OKX
export CEX_OKX_API_KEY="your-api-key"
export CEX_OKX_API_SECRET="your-secret"
export CEX_OKX_PASSPHRASE="your-passphrase"

# Binance
export CEX_BINANCE_API_KEY="your-api-key"
export CEX_BINANCE_API_SECRET="your-secret"
```

Risk parameters (`~/.trader/config.toml`):

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

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1001 | NETWORK_ERROR | Network connectivity issue |
| 1002 | RATE_LIMIT_EXCEEDED | Too many requests |
| 2001 | INSUFFICIENT_BALANCE | Not enough balance |
| 2002 | INVALID_API_KEY | API key authentication failed |
| 2003 | PERMISSION_DENIED | API key lacks required permissions |
| 3001 | INVALID_PRICE | Order price out of range |
| 4001 | INSUFFICIENT_MARGIN | Not enough margin for position |
| 4002 | POSITION_NOT_FOUND | Position does not exist |
| 4003 | INVALID_LEVERAGE | Leverage value out of range |
| 4004 | LIQUIDATION_RISK | Position near liquidation |
| 4005 | ORDER_REJECTED | Order rejected by exchange |
| 4007 | DUPLICATE_ORDER | Duplicate clientOrderId detected |
| 4008 | INVALID_POSITION_SIDE | Invalid side+posSide combination |
| 4009 | ACTION_CONFLICT | action conflicts with native params |

---

## Security

- API keys are stored in environment variables (`CEX_OKX_*` / `CEX_BINANCE_*`) and transmitted to the MCP server when `cex-setup-save` is called
- The MCP server URL is `https://mcp-skills.ai.antalpha.com/mcp` (hosted) or override via `MCP_SERVER_URL=http://localhost:3000` for self-hosted
- `~/.trader/config.toml` (written by `install.sh`) stores **risk parameters only** — never API keys
- Withdrawal and transfer permissions **must NOT** be granted to the API key
- IP allowlist recommended
- Built-in rate limiting (token bucket algorithm)
- Demo/simulation mode supported (`x-simulated-trading: 1` for OKX)

---

## Changelog

### v2.0.2 (2026-04-14)
- **Fix**: Corrected MCP server URL to `https://mcp-skills.ai.antalpha.com/mcp` (was `mcp.antalpha.com/cex-trader`)

### v2.0.1 (2026-04-14)
- **Docs**: Declared required env vars (`CEX_OKX_*`, `CEX_BINANCE_*`, `MCP_SERVER_URL`) in SKILL.md metadata
- **Docs**: Clarified credential transmission path — env vars → MCP server; `~/.trader/config.toml` stores risk params only
- **Docs**: Aligned `MCP_SERVER_URL` default (`localhost:3000`) with hosted MCP URL in SKILL.md

### v2.0.0 (2026-04-13)
- **Added**: Full Binance exchange support — Spot + Futures (MVP-β, production ready)
- **Added**: ExchangeRouter for unified OKX/Binance dispatch
- **Added**: BinanceClientService with HMAC-SHA256 signing
- **Added**: BinanceSpotService, BinanceFuturesService, BinanceAccountService, BinanceMarketService
- **Added**: `cex-setup-check` / `cex-setup-save` / `cex-setup-verify` — guided API key onboarding (OKX + Binance)
- **Fixed**: BINANCE_ERROR_MAP[-2010] → ORDER_REJECTED (was PERMISSION_DENIED)
- **Fixed**: BINANCE_ERROR_MAP[-1021] → NETWORK_ERROR (was ORDER_REJECTED)
- **Fixed**: `closePosition` now iterates all positions (fix for dual-side mode)
- **Fixed**: POST Content-Type set to `application/x-www-form-urlencoded`
- All 9 original MCP tools now accept `exchange` parameter (backward-compatible, defaults to `"okx"`)

### v1.0.0 (2026-04-10)
- Initial release: OKX spot + futures trading (MVP-α)
- 9 MCP tools: spot/futures/account modules
- Action semantics: open_long/open_short/close_long/close_short
- Idempotency check via clientOrderId (crypto.randomUUID)
- Risk controls: margin monitoring, position limits
- Futures error codes: 4001-4009
- Verified on OKX demo trading environment (acctLv=2, long_short_mode)

---

<a name="chinese"></a>

# cex-trader（中文说明）

> v2.0.2 · 面向 AI Agent 的统一 CEX 交易能力层

⚠️ **风险提示**：合约/永续合约交易涉及高杠杆，存在重大亏损风险，请仅使用可以承受全部损失的资金。

---

## 概述

`cex-trader` 是一个统一的 CEX 交易 MCP 服务器，让 AI Agent 通过一致的接口在中心化交易所进行交易。

- **统一接口** — 支持 OKX（MVP-α）和 Binance（MVP-β）
- **安全优先** — 内置限频、幂等校验、保证金监控
- **Action 语义** — 简化合约方向：open_long / open_short / close_long / close_short
- **引导式配置** — 通过 `cex-setup-*` 工具完成 API Key 配置引导

---

## 支持的交易所

| 交易所   | 现货 | 合约 | 状态 |
|----------|------|------|------|
| OKX      | ✅   | ✅   | MVP-α（生产就绪） |
| Binance  | ✅   | ✅   | MVP-β（生产就绪） |

---

## MCP 工具（共 12 个）

### 配置工具

| 工具 | 说明 |
|------|------|
| `cex-setup-check` | 检查 API Key 是否已配置 |
| `cex-setup-save` | 保存 OKX 或 Binance 的 API 凭证 |
| `cex-setup-verify` | 通过测试 API 调用验证凭证有效性 |

### 现货工具

| 工具 | 说明 |
|------|------|
| `cex-spot-place-order` | 下现货市价单或限价单 |
| `cex-spot-cancel-order` | 撤销现货订单 |
| `cex-account-get-balance` | 查询账户余额 |

### 合约工具

| 工具 | 说明 |
|------|------|
| `cex-futures-place-order` | 下合约单（Action 语义或原生参数） |
| `cex-futures-cancel-order` | 撤销合约订单 |
| `cex-futures-get-positions` | 查询持仓 |
| `cex-futures-set-leverage` | 设置杠杆（1-20x） |
| `cex-futures-close-position` | 平仓（自动识别保证金模式） |
| `cex-account-get-info` | 查询账户配置和摘要 |

---

## 快速开始

```python
# 第一步：检查配置
mcp.call("cex-setup-check", {})

# 配置 Binance（只需 API Key + Secret）
mcp.call("cex-setup-save", {
    "exchange": "binance",
    "apiKey": "your-api-key",
    "secretKey": "your-secret-key"
})

# 验证
mcp.call("cex-setup-verify", {"exchange": "binance"})

# 开多（10 倍杠杆，逐仓）
mcp.call("cex-futures-place-order", {
    "exchange": "binance",
    "instId": "BTC-USDT-SWAP",
    "action": "open_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})
```

---

## 更新日志

### v2.0.2 (2026-04-14)
- **修复**：更正 MCP Server 地址为 `https://mcp-skills.ai.antalpha.com/mcp`（原地址 `mcp.antalpha.com/cex-trader` 不可用）

### v2.0.1 (2026-04-14)
- **文档**：在 SKILL.md 元数据中声明所需环境变量（`CEX_OKX_*`、`CEX_BINANCE_*`、`MCP_SERVER_URL`）
- **文档**：明确凭证传输路径 — 环境变量 → MCP 服务器；`~/.trader/config.toml` 仅存风控参数
- **文档**：统一 `MCP_SERVER_URL` 默认值说明（`localhost:3000`）与 SKILL.md 中托管 URL 的关系

### v2.0.0 (2026-04-13)
- **新增**：完整 Binance 交易所支持 — 现货 + 合约（MVP-β，生产就绪）
- **新增**：ExchangeRouter 统一 OKX/Binance 调度
- **新增**：BinanceClientService（HMAC-SHA256 签名）
- **新增**：cex-setup-check / cex-setup-save / cex-setup-verify（引导式 API Key 配置）
- **修复**：BINANCE_ERROR_MAP 多处语义错误
- **修复**：closePosition 双向持仓漏平问题
- 原有 9 个 MCP 工具新增 `exchange` 参数（默认 `"okx"`，向后兼容）

### v1.0.0 (2026-04-10)
- 初始版本：OKX 现货 + 合约交易（MVP-α）
- 9 个 MCP 工具：现货/合约/账户模块
- Action 语义、clientOrderId 幂等校验、风控保证金监控

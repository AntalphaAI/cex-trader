[🇺🇸 English](#english) · [🇨🇳 中文](#chinese)

---

<a name="english"></a>

# cex-trader

> v1.0.0 · Unified CEX Trading Capability Layer for AI Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/AntalphaAI/cex-trader)

⚠️ **Risk Warning**: Futures/perpetual contract trading involves high leverage and significant risk of loss. Only use funds you can afford to lose entirely.

---

## Overview

`cex-trader` is a unified CEX trading MCP (Model Context Protocol) server that enables AI agents to trade on centralized exchanges through a consistent, exchange-agnostic interface.

- **One configuration** — supports OKX (MVP-α), Binance (MVP-β, planned)
- **Unified interface** — AI agents don't need to handle exchange-specific differences
- **Safety first** — built-in rate limiting, idempotency checks, margin monitoring
- **Action semantics** — simplified `open_long / open_short / close_long / close_short` for AI agents

---

## Supported Exchanges

| Exchange | Spot | Futures | Status |
|----------|------|---------|--------|
| OKX      | ✅   | ✅      | MVP-α (production ready) |
| Binance  | 🔜   | 🔜      | MVP-β (planned) |

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
max_leverage = 10            # max allowed leverage
max_position_usd = 5000      # max position size in USD
daily_limit_usd = 10000      # daily trading limit
margin_warning_ratio = 1.05  # margin ratio warning threshold
margin_danger_ratio = 1.02   # margin ratio danger threshold
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
| `open_long`   | buy  | long  | Open a long position  |
| `open_short`  | sell | short | Open a short position |
| `close_long`  | sell | long  | Close a long position |
| `close_short` | buy  | short | Close a short position |

**Conflict detection**: If both `action` and native `side+posSide` are provided:
- Semantically consistent → `action` takes priority
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

## OKX Account Requirements

For futures trading on OKX, the account must be in:
- **Account mode**: Single-currency margin or Multi-currency margin (`acctLv >= 2`)
- **Position mode**: Long/short mode (`posMode = long_short_mode`)

Simple account mode (`acctLv=1`) does NOT support perpetual futures.

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
├── security/       # Audit log, anomaly detection
├── risk/           # Margin monitor, liquidation alert, position limits
└── skills/         # Skill definition markdown files
```

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

---

<a name="chinese"></a>

# cex-trader

> v1.0.0 · AI Agent 统一中心化交易所交易能力层

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/AntalphaAI/cex-trader)

⚠️ **风险提示**：合约/永续合约交易涉及高杠杆，存在重大亏损风险。请仅使用可以承受全部损失的资金。

---

## 项目简介

`cex-trader` 是一个统一的中心化交易所（CEX）交易 MCP（Model Context Protocol）服务器，让 AI Agent 通过一致的、与交易所无关的接口在中心化交易所进行交易。

- **统一配置** — 支持 OKX（MVP-α），Binance（MVP-β，规划中）
- **统一接口** — AI Agent 无需处理各交易所的差异
- **安全优先** — 内置限速、幂等性检查、保证金监控
- **语义化操作** — 为 AI Agent 简化的 `open_long / open_short / close_long / close_short`

---

## 支持的交易所

| 交易所 | 现货 | 合约 | 状态 |
|--------|------|------|------|
| OKX    | ✅   | ✅   | MVP-α（生产就绪） |
| Binance | 🔜  | 🔜  | MVP-β（规划中） |

---

## MCP 工具（共 9 个）

### 现货模块

| 工具 | 说明 |
|------|------|
| `cex-spot-place-order` | 下现货市价单或限价单 |
| `cex-spot-cancel-order` | 撤销现货订单 |
| `cex-account-get-balance` | 查询账户所有资产余额 |

### 合约模块

| 工具 | 说明 |
|------|------|
| `cex-futures-place-order` | 下合约单（语义化操作或原生参数） |
| `cex-futures-cancel-order` | 撤销合约订单 |
| `cex-futures-get-positions` | 查询所有持仓 |
| `cex-futures-set-leverage` | 设置杠杆倍数（1–20x，逐仓或全仓） |
| `cex-futures-close-position` | 平仓（自动从当前持仓获取保证金模式） |
| `cex-account-get-info` | 获取账户配置和摘要信息 |

---

## 快速开始

### 1. 配置 API 凭证

```bash
export CEX_OKX_API_KEY="your-api-key"
export CEX_OKX_API_SECRET="your-secret-key"
export CEX_OKX_PASSPHRASE="your-passphrase"
```

> ⚠️ 切勿给 API Key 授予提现或转账权限。

### 2. 配置风控参数

```toml
# ~/.trader/config.toml
[general]
default_exchange = "okx"
log_level = "info"

[profiles.ai-trading.futures]
max_leverage = 10            # 最大允许杠杆
max_position_usd = 5000      # 最大持仓规模（USD）
daily_limit_usd = 10000      # 日交易限额（USD）
margin_warning_ratio = 1.05  # 保证金率预警阈值
margin_danger_ratio = 1.02   # 保证金率危险阈值
```

### 3. 通过 MCP 使用

```python
# 现货：下限价买单
mcp.call("cex-spot-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT",
    "side": "buy",
    "ordType": "limit",
    "sz": "0.001",
    "px": "50000"
})

# 合约：开多（语义化操作 — 推荐 AI Agent 使用）
mcp.call("cex-futures-place-order", {
    "exchange": "okx",
    "instId": "BTC-USDT-SWAP",
    "action": "open_long",
    "ordType": "market",
    "sz": "1",
    "leverage": 10,
    "mgnMode": "isolated"
})

# 合约：平多
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

## 语义化操作说明

`action` 参数为 AI Agent 简化了合约方向的表达：

| action | side | posSide | 含义 |
|--------|------|---------|------|
| `open_long`   | buy  | long  | 开多 |
| `open_short`  | sell | short | 开空 |
| `close_long`  | sell | long  | 平多 |
| `close_short` | buy  | short | 平空 |

**冲突检测**：同时提供 `action` 和原生 `side+posSide` 时：
- 语义一致 → `action` 优先，原生参数作为参考
- 语义冲突 → 返回 `ACTION_CONFLICT (4009)` 错误

---

## 错误码

| 错误码 | 名称 | 分类 | 说明 |
|--------|------|------|------|
| 1001 | NETWORK_ERROR | 通用 | 网络错误 |
| 1002 | RATE_LIMIT_EXCEEDED | 通用 | 触发限速 |
| 1003 | TIMEOUT | 通用 | 请求超时 |
| 2001 | INSUFFICIENT_BALANCE | 账户 | 余额不足 |
| 2002 | INVALID_API_KEY | 账户 | 认证失败 |
| 2003 | PERMISSION_DENIED | 账户 | 权限不足 |
| 3001 | INVALID_PRICE | 现货 | 价格超出范围 |
| 3002 | INVALID_SIZE | 现货 | 数量无效 |
| 3003 | ORDER_NOT_FOUND | 现货 | 订单不存在 |
| 3004 | ORDER_REJECTED | 现货 | 交易所拒绝订单 |
| 4001 | INSUFFICIENT_MARGIN | 合约 | 保证金不足 |
| 4002 | POSITION_NOT_FOUND | 合约 | 持仓不存在 |
| 4003 | INVALID_LEVERAGE | 合约 | 杠杆倍数超出范围 |
| 4004 | LIQUIDATION_RISK | 合约 | 接近强平价格 |
| 4005 | MARGIN_RATIO_WARNING | 合约 | 保证金率低于预警阈值 |
| 4006 | POSITION_LIMIT_EXCEEDED | 合约 | 持仓规模超出限制 |
| 4007 | DUPLICATE_ORDER | 合约 | clientOrderId 重复 |
| 4008 | INVALID_POSITION_SIDE | 合约 | side+posSide 组合无效 |
| 4009 | ACTION_CONFLICT | 合约 | action 与原生参数冲突 |
| 5001 | PRECISION_ERROR | 精度 | 数量/价格精度错误 |

---

## OKX 账户要求

在 OKX 上进行合约交易，账户必须满足：
- **账户模式**：单币种保证金或多币种保证金（`acctLv >= 2`）
- **持仓模式**：双向持仓模式（`posMode = long_short_mode`）

简单交易模式（`acctLv=1`）**不支持**永续合约。

---

## 安全说明

- ✅ API 凭证仅存储在环境变量中
- ✅ API Key **不得**授予提现和转账权限
- ✅ 建议配置 IP 白名单
- ✅ 内置令牌桶限速算法
- ✅ 支持模拟交易模式（`x-simulated-trading: 1`）
- ✅ 通过 `clientOrderId`（crypto.randomUUID）实现幂等性，防止重复下单
- ✅ 审计日志记录至 `~/.trader/audit.log`

---

## 项目结构

```
cex-trader/
├── core/           # 抽象接口、类型、错误码、限速器、重试
├── exchanges/
│   ├── okx/        # OKX 适配器（行情、现货、合约、账户）
│   └── binance/    # Binance 适配器（MVP-β）
├── mcp/            # MCP 服务入口及工具定义
├── security/       # 审计日志、异常检测
├── risk/           # 保证金监控、强平预警、持仓限制
└── skills/         # Skill 定义文件
```

---

## 更新日志

### v1.0.0 (2026-04-10)
- 首次发布：OKX 现货 + 合约交易（MVP-α）
- 9 个 MCP 工具，覆盖现货/合约/账户模块
- 语义化操作：`open_long`、`open_short`、`close_long`、`close_short`
- 通过 `clientOrderId`（crypto.randomUUID）实现幂等性检查
- 风控：保证金率监控（可配置阈值）、持仓限制
- 统一错误码体系（1001–5001）
- 已在 OKX 模拟交易环境验证（`acctLv=2`，`long_short_mode`）
- `closePosition` 动态从当前持仓获取 `mgnMode`（不再硬编码）

---

## 许可证

MIT © Antalpha AI

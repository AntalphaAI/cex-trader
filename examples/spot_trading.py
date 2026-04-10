"""
Spot trading examples for cex-trader MCP.
These examples show how to call cex-trader MCP tools.
"""

# ── Place a limit buy order ────────────────────────────────────────────────────
spot_limit_buy = {
    "tool": "cex-spot-place-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT",
        "side": "buy",
        "ordType": "limit",
        "sz": "0.001",
        "px": "50000"
    }
}

# ── Place a market sell order ──────────────────────────────────────────────────
spot_market_sell = {
    "tool": "cex-spot-place-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT",
        "side": "sell",
        "ordType": "market",
        "sz": "0.001"
    }
}

# ── Cancel an order ────────────────────────────────────────────────────────────
spot_cancel = {
    "tool": "cex-spot-cancel-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT",
        "orderId": "1234567890"
    }
}

# ── Query balance ──────────────────────────────────────────────────────────────
account_balance = {
    "tool": "cex-account-get-balance",
    "params": {
        "exchange": "okx"
    }
}

"""
Futures/perpetual trading examples for cex-trader MCP.

OKX futures instrument format: BTC-USDT-SWAP, ETH-USDT-SWAP
Account requirements: acctLv >= 2 (single or multi-currency margin)
Position mode: long_short_mode required for two-way positions
"""

# ── Set leverage ───────────────────────────────────────────────────────────────
set_leverage = {
    "tool": "cex-futures-set-leverage",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP",
        "leverage": 10,
        "mgnMode": "isolated"
    }
}

# ── Open long (action semantics — recommended for AI agents) ───────────────────
open_long_action = {
    "tool": "cex-futures-place-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP",
        "action": "open_long",        # simplified semantics
        "ordType": "market",
        "sz": "1",                    # 1 contract
        "leverage": 10,
        "mgnMode": "isolated"
    }
}

# ── Open short (action semantics) ─────────────────────────────────────────────
open_short_action = {
    "tool": "cex-futures-place-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP",
        "action": "open_short",
        "ordType": "limit",
        "sz": "1",
        "px": "100000",               # limit price
        "leverage": 5,
        "mgnMode": "isolated"
    }
}

# ── Close long (action semantics) ─────────────────────────────────────────────
close_long_action = {
    "tool": "cex-futures-place-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP",
        "action": "close_long",
        "ordType": "market",
        "sz": "1",
        "leverage": 10,
        "mgnMode": "isolated"
    }
}

# ── Open long (native params — advanced users) ─────────────────────────────────
open_long_native = {
    "tool": "cex-futures-place-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP",
        "side": "buy",                # native OKX param
        "posSide": "long",            # native OKX param
        "ordType": "limit",
        "sz": "1",
        "px": "50000",
        "leverage": 10,
        "mgnMode": "isolated",
        "clientOrderId": "my-order-001"  # for idempotency
    }
}

# ── Query positions ────────────────────────────────────────────────────────────
get_positions = {
    "tool": "cex-futures-get-positions",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP"    # optional, omit for all positions
    }
}

# ── Close entire position (uses market order, auto-detects margin mode) ────────
close_position = {
    "tool": "cex-futures-close-position",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP"
    }
}

# ── Cancel futures order ───────────────────────────────────────────────────────
cancel_futures_order = {
    "tool": "cex-futures-cancel-order",
    "params": {
        "exchange": "okx",
        "instId": "BTC-USDT-SWAP",
        "orderId": "1234567890"
    }
}

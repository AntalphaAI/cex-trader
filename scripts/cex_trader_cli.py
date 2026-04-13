#!/usr/bin/env python3
"""
cex-trader CLI — Unified CEX Trading Capability Layer
Calls the cex-trader MCP server tools via HTTP.

Usage:
    python cex_trader_cli.py setup check
    python cex_trader_cli.py setup save --exchange binance --apiKey KEY --secretKey SECRET
    python cex_trader_cli.py setup verify --exchange binance
    python cex_trader_cli.py spot place --exchange okx --instId BTC-USDT --side buy --ordType limit --sz 0.001 --px 50000
    python cex_trader_cli.py spot place --exchange binance --instId BTC-USDT --side buy --ordType limit --sz 0.001 --px 50000
    python cex_trader_cli.py futures place --exchange binance --instId BTC-USDT-SWAP --action open_long --ordType market --sz 1 --leverage 10
    python cex_trader_cli.py futures positions --exchange binance
    python cex_trader_cli.py futures leverage --exchange okx --instId BTC-USDT-SWAP --leverage 10 --mgnMode isolated
    python cex_trader_cli.py futures close --exchange okx --instId BTC-USDT-SWAP
    python cex_trader_cli.py account balance --exchange okx

Environment variables:
    MCP_SERVER_URL  — MCP server base URL (default: http://localhost:3000)
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")


def call_tool(tool_name: str, params: dict) -> dict:
    """Call an MCP tool via HTTP POST."""
    url = f"{MCP_SERVER_URL}/tools/{tool_name}"
    data = json.dumps(params).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP Error {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        print(f"Is the MCP server running at {MCP_SERVER_URL}?", file=sys.stderr)
        sys.exit(1)


def print_result(result: dict):
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ── Spot commands ──────────────────────────────────────────────────────────────

def cmd_spot_place(args):
    params = {
        "exchange": args.exchange,
        "instId": args.instId,
        "side": args.side,
        "ordType": args.ordType,
        "sz": args.sz,
    }
    if args.px:
        params["px"] = args.px
    if args.quoteOrderQty:
        params["quoteOrderQty"] = args.quoteOrderQty
    print_result(call_tool("cex-spot-place-order", params))


def cmd_spot_cancel(args):
    params = {
        "exchange": args.exchange,
        "instId": args.instId,
        "orderId": args.orderId,
    }
    print_result(call_tool("cex-spot-cancel-order", params))


# ── Futures commands ───────────────────────────────────────────────────────────

def cmd_futures_place(args):
    params = {
        "exchange": args.exchange,
        "instId": args.instId,
        "ordType": args.ordType,
        "sz": args.sz,
        "leverage": int(args.leverage),
        "mgnMode": args.mgnMode,
    }
    # Action semantics (recommended)
    if args.action:
        params["action"] = args.action
    # Native params (advanced)
    if args.side:
        params["side"] = args.side
    if args.posSide:
        params["posSide"] = args.posSide
    if args.px:
        params["px"] = args.px
    if args.clientOrderId:
        params["clientOrderId"] = args.clientOrderId
    print_result(call_tool("cex-futures-place-order", params))


def cmd_futures_cancel(args):
    params = {
        "exchange": args.exchange,
        "instId": args.instId,
        "orderId": args.orderId,
    }
    print_result(call_tool("cex-futures-cancel-order", params))


def cmd_futures_positions(args):
    params = {"exchange": args.exchange}
    if args.instId:
        params["instId"] = args.instId
    print_result(call_tool("cex-futures-get-positions", params))


def cmd_futures_leverage(args):
    params = {
        "exchange": args.exchange,
        "instId": args.instId,
        "leverage": int(args.leverage),
        "mgnMode": args.mgnMode,
    }
    print_result(call_tool("cex-futures-set-leverage", params))


def cmd_futures_close(args):
    params = {
        "exchange": args.exchange,
        "instId": args.instId,
    }
    print_result(call_tool("cex-futures-close-position", params))


# ── Setup commands ────────────────────────────────────────────────────────────

def cmd_setup_check(args):
    print_result(call_tool("cex-setup-check", {}))


def cmd_setup_save(args):
    params = {
        "exchange": args.exchange,
        "apiKey": args.apiKey,
        "secretKey": args.secretKey,
    }
    if args.passphrase:
        params["passphrase"] = args.passphrase
    print_result(call_tool("cex-setup-save", params))


def cmd_setup_verify(args):
    params = {"exchange": args.exchange}
    print_result(call_tool("cex-setup-verify", params))


# ── Account commands ───────────────────────────────────────────────────────────

def cmd_account_balance(args):
    params = {"exchange": args.exchange}
    print_result(call_tool("cex-account-get-balance", params))


def cmd_account_info(args):
    params = {"exchange": args.exchange}
    print_result(call_tool("cex-account-get-info", params))


# ── Parser ─────────────────────────────────────────────────────────────────────

def build_parser():
    parser = argparse.ArgumentParser(
        description="cex-trader CLI — Unified CEX Trading Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="module", required=True)

    # ── setup ──
    setup = sub.add_parser("setup", help="API credential setup commands")
    setup_sub = setup.add_subparsers(dest="command", required=True)

    s_check = setup_sub.add_parser("check", help="Check if credentials are configured")
    s_check.set_defaults(func=cmd_setup_check)

    s_save = setup_sub.add_parser("save", help="Save API credentials")
    s_save.add_argument("--exchange", required=True, choices=["okx", "binance"])
    s_save.add_argument("--apiKey", required=True, help="API Key")
    s_save.add_argument("--secretKey", required=True, help="API Secret")
    s_save.add_argument("--passphrase", help="Passphrase (required for OKX)")
    s_save.set_defaults(func=cmd_setup_save)

    s_verify = setup_sub.add_parser("verify", help="Verify credentials via test API call")
    s_verify.add_argument("--exchange", required=True, choices=["okx", "binance"])
    s_verify.set_defaults(func=cmd_setup_verify)

    # ── spot ──
    spot = sub.add_parser("spot", help="Spot trading commands")
    spot_sub = spot.add_subparsers(dest="command", required=True)

    sp_place = spot_sub.add_parser("place", help="Place a spot order")
    sp_place.add_argument("--exchange", required=True, choices=["okx", "binance"])
    sp_place.add_argument("--instId", required=True, help="e.g. BTC-USDT")
    sp_place.add_argument("--side", required=True, choices=["buy", "sell"])
    sp_place.add_argument("--ordType", required=True, choices=["market", "limit"])
    sp_place.add_argument("--sz", required=True, help="Order size")
    sp_place.add_argument("--px", help="Price (required for limit orders)")
    sp_place.add_argument("--quoteOrderQty", help="Quote asset quantity for market buy")
    sp_place.set_defaults(func=cmd_spot_place)

    sp_cancel = spot_sub.add_parser("cancel", help="Cancel a spot order")
    sp_cancel.add_argument("--exchange", required=True, choices=["okx", "binance"])
    sp_cancel.add_argument("--instId", required=True)
    sp_cancel.add_argument("--orderId", required=True)
    sp_cancel.set_defaults(func=cmd_spot_cancel)

    # ── futures ──
    futures = sub.add_parser("futures", help="Futures trading commands")
    fut_sub = futures.add_subparsers(dest="command", required=True)

    fp_place = fut_sub.add_parser("place", help="Place a futures order")
    fp_place.add_argument("--exchange", required=True, choices=["okx", "binance"])
    fp_place.add_argument("--instId", required=True, help="e.g. BTC-USDT-SWAP")
    fp_place.add_argument("--action", choices=["open_long", "open_short", "close_long", "close_short"],
                          help="Action semantics (recommended for AI agents)")
    fp_place.add_argument("--side", choices=["buy", "sell"], help="Native param")
    fp_place.add_argument("--posSide", choices=["long", "short"], help="Native param")
    fp_place.add_argument("--ordType", required=True, choices=["market", "limit"])
    fp_place.add_argument("--sz", required=True, help="Size in contracts")
    fp_place.add_argument("--px", help="Price (required for limit orders)")
    fp_place.add_argument("--leverage", required=True, help="Leverage (1-20)")
    fp_place.add_argument("--mgnMode", required=True, choices=["isolated", "cross"])
    fp_place.add_argument("--clientOrderId", help="Client order ID for idempotency")
    fp_place.set_defaults(func=cmd_futures_place)

    fp_cancel = fut_sub.add_parser("cancel", help="Cancel a futures order")
    fp_cancel.add_argument("--exchange", required=True, choices=["okx", "binance"])
    fp_cancel.add_argument("--instId", required=True)
    fp_cancel.add_argument("--orderId", required=True)
    fp_cancel.set_defaults(func=cmd_futures_cancel)

    fp_pos = fut_sub.add_parser("positions", help="Query open positions")
    fp_pos.add_argument("--exchange", required=True, choices=["okx", "binance"])
    fp_pos.add_argument("--instId", help="Filter by instrument (optional)")
    fp_pos.set_defaults(func=cmd_futures_positions)

    fp_lev = fut_sub.add_parser("leverage", help="Set leverage")
    fp_lev.add_argument("--exchange", required=True, choices=["okx", "binance"])
    fp_lev.add_argument("--instId", required=True)
    fp_lev.add_argument("--leverage", required=True, help="1-20")
    fp_lev.add_argument("--mgnMode", required=True, choices=["isolated", "cross"])
    fp_lev.set_defaults(func=cmd_futures_leverage)

    fp_close = fut_sub.add_parser("close", help="Close a position")
    fp_close.add_argument("--exchange", required=True, choices=["okx", "binance"])
    fp_close.add_argument("--instId", required=True)
    fp_close.set_defaults(func=cmd_futures_close)

    # ── account ──
    account = sub.add_parser("account", help="Account commands")
    acc_sub = account.add_subparsers(dest="command", required=True)

    ac_bal = acc_sub.add_parser("balance", help="Query balance")
    ac_bal.add_argument("--exchange", required=True, choices=["okx", "binance"])
    ac_bal.set_defaults(func=cmd_account_balance)

    ac_info = acc_sub.add_parser("info", help="Query account info")
    ac_info.add_argument("--exchange", required=True, choices=["okx", "binance"])
    ac_info.set_defaults(func=cmd_account_info)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/bin/bash
# cex-trader skill installer
# Sets up the cex-trader CLI and configuration

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.trader"

echo "=== cex-trader skill installer ==="
echo ""

# Create config directory
mkdir -p "$CONFIG_DIR"

# Copy default config if not exists
if [ ! -f "$CONFIG_DIR/config.toml" ]; then
    echo "Creating default config at $CONFIG_DIR/config.toml ..."
    cat > "$CONFIG_DIR/config.toml" << 'EOF'
[general]
default_exchange = "okx"
log_level = "info"

[profiles.ai-trading.futures]
max_leverage = 10
max_position_usd = 5000
daily_limit_usd = 10000
margin_warning_ratio = 1.05
margin_danger_ratio = 1.02

[profiles.ai-trading.risk]
max_daily_trades = 50
stop_loss_ratio = 0.05
EOF
    echo "✅ Config created."
else
    echo "ℹ️  Config already exists at $CONFIG_DIR/config.toml, skipping."
fi

# Make CLI executable
chmod +x "$SKILL_DIR/scripts/cex_trader_cli.py"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "1. Set your API credentials as environment variables:"
echo "   export CEX_OKX_API_KEY='your-api-key'"
echo "   export CEX_OKX_API_SECRET='your-secret'"
echo "   export CEX_OKX_PASSPHRASE='your-passphrase'"
echo ""
echo "2. Review and adjust: $CONFIG_DIR/config.toml"
echo ""
echo "3. Start the MCP server (see backend repo: antalpha-com/antalpha-skills)"
echo ""
echo "⚠️  WARNING: Never grant withdrawal or transfer permissions to the API key!"
echo "⚠️  WARNING: Futures trading involves high leverage risk!"

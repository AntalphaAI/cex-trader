/**
 * Position limit checker.
 * Enforces maximum position size and daily trade count limits.
 */

import type { Position, RiskProfile } from "../core/types.js";
import { CexError, CexErrorCode } from "../core/errors.js";
import { isGreaterThan, multiplyDecimal, isLessThan } from "../core/utils.js";

/** Trade record for daily tracking */
interface TradeRecord {
  timestamp: number;
  symbol: string;
  notionalUsd: string;
}

/**
 * Enforces position size and daily trade limits defined in a risk profile.
 */
export class PositionLimitChecker {
  private readonly maxPositionUsd: string;
  private readonly dailyLimitUsd: string;
  private readonly maxLeverage: number;
  private readonly maxDailyTrades: number;
  private readonly stopLossRatio: string;

  /** In-memory daily trade log (reset at midnight UTC) */
  private dailyTrades: TradeRecord[] = [];

  /**
   * Creates a PositionLimitChecker.
   * @param profile - Risk profile with futures and risk limits
   */
  constructor(profile: RiskProfile) {
    if (!profile.futures || !profile.risk) {
      throw new CexError(
        CexErrorCode.INVALID_PARAMS,
        "Risk profile must include both futures and risk configuration"
      );
    }

    this.maxPositionUsd = profile.futures.maxPositionUsd.toString();
    this.dailyLimitUsd = profile.futures.dailyLimitUsd.toString();
    this.maxLeverage = profile.futures.maxLeverage;
    this.maxDailyTrades = profile.risk.maxDailyTrades;
    this.stopLossRatio = profile.risk.stopLossRatio.toString();
  }

  /**
   * Returns the start of the current UTC day in milliseconds.
   */
  private todayStart(): number {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now.getTime();
  }

  /**
   * Filters daily trades to only include records from today (UTC).
   */
  private getTodayTrades(): TradeRecord[] {
    const start = this.todayStart();
    return this.dailyTrades.filter((t) => t.timestamp >= start);
  }

  /**
   * Validates a leverage value against the profile limit.
   * @param leverage - Requested leverage
   * @throws CexError if leverage exceeds limit
   */
  assertLeverageAllowed(leverage: number): void {
    if (leverage > this.maxLeverage) {
      throw new CexError(
        CexErrorCode.LEVERAGE_EXCEEDS_LIMIT,
        `Leverage ${leverage}x exceeds maximum allowed ${this.maxLeverage}x`,
        { context: { requested: leverage, maxAllowed: this.maxLeverage } }
      );
    }
  }

  /**
   * Validates that a new order would not exceed the daily trade limit.
   * @throws CexError with DAILY_TRADE_LIMIT if limit would be exceeded
   */
  assertDailyTradeCountAllowed(): void {
    const todayCount = this.getTodayTrades().length;
    if (todayCount >= this.maxDailyTrades) {
      throw new CexError(
        CexErrorCode.DAILY_TRADE_LIMIT,
        `Daily trade limit reached: ${todayCount}/${this.maxDailyTrades}`,
        { context: { todayCount, maxDailyTrades: this.maxDailyTrades } }
      );
    }
  }

  /**
   * Validates that a new position would not exceed the max position USD limit.
   * @param quantity - Contract quantity (in contracts)
   * @param price - Order price in USD
   * @param positions - Current open positions
   * @throws CexError with POSITION_LIMIT_EXCEEDED if limit would be exceeded
   */
  assertPositionSizeAllowed(
    quantity: string,
    price: string,
    positions: Position[]
  ): void {
    const newNotional = multiplyDecimal(quantity, price);

    // Sum existing open position notional values
    const existingNotional = positions.reduce((sum, pos) => {
      const absAmt = pos.positionAmt.startsWith("-")
        ? pos.positionAmt.slice(1)
        : pos.positionAmt;
      const notional = multiplyDecimal(absAmt, pos.markPrice);
      return (parseFloat(sum) + parseFloat(notional)).toString();
    }, "0");

    const totalNotional = (parseFloat(existingNotional) + parseFloat(newNotional)).toString();

    if (isGreaterThan(totalNotional, this.maxPositionUsd)) {
      throw new CexError(
        CexErrorCode.POSITION_LIMIT_EXCEEDED,
        `Total position notional $${totalNotional} would exceed limit $${this.maxPositionUsd}`,
        {
          context: {
            newNotional,
            existingNotional,
            totalNotional,
            maxPositionUsd: this.maxPositionUsd,
          },
        }
      );
    }
  }

  /**
   * Validates the total daily traded notional volume.
   * @param quantity - Trade quantity
   * @param price - Trade price
   * @throws CexError with RISK_LIMIT_EXCEEDED if daily volume limit exceeded
   */
  assertDailyVolumeAllowed(quantity: string, price: string): void {
    const newNotional = multiplyDecimal(quantity, price);

    const todayVolume = this.getTodayTrades().reduce(
      (sum, t) => sum + parseFloat(t.notionalUsd),
      0
    );

    const totalVolume = (todayVolume + parseFloat(newNotional)).toString();

    if (isGreaterThan(totalVolume, this.dailyLimitUsd)) {
      throw new CexError(
        CexErrorCode.RISK_LIMIT_EXCEEDED,
        `Daily volume $${totalVolume} would exceed daily limit $${this.dailyLimitUsd}`,
        {
          context: {
            todayVolume: todayVolume.toString(),
            newNotional,
            totalVolume,
            dailyLimitUsd: this.dailyLimitUsd,
          },
        }
      );
    }
  }

  /**
   * Records a completed trade for daily tracking.
   * @param symbol - Instrument symbol
   * @param quantity - Trade quantity
   * @param price - Executed price
   */
  recordTrade(symbol: string, quantity: string, price: string): void {
    const notionalUsd = multiplyDecimal(quantity, price);
    this.dailyTrades.push({
      timestamp: Date.now(),
      symbol,
      notionalUsd,
    });

    // Prune records older than 2 days to prevent unbounded growth
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1_000;
    this.dailyTrades = this.dailyTrades.filter((t) => t.timestamp > twoDaysAgo);
  }

  /**
   * Returns the stop loss ratio.
   */
  getStopLossRatio(): string {
    return this.stopLossRatio;
  }

  /**
   * Returns today's trade summary.
   */
  getDailySummary(): {
    tradeCount: number;
    totalVolumeUsd: string;
    remainingTrades: number;
    remainingVolumeUsd: string;
  } {
    const todayTrades = this.getTodayTrades();
    const totalVolume = todayTrades.reduce(
      (sum, t) => sum + parseFloat(t.notionalUsd),
      0
    );
    const remaining = Math.max(0, parseFloat(this.dailyLimitUsd) - totalVolume);

    return {
      tradeCount: todayTrades.length,
      totalVolumeUsd: totalVolume.toFixed(2),
      remainingTrades: Math.max(0, this.maxDailyTrades - todayTrades.length),
      remainingVolumeUsd: remaining.toFixed(2),
    };
  }
}

/**
 * Margin rate monitor for futures positions.
 * Checks positions against warning and danger thresholds.
 */

import type { Position, RiskProfile } from "../core/types.js";
import { CexError, CexErrorCode } from "../core/errors.js";
import { isLessThan } from "../core/utils.js";

/** Margin check result */
export interface MarginCheckResult {
  /** Whether the check passed (no danger) */
  passed: boolean;
  /** Alert level */
  level: "ok" | "warning" | "danger";
  /** Human-readable message */
  message: string;
  /** Positions that triggered alerts */
  alertPositions: MarginAlert[];
}

/** Individual position margin alert */
export interface MarginAlert {
  symbol: string;
  positionSide: string;
  marginRatio: string;
  level: "warning" | "danger";
  message: string;
}

/**
 * Monitors futures position margin ratios against risk thresholds.
 *
 * OKX defines margin ratio as: maintenance margin / margin balance.
 * Lower margin ratio → closer to liquidation.
 *
 * Thresholds (from profile):
 *   marginWarningRatio: alert if marginRatio < warningRatio
 *   marginDangerRatio:  alert if marginRatio < dangerRatio
 */
export class MarginMonitor {
  private readonly warningRatio: string;
  private readonly dangerRatio: string;

  /**
   * Creates a MarginMonitor.
   * @param profile - Risk profile containing margin thresholds
   */
  constructor(profile: RiskProfile) {
    const futures = profile.futures;
    if (!futures) {
      throw new CexError(
        CexErrorCode.INVALID_PARAMS,
        "Risk profile must include futures configuration"
      );
    }

    this.warningRatio = futures.marginWarningRatio.toString();
    this.dangerRatio = futures.marginDangerRatio.toString();
  }

  /**
   * Checks a list of positions against margin thresholds.
   * @param positions - Current open positions
   * @returns MarginCheckResult with alert details
   */
  checkPositions(positions: Position[]): MarginCheckResult {
    const alertPositions: MarginAlert[] = [];

    for (const position of positions) {
      const marginRatio = position.marginRatio;

      if (!marginRatio || marginRatio === "0") {
        continue;
      }

      if (isLessThan(marginRatio, this.dangerRatio)) {
        alertPositions.push({
          symbol: position.symbol,
          positionSide: position.positionSide,
          marginRatio,
          level: "danger",
          message: `DANGER: ${position.symbol} ${position.positionSide} margin ratio ${marginRatio} is below danger threshold ${this.dangerRatio}. Risk of liquidation imminent!`,
        });
      } else if (isLessThan(marginRatio, this.warningRatio)) {
        alertPositions.push({
          symbol: position.symbol,
          positionSide: position.positionSide,
          marginRatio,
          level: "warning",
          message: `WARNING: ${position.symbol} ${position.positionSide} margin ratio ${marginRatio} is below warning threshold ${this.warningRatio}.`,
        });
      }
    }

    const hasDanger = alertPositions.some((a) => a.level === "danger");
    const hasWarning = alertPositions.some((a) => a.level === "warning");

    if (hasDanger) {
      return {
        passed: false,
        level: "danger",
        message: `${alertPositions.filter((a) => a.level === "danger").length} position(s) at danger level margin ratio`,
        alertPositions,
      };
    }

    if (hasWarning) {
      return {
        passed: true,
        level: "warning",
        message: `${alertPositions.filter((a) => a.level === "warning").length} position(s) at warning level margin ratio`,
        alertPositions,
      };
    }

    return {
      passed: true,
      level: "ok",
      message: "All positions have healthy margin ratios",
      alertPositions: [],
    };
  }

  /**
   * Throws a CexError if any position is at danger level.
   * Use before placing new orders to enforce risk limits.
   *
   * @param positions - Current open positions
   * @throws CexError with MARGIN_DANGER if any position is in danger
   */
  assertSafe(positions: Position[]): void {
    const result = this.checkPositions(positions);

    if (result.level === "danger") {
      const dangerPos = result.alertPositions
        .filter((a) => a.level === "danger")
        .map((a) => `${a.symbol}(${a.positionSide}):${a.marginRatio}`)
        .join(", ");

      throw new CexError(
        CexErrorCode.MARGIN_DANGER,
        `Margin danger: positions at risk of liquidation: ${dangerPos}`,
        { context: { alertPositions: result.alertPositions } }
      );
    }
  }
}

/**
 * Audit log — writes JSON Lines entries to ~/.trader/audit.log.
 * Every MCP tool invocation and its outcome is recorded here.
 */

import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** Log entry severity */
export type AuditSeverity = "info" | "warn" | "error";

/** Action category */
export type AuditAction =
  | "market.getTicker"
  | "market.getKline"
  | "market.getOrderBook"
  | "spot.placeOrder"
  | "spot.cancelOrder"
  | "spot.getOrder"
  | "spot.getOrders"
  | "account.getBalance"
  | "account.getInfo"
  | "futures.placeOrder"
  | "futures.cancelOrder"
  | "futures.getPositions"
  | "futures.setLeverage"
  | "futures.closePosition"
  | "system.startup"
  | "system.error";

/** A single audit log entry */
export interface AuditEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Severity */
  severity: AuditSeverity;
  /** Action taken */
  action: AuditAction;
  /** Exchange involved */
  exchange?: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Input parameters (sensitive fields masked) */
  params?: Record<string, unknown>;
  /** Result summary (no raw data) */
  result?: Record<string, unknown>;
  /** Error code and message if failed */
  error?: {
    code: string;
    message: string;
  };
  /** Caller session or agent ID */
  sessionId?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

/** Sensitive parameter keys that should be masked in logs */
const SENSITIVE_KEYS = new Set([
  "apiKey",
  "secretKey",
  "passphrase",
  "password",
  "token",
  "secret",
  "key",
  "signature",
]);

/**
 * Masks sensitive fields in a parameter object.
 * @param params - Raw parameters
 * @returns Copy with sensitive values replaced by "***"
 */
function maskSensitive(params: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      masked[k] = "***";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      masked[k] = maskSensitive(v as Record<string, unknown>);
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

/**
 * Persistent JSON Lines audit logger.
 *
 * Thread-safe: writes are serialised through a promise chain.
 */
export class AuditLog {
  private readonly logPath: string;
  private writeChain: Promise<void> = Promise.resolve();
  private initialized = false;

  constructor() {
    const traderDir = join(homedir(), ".trader");
    this.logPath = join(traderDir, "audit.log");
  }

  /**
   * Ensures the log directory and file exist.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const dir = join(homedir(), ".trader");
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    this.initialized = true;
  }

  /**
   * Writes an audit entry to the log file.
   * Errors during writing are silently suppressed to avoid crashing the server.
   *
   * @param entry - Audit entry to record
   */
  async log(entry: AuditEntry): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      try {
        await this.ensureInitialized();

        const safeEntry: AuditEntry = {
          ...entry,
          params: entry.params ? maskSensitive(entry.params) : undefined,
        };

        const line = JSON.stringify(safeEntry) + "\n";
        await appendFile(this.logPath, line, "utf8");
      } catch {
        // Never throw from audit log — it's a best-effort side channel
      }
    });

    return this.writeChain;
  }

  /**
   * Convenience method: logs a successful operation.
   *
   * @param action - Action name
   * @param options - Optional details
   */
  async logSuccess(
    action: AuditAction,
    options: {
      exchange?: string;
      params?: Record<string, unknown>;
      result?: Record<string, unknown>;
      sessionId?: string;
      durationMs?: number;
    } = {}
  ): Promise<void> {
    return this.log({
      timestamp: new Date().toISOString(),
      severity: "info",
      action,
      exchange: options.exchange,
      success: true,
      params: options.params,
      result: options.result,
      sessionId: options.sessionId,
      durationMs: options.durationMs,
    });
  }

  /**
   * Convenience method: logs a failed operation.
   *
   * @param action - Action name
   * @param error - The error that occurred
   * @param options - Optional details
   */
  async logError(
    action: AuditAction,
    error: { code?: string; message: string },
    options: {
      exchange?: string;
      params?: Record<string, unknown>;
      sessionId?: string;
      durationMs?: number;
    } = {}
  ): Promise<void> {
    return this.log({
      timestamp: new Date().toISOString(),
      severity: "error",
      action,
      exchange: options.exchange,
      success: false,
      params: options.params,
      error: {
        code: error.code ?? "UNKNOWN",
        message: error.message,
      },
      sessionId: options.sessionId,
      durationMs: options.durationMs,
    });
  }
}

/** Singleton audit log instance */
export const auditLog = new AuditLog();

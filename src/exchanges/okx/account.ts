/**
 * OKX account service.
 * Handles balance queries and account information.
 */

import { OkxClient, okxPath } from "./client.js";
import type { Balance, AccountInfo } from "../../core/types.js";
import { CexError, CexErrorCode } from "../../core/errors.js";

/** OKX raw balance detail per currency */
interface OkxBalanceDetail {
  ccy: string;
  bal: string;
  availBal: string;
  frozenBal: string;
}

/** OKX raw account balance */
interface OkxAccountBalance {
  totalEq: string;
  details: OkxBalanceDetail[];
}

/** OKX raw account config */
interface OkxAccountConfig {
  uid: string;
  acctLv: string;
  posMode: string;
  autoLoan: string;
  greeksType: string;
  level: string;
  levelTmp: string;
}

/**
 * OKX account service.
 */
export class OkxAccountService {
  constructor(private readonly client: OkxClient) {}

  /**
   * Fetches asset balances.
   * @param currencies - Optional currency filter list
   */
  async getBalance(currencies?: string[]): Promise<Balance[]> {
    try {
      const query: Record<string, unknown> = {};

      if (currencies && currencies.length > 0) {
        query["ccy"] = currencies.join(",");
      }

      const data = await this.client.get<OkxAccountBalance[]>(
        okxPath("/account/balance"),
        query
      );

      if (!data || data.length === 0) {
        return [];
      }

      const accountBalance = data[0];
      const details = accountBalance.details ?? [];

      return details.map((detail) => ({
        currency: detail.ccy,
        total: detail.bal,
        available: detail.availBal,
        frozen: detail.frozenBal,
      }));
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }

  /**
   * Fetches account configuration / info.
   */
  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const data = await this.client.get<OkxAccountConfig[]>(
        okxPath("/account/config")
      );

      if (!data || data.length === 0) {
        throw new CexError(
          CexErrorCode.EXCHANGE_ERROR,
          "Empty response from account config"
        );
      }

      const raw = data[0];

      return {
        userId: raw.uid,
        accountType: "unified",
        accountLevel: raw.acctLv,
        feeTier: raw.level,
        isUnified: raw.acctLv === "2" || raw.acctLv === "3" || raw.acctLv === "4",
      };
    } catch (err) {
      if (err instanceof CexError) throw err;
      throw CexError.from(err, CexErrorCode.EXCHANGE_ERROR);
    }
  }
}

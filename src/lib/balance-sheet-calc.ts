/**
 * Canonical balance sheet calculation — single source of truth used across
 * BalanceSheetStep, DirectorsApprovalStep, and ReviewAndOutputsStep.
 *
 * Accounting identity:
 *   Net Assets = Total Assets − Total Liabilities
 *   Capital & Reserves = share capital + share premium + revaluation reserve
 *                        + retained earnings + other reserves
 *   Balanced when: Net Assets = Capital & Reserves  (i.e. difference < £1)
 */

import type { BalanceSheetSection } from '@/types/accounts-production';

export interface BSCalcResult {
  totalFixedAssets: number;
  totalCurrentAssets: number;
  totalAssets: number;
  totalCurrentLiabilities: number;
  totalLongTermLiabilities: number;
  provisions: number;
  totalLiabilities: number;
  netAssets: number;
  capitalAndReserves: number;
  difference: number;   // netAssets − capitalAndReserves; 0 = balanced
  isBalanced: boolean;
}

export function calcBS(bs: BalanceSheetSection | undefined): BSCalcResult {
  if (!bs) {
    return {
      totalFixedAssets: 0, totalCurrentAssets: 0, totalAssets: 0,
      totalCurrentLiabilities: 0, totalLongTermLiabilities: 0, provisions: 0,
      totalLiabilities: 0, netAssets: 0, capitalAndReserves: 0,
      difference: 0, isBalanced: false,
    };
  }

  const fa = bs.assets?.fixedAssets ?? {};
  const ca = bs.assets?.currentAssets ?? {};
  const cw = (bs.liabilities?.creditorsWithinOneYear ?? {}) as Record<string, number>;
  const ca2 = bs.liabilities?.creditorsAfterOneYear ?? { loans: 0, other: 0 };
  const eq = (bs.equity ?? {}) as Record<string, number>;

  const totalFixedAssets =
    (Number(fa.tangibleFixedAssets) || 0) +
    (Number(fa.intangibleAssets) || 0) +
    (Number(fa.investments) || 0);

  const totalCurrentAssets =
    (Number(ca.stock) || 0) +
    (Number(ca.debtors) || 0) +
    (Number(ca.cash) || 0) +
    (Number(ca.prepayments) || 0);

  const totalAssets = totalFixedAssets + totalCurrentAssets;

  const totalCurrentLiabilities =
    (Number(cw.bankLoans) || 0) +
    (Number(cw.tradeCreditors) || 0) +
    (Number(cw.groupUndertakings) || 0) +
    (Number(cw.taxes) || 0) +
    (Number(cw.accrualsDeferredIncome) || 0) +
    (Number(cw.directorsLoan) || 0) +
    (Number(cw.otherCreditors) || 0);

  const totalLongTermLiabilities =
    (Number(ca2.loans) || 0) +
    (Number(ca2.other) || 0);

  const provisions = Number(bs.provisions) || 0;

  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities + provisions;

  const netAssets = totalAssets - totalLiabilities;

  const capitalAndReserves =
    (Number(eq.shareCapital) || 0) +
    (Number(eq.sharePremium) || 0) +
    (Number(eq.revaluationReserve) || 0) +
    (Number(eq.retainedEarnings) || 0) +
    (Number(eq.otherReserves) || 0);

  const difference = netAssets - capitalAndReserves;
  const isBalanced = Math.abs(difference) < 1;

  return {
    totalFixedAssets,
    totalCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalLongTermLiabilities,
    provisions,
    totalLiabilities,
    netAssets,
    capitalAndReserves,
    difference,
    isBalanced,
  };
}

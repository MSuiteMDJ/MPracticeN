import { useEffect, useMemo, useState } from 'react';
import type { AccountsSet, BalanceSheetSection, BalanceSheetData } from '@/types/accounts-production';
import { calcBS } from '@/lib/balance-sheet-calc';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: BalanceSheetSection) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none text-right';
const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const h3Cls = 'mb-4 text-base font-bold text-slate-900';

// ── Module-level components (stable references — no focus loss on re-render) ──

interface BSNumRowProps {
  label: string;
  path: string;
  val: number;
  compVal?: number;
  compPath?: string;
  allowNeg?: boolean;
  isFirstYear: boolean;
  onSet: (path: string, raw: string, nonNeg?: boolean) => void;
  onSetComp: (path: string, raw: string, nonNeg?: boolean) => void;
}

function BSNumRow({ label, path, val, compVal, compPath, allowNeg = false, isFirstYear, onSet, onSetComp }: BSNumRowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem', alignItems: 'center' }}>
      <label className="text-sm text-slate-700">{label}</label>
      <input type="number" className={inputCls} step="1" value={val} onChange={e => onSet(path, e.target.value, !allowNeg)} />
      {!isFirstYear && (
        <input type="number" className={inputCls} step="1" value={compVal ?? 0} onChange={e => onSetComp(compPath ?? path, e.target.value, !allowNeg)} />
      )}
    </div>
  );
}

interface BSSubtotalProps {
  label: string;
  value: number;
  compValue?: number;
  isFirstYear: boolean;
  highlight?: boolean;
}

function BSSubtotal({ label, value, compValue, isFirstYear, highlight }: BSSubtotalProps) {
  return (
    <div
      className={`rounded-lg p-3 ${highlight ? 'bg-violet-600' : 'bg-slate-50'}`}
      style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem', alignItems: 'center' }}
    >
      <strong className={`text-sm font-semibold ${highlight ? 'text-white' : 'text-slate-900'}`}>{label}</strong>
      <span className={`text-sm font-semibold text-right ${highlight ? 'text-white' : 'text-slate-900'}`}>{fmt(value)}</span>
      {!isFirstYear && <span className={`text-sm font-semibold text-right ${highlight ? 'text-white' : 'text-slate-900'}`}>{fmt(compValue ?? 0)}</span>}
    </div>
  );
}

function BSColHeaders({ isFirstYear }: { isFirstYear: boolean }) {
  if (isFirstYear) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <div /><div className="text-xs font-semibold text-slate-500 text-right">Current Year</div>
      <div className="text-xs font-semibold text-slate-500 text-right">Prior Year</div>
    </div>
  );
}

function makeBlankData(minSC: number): BalanceSheetData {
  return {
    assets: {
      fixedAssets: { tangibleFixedAssets: 0, intangibleAssets: 0, investments: 0 },
      currentAssets: { stock: 0, debtors: 0, cash: 0, prepayments: 0 },
    },
    liabilities: {
      creditorsWithinOneYear: { bankLoans: 0, tradeCreditors: 0, groupUndertakings: 0, taxes: 0, accrualsDeferredIncome: 0, directorsLoan: 0, otherCreditors: 0 },
      creditorsAfterOneYear: { loans: 0, other: 0 },
    },
    provisions: 0,
    equity: { shareCapital: minSC, sharePremium: 0, revaluationReserve: 0, retainedEarnings: 0, otherReserves: 0 },
  };
}

function buildDefault(accountsSet: AccountsSet): BalanceSheetSection {
  const isST = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  const minSC = isST ? 0 : 1;
  const ex = accountsSet.sections.balanceSheet;
  const blank = makeBlankData(minSC);
  const fa = ex?.assets?.fixedAssets;
  const ca = ex?.assets?.currentAssets;
  const cw = ex?.liabilities?.creditorsWithinOneYear as any;
  const ca2 = ex?.liabilities?.creditorsAfterOneYear;
  const eq = ex?.equity as any;

  const data: BalanceSheetSection = {
    assets: {
      fixedAssets: {
        tangibleFixedAssets: Math.max(0, fa?.tangibleFixedAssets ?? 0),
        intangibleAssets: Math.max(0, fa?.intangibleAssets ?? 0),
        investments: Math.max(0, fa?.investments ?? 0),
      },
      currentAssets: {
        stock: Math.max(0, ca?.stock ?? 0),
        debtors: Math.max(0, ca?.debtors ?? 0),
        cash: Math.max(0, ca?.cash ?? 0),
        prepayments: Math.max(0, ca?.prepayments ?? 0),
      },
    },
    liabilities: {
      creditorsWithinOneYear: {
        bankLoans: Math.max(0, cw?.bankLoans ?? 0),
        tradeCreditors: Math.max(0, cw?.tradeCreditors ?? 0),
        groupUndertakings: Math.max(0, cw?.groupUndertakings ?? 0),
        taxes: Math.max(0, cw?.taxes ?? 0),
        accrualsDeferredIncome: Math.max(0, cw?.accrualsDeferredIncome ?? 0),
        directorsLoan: Math.max(0, cw?.directorsLoan ?? 0),
        otherCreditors: Math.max(0, cw?.otherCreditors ?? 0),
      },
      creditorsAfterOneYear: {
        loans: Math.max(0, ca2?.loans ?? 0),
        other: Math.max(0, ca2?.other ?? 0),
      },
    },
    provisions: Math.max(0, ex?.provisions ?? 0),
    equity: {
      shareCapital: Math.max(minSC, eq?.shareCapital ?? minSC),
      sharePremium: Math.max(0, eq?.sharePremium ?? 0),
      revaluationReserve: Math.max(0, eq?.revaluationReserve ?? 0),
      retainedEarnings: eq?.retainedEarnings ?? 0,
      otherReserves: Math.max(0, eq?.otherReserves ?? 0),
    },
  };

  if (!(accountsSet.period?.isFirstYear ?? true)) {
    data.comparatives = ex?.comparatives ?? { prior: blank };
  }
  return data;
}

export function BalanceSheetStep({ accountsSet, onUpdate }: Props) {
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  const isFirstYear = accountsSet.period?.isFirstYear ?? true;
  const minSC = isSoleTrader ? 0 : 1;

  const incomingData = useMemo(() => buildDefault(accountsSet), [accountsSet]);
  const incomingSignature = useMemo(() => JSON.stringify(incomingData), [incomingData]);
  const [formData, setFormData] = useState<BalanceSheetSection>(incomingData);

  useEffect(() => {
    setFormData(current => {
      const sig = JSON.stringify(current);
      return sig === incomingSignature ? current : incomingData;
    });
  }, [incomingData, incomingSignature]);

  const commit = (next: BalanceSheetSection) => { setFormData(next); onUpdate(next); };

  const cloneDeep = (o: any): any =>
    Array.isArray(o) ? o.map(cloneDeep) : (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, cloneDeep(v)])) : o);

  const applyPath = (obj: any, path: string, value: number): any => {
    const keys = path.split('.');
    const next = cloneDeep(obj);
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]]) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return next;
  };

  const parseNum = (raw: string, nonNeg: boolean, path: string) => {
    let n = parseFloat(raw);
    if (isNaN(n)) n = 0;
    if (nonNeg) n = Math.max(0, n);
    if (path.endsWith('.shareCapital')) n = Math.max(minSC, n);
    return n;
  };

  const setField = (path: string, raw: string, nonNeg = true) => {
    commit(applyPath(formData, path, parseNum(raw, nonNeg, path)));
  };

  const setCompField = (path: string, raw: string, nonNeg = true) => {
    const blank = makeBlankData(minSC);
    const prior = applyPath(formData.comparatives?.prior ?? blank, path, parseNum(raw, nonNeg, path));
    commit({ ...formData, comparatives: { prior } });
  };

  const f = formData;
  const p = f.comparatives?.prior;
  const cw = f.liabilities.creditorsWithinOneYear as any;
  const eq = f.equity as any;
  const pcw = p?.liabilities.creditorsWithinOneYear as any;
  const peq = p?.equity as any;
  const pfa = p?.assets.fixedAssets;
  const pca = p?.assets.currentAssets;
  const pca2 = p?.liabilities.creditorsAfterOneYear;

  // Use canonical calculation (same logic as DirectorsApprovalStep and backend)
  const calc = calcBS(f);
  const { totalFixedAssets: totalFA, totalCurrentAssets: totalCA, totalAssets,
    totalCurrentLiabilities: totalCL, totalLongTermLiabilities: totalLTL,
    provisions, totalLiabilities: totalLiab, netAssets, capitalAndReserves: totalEq,
    difference: diff, isBalanced } = calc;

  const pCalc = calcBS(p as BalanceSheetSection | undefined);
  const { totalFixedAssets: pTotalFA, totalCurrentAssets: pTotalCA, totalAssets: pTotalAssets,
    totalCurrentLiabilities: pTotalCL, totalLongTermLiabilities: pTotalLTL,
    totalLiabilities: pTotalLiab, capitalAndReserves: pTotalEq } = pCalc;

  // Derived retained earnings from P&L — available for future use in notes/hints
  const pl = accountsSet.sections.profitAndLoss?.lines;
  const plGross = pl ? pl.turnover - pl.costOfSales : 0;
  const plOpEx = pl ? (pl.adminExpenses + pl.distributionCosts + pl.wages + pl.rent + pl.rates + pl.lightAndHeat + pl.cleaning + pl.serviceCharges + pl.motor + pl.travel + pl.advertising + pl.computerSoftware + pl.subscriptions + pl.insurance + pl.repairsMaintenance + pl.sundryExpenses + pl.supportAdminCosts + pl.donations + pl.hirePlantMachinery + pl.telephoneInternet + pl.printingPostage + pl.professionalFees + pl.accountancyFees + pl.consultancyFees + pl.legalFees + pl.otherExpenses + pl.depreciation + pl.amortisation) : 0;
  const plOpProfit = pl ? plGross + pl.otherOperatingIncome - plOpEx : 0;
  const plPBT = pl ? plOpProfit + pl.interestReceivable - pl.interestPayable - pl.financeCharges - pl.bankCharges : 0;
  const plPAT = pl ? plPBT - pl.taxCharge : 0;
  const retainedBfwd = isFirstYear ? 0 : (p?.equity.retainedEarnings ?? 0);
  void (retainedBfwd + plPAT - (pl?.dividendsDeclared ?? 0));

  // Shared props for module-level row components
  const rowProps = { isFirstYear, onSet: setField, onSetComp: setCompField };
  const subProps = { isFirstYear };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className={cardCls}>
        <h3 className={h3Cls}>Fixed Assets</h3>
        <BSColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <BSNumRow label="Tangible Fixed Assets" path="assets.fixedAssets.tangibleFixedAssets" val={f.assets.fixedAssets.tangibleFixedAssets} compVal={pfa?.tangibleFixedAssets} compPath="assets.fixedAssets.tangibleFixedAssets" {...rowProps} />
          <BSNumRow label="Intangible Assets" path="assets.fixedAssets.intangibleAssets" val={f.assets.fixedAssets.intangibleAssets} compVal={pfa?.intangibleAssets} compPath="assets.fixedAssets.intangibleAssets" {...rowProps} />
          <BSNumRow label="Investments" path="assets.fixedAssets.investments" val={f.assets.fixedAssets.investments} compVal={pfa?.investments} compPath="assets.fixedAssets.investments" {...rowProps} />
          <BSSubtotal label="Total Fixed Assets" value={totalFA} compValue={pTotalFA} {...subProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Current Assets</h3>
        <BSColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <BSNumRow label="Stock" path="assets.currentAssets.stock" val={f.assets.currentAssets.stock} compVal={pca?.stock} compPath="assets.currentAssets.stock" {...rowProps} />
          <BSNumRow label="Debtors" path="assets.currentAssets.debtors" val={f.assets.currentAssets.debtors} compVal={pca?.debtors} compPath="assets.currentAssets.debtors" {...rowProps} />
          <BSNumRow label="Cash at Bank & in Hand" path="assets.currentAssets.cash" val={f.assets.currentAssets.cash} compVal={pca?.cash} compPath="assets.currentAssets.cash" {...rowProps} />
          <BSNumRow label="Prepayments" path="assets.currentAssets.prepayments" val={f.assets.currentAssets.prepayments} compVal={pca?.prepayments} compPath="assets.currentAssets.prepayments" {...rowProps} />
          <BSSubtotal label="Total Current Assets" value={totalCA} compValue={pTotalCA} {...subProps} />
        </div>
        <div className="mt-4 rounded-lg bg-violet-50 p-3" style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem' }}>
          <strong className="text-sm font-semibold text-violet-700">Total Assets</strong>
          <span className="text-sm font-semibold text-violet-700 text-right">{fmt(totalAssets)}</span>
          {!isFirstYear && <span className="text-sm font-semibold text-violet-700 text-right">{fmt(pTotalAssets)}</span>}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Creditors: amounts falling due within one year</h3>
        <BSColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <BSNumRow label="Bank Loans & Overdrafts" path="liabilities.creditorsWithinOneYear.bankLoans" val={cw.bankLoans} compVal={pcw?.bankLoans} compPath="liabilities.creditorsWithinOneYear.bankLoans" {...rowProps} />
          <BSNumRow label="Trade Creditors" path="liabilities.creditorsWithinOneYear.tradeCreditors" val={cw.tradeCreditors} compVal={pcw?.tradeCreditors} compPath="liabilities.creditorsWithinOneYear.tradeCreditors" {...rowProps} />
          <BSNumRow label="Group Undertakings" path="liabilities.creditorsWithinOneYear.groupUndertakings" val={cw.groupUndertakings} compVal={pcw?.groupUndertakings} compPath="liabilities.creditorsWithinOneYear.groupUndertakings" {...rowProps} />
          <BSNumRow label="Taxes & Social Security" path="liabilities.creditorsWithinOneYear.taxes" val={cw.taxes} compVal={pcw?.taxes} compPath="liabilities.creditorsWithinOneYear.taxes" {...rowProps} />
          <BSNumRow label="Accruals & Deferred Income" path="liabilities.creditorsWithinOneYear.accrualsDeferredIncome" val={cw.accrualsDeferredIncome} compVal={pcw?.accrualsDeferredIncome} compPath="liabilities.creditorsWithinOneYear.accrualsDeferredIncome" {...rowProps} />
          <BSNumRow label={isSoleTrader ? "Owner's Loan Account" : "Directors' Loan Account"} path="liabilities.creditorsWithinOneYear.directorsLoan" val={cw.directorsLoan} compVal={pcw?.directorsLoan} compPath="liabilities.creditorsWithinOneYear.directorsLoan" {...rowProps} />
          <BSNumRow label="Other Creditors" path="liabilities.creditorsWithinOneYear.otherCreditors" val={cw.otherCreditors} compVal={pcw?.otherCreditors} compPath="liabilities.creditorsWithinOneYear.otherCreditors" {...rowProps} />
          <BSSubtotal label="Total Current Liabilities" value={totalCL} compValue={pTotalCL} {...subProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Creditors: amounts falling due after more than one year</h3>
        <BSColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <BSNumRow label="Long-term Loans" path="liabilities.creditorsAfterOneYear.loans" val={f.liabilities.creditorsAfterOneYear.loans} compVal={pca2?.loans} compPath="liabilities.creditorsAfterOneYear.loans" {...rowProps} />
          <BSNumRow label="Other Long-term Liabilities" path="liabilities.creditorsAfterOneYear.other" val={f.liabilities.creditorsAfterOneYear.other} compVal={pca2?.other} compPath="liabilities.creditorsAfterOneYear.other" {...rowProps} />
          <BSSubtotal label="Total Long-term Liabilities" value={totalLTL} compValue={pTotalLTL} {...subProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Provisions for Liabilities</h3>
        <BSColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <BSNumRow label="Provisions" path="provisions" val={provisions} compVal={p?.provisions ?? 0} compPath="provisions" {...rowProps} />
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 p-3" style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem' }}>
          <strong className="text-sm font-semibold text-amber-700">Total Liabilities</strong>
          <span className="text-sm font-semibold text-amber-700 text-right">{fmt(totalLiab)}</span>
          {!isFirstYear && <span className="text-sm font-semibold text-amber-700 text-right">{fmt(pTotalLiab)}</span>}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Capital &amp; Reserves</h3>
        <BSColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <BSNumRow label={isSoleTrader ? 'Capital Account' : 'Called up Share Capital'} path="equity.shareCapital" val={eq.shareCapital} compVal={peq?.shareCapital} compPath="equity.shareCapital" {...rowProps} />
          {!isSoleTrader && (
            <BSNumRow label="Share Premium Account" path="equity.sharePremium" val={eq.sharePremium ?? 0} compVal={peq?.sharePremium ?? 0} compPath="equity.sharePremium" {...rowProps} />
          )}
          <BSNumRow label="Revaluation Reserve" path="equity.revaluationReserve" val={eq.revaluationReserve ?? 0} compVal={peq?.revaluationReserve ?? 0} compPath="equity.revaluationReserve" {...rowProps} />
          <BSNumRow label="Retained Earnings" path="equity.retainedEarnings" val={eq.retainedEarnings} compVal={peq?.retainedEarnings} compPath="equity.retainedEarnings" allowNeg {...rowProps} />
          <BSNumRow label="Other Reserves" path="equity.otherReserves" val={eq.otherReserves} compVal={peq?.otherReserves} compPath="equity.otherReserves" {...rowProps} />
          <BSSubtotal label="Total Capital & Reserves" value={totalEq} compValue={pTotalEq} highlight {...subProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Balance Sheet Check</h3>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          {([
            ['Total Assets', totalAssets],
            ['Total Liabilities', totalLiab],
            ['Net Assets', netAssets],
            ['Capital & Reserves', totalEq],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <span className={label === 'Net Assets' || label === 'Capital & Reserves' ? 'font-semibold text-slate-900' : 'text-slate-700'}>{label}</span>
              <span className="font-semibold text-slate-900">{fmt(val)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem' }}>
            <span className="text-slate-700">Difference</span>
            <span className={`font-semibold ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(diff)}</span>
          </div>
        </div>
        <div className={`mt-4 rounded-lg p-4 ${isBalanced ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <strong className={isBalanced ? 'text-emerald-600' : 'text-rose-600'}>
            {isBalanced ? '✅ Balanced — Net Assets = Capital & Reserves' : `❌ Out of Balance — Difference: ${fmt(diff)}`}
          </strong>
          {!isBalanced && (
            <p className="mt-2 text-sm text-slate-500">
              Net Assets ({fmt(netAssets)}) must equal Capital &amp; Reserves ({fmt(totalEq)}).
              Adjust retained earnings or equity figures to balance.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


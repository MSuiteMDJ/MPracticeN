import { useEffect, useMemo, useState } from 'react';
import type { AccountsSet, ProfitAndLossSection, ProfitAndLossLines } from '@/types/accounts-production';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: ProfitAndLossSection) => void;
}

const ZERO_LINES: ProfitAndLossLines = {
  turnover: 0, costOfSales: 0, otherOperatingIncome: 0,
  adminExpenses: 0, distributionCosts: 0,
  wages: 0, rent: 0, rates: 0, lightAndHeat: 0, cleaning: 0,
  serviceCharges: 0, motor: 0, travel: 0, advertising: 0,
  computerSoftware: 0, subscriptions: 0, insurance: 0,
  repairsMaintenance: 0, sundryExpenses: 0, supportAdminCosts: 0,
  donations: 0, hirePlantMachinery: 0, telephoneInternet: 0,
  printingPostage: 0, professionalFees: 0, accountancyFees: 0,
  consultancyFees: 0, legalFees: 0, otherExpenses: 0,
  depreciation: 0, amortisation: 0,
  interestReceivable: 0, interestPayable: 0, financeCharges: 0, bankCharges: 0,
  taxCharge: 0, dividendsDeclared: 0,
};

function mergeLines(base: ProfitAndLossLines, overrides?: Partial<ProfitAndLossLines>): ProfitAndLossLines {
  return { ...base, ...(overrides ?? {}) };
}

function buildDefault(accountsSet: AccountsSet): ProfitAndLossSection {
  const ex = accountsSet.sections.profitAndLoss;
  const isFirstYear = accountsSet.period?.isFirstYear ?? true;
  const lines = mergeLines(ZERO_LINES, ex?.lines);
  const result: ProfitAndLossSection = { lines };
  if (!isFirstYear) {
    result.comparatives = { priorYearLines: mergeLines(ZERO_LINES, ex?.comparatives?.priorYearLines) };
  }
  return result;
}

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none text-right';
const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const h3Cls = 'mb-4 text-base font-bold text-slate-900';

// ── Module-level components (stable references — no focus loss on re-render) ──

interface RowProps {
  label: string;
  field: keyof ProfitAndLossLines;
  currentVal: number;
  priorVal: number;
  isFirstYear: boolean;
  onChange: (field: keyof ProfitAndLossLines, value: string) => void;
  onChangeComp: (field: keyof ProfitAndLossLines, value: string) => void;
}

function PLRow({ label, field, currentVal, priorVal, isFirstYear, onChange, onChangeComp }: RowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem', alignItems: 'center' }}>
      <label className="text-sm text-slate-700">{label}</label>
      <input
        type="number"
        className={inputCls}
        value={currentVal}
        step="1"
        onChange={e => onChange(field, e.target.value)}
      />
      {!isFirstYear && (
        <input
          type="number"
          className={inputCls}
          value={priorVal}
          step="1"
          onChange={e => onChangeComp(field, e.target.value)}
        />
      )}
    </div>
  );
}

interface SubtotalProps {
  label: string;
  value: number;
  compValue?: number;
  isFirstYear: boolean;
  highlight?: boolean;
}

function PLSubtotal({ label, value, compValue, isFirstYear, highlight }: SubtotalProps) {
  return (
    <div
      className={`rounded-lg p-3 ${highlight ? 'bg-violet-600' : 'bg-slate-50'}`}
      style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem', alignItems: 'center' }}
    >
      <strong className={`text-sm font-semibold ${highlight ? 'text-white' : 'text-slate-900'}`}>{label}</strong>
      <span className={`text-sm font-semibold text-right ${highlight ? 'text-white' : value < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(value)}</span>
      {!isFirstYear && (
        <span className={`text-sm font-semibold text-right ${highlight ? 'text-white' : (compValue ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(compValue ?? 0)}</span>
      )}
    </div>
  );
}

function PLColHeaders({ isFirstYear }: { isFirstYear: boolean }) {
  if (isFirstYear) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <div />
      <div className="text-xs font-semibold text-slate-500 text-right">Current Year</div>
      <div className="text-xs font-semibold text-slate-500 text-right">Prior Year</div>
    </div>
  );
}

export function ProfitAndLossStep({ accountsSet, onUpdate }: Props) {
  const isFirstYear = accountsSet.period?.isFirstYear ?? true;

  const incomingData = useMemo(() => buildDefault(accountsSet), [accountsSet]);
  const incomingSignature = useMemo(() => JSON.stringify(incomingData), [incomingData]);

  const [formData, setFormData] = useState<ProfitAndLossSection>(incomingData);

  useEffect(() => {
    setFormData(current => {
      const sig = JSON.stringify(current);
      return sig === incomingSignature ? current : incomingData;
    });
  }, [incomingData, incomingSignature]);

  const commit = (next: ProfitAndLossSection) => {
    setFormData(next);
    onUpdate(next);
  };

  const handleChange = (field: keyof ProfitAndLossLines, value: string) => {
    const num = parseFloat(value) || 0;
    commit({ ...formData, lines: { ...formData.lines, [field]: num } });
  };

  const handleComp = (field: keyof ProfitAndLossLines, value: string) => {
    const num = parseFloat(value) || 0;
    commit({ ...formData, comparatives: { priorYearLines: { ...(formData.comparatives?.priorYearLines ?? ZERO_LINES), [field]: num } } });
  };

  const l = formData.lines;
  const c = formData.comparatives?.priorYearLines ?? ZERO_LINES;

  const grossProfit = l.turnover - l.costOfSales;
  const totalOpExpenses = l.adminExpenses + l.distributionCosts + l.wages + l.rent + l.rates +
    l.lightAndHeat + l.cleaning + l.serviceCharges + l.motor + l.travel + l.advertising +
    l.computerSoftware + l.subscriptions + l.insurance + l.repairsMaintenance + l.sundryExpenses +
    l.supportAdminCosts + l.donations + l.hirePlantMachinery + l.telephoneInternet +
    l.printingPostage + l.professionalFees + l.accountancyFees + l.consultancyFees +
    l.legalFees + l.otherExpenses + l.depreciation + l.amortisation;
  const operatingProfit = grossProfit + l.otherOperatingIncome - totalOpExpenses;
  const profitBeforeTax = operatingProfit + l.interestReceivable - l.interestPayable - l.financeCharges - l.bankCharges;
  const profitAfterTax = profitBeforeTax - l.taxCharge;
  const retained = profitAfterTax - l.dividendsDeclared;

  const cGrossProfit = c.turnover - c.costOfSales;
  const cTotalOpExpenses = c.adminExpenses + c.distributionCosts + c.wages + c.rent + c.rates +
    c.lightAndHeat + c.cleaning + c.serviceCharges + c.motor + c.travel + c.advertising +
    c.computerSoftware + c.subscriptions + c.insurance + c.repairsMaintenance + c.sundryExpenses +
    c.supportAdminCosts + c.donations + c.hirePlantMachinery + c.telephoneInternet +
    c.printingPostage + c.professionalFees + c.accountancyFees + c.consultancyFees +
    c.legalFees + c.otherExpenses + c.depreciation + c.amortisation;
  const cOperatingProfit = cGrossProfit + c.otherOperatingIncome - cTotalOpExpenses;
  const cProfitBeforeTax = cOperatingProfit + c.interestReceivable - c.interestPayable - c.financeCharges - c.bankCharges;
  const cProfitAfterTax = cProfitBeforeTax - c.taxCharge;
  const cRetained = cProfitAfterTax - c.dividendsDeclared;

  // Shared props passed to module-level components
  const rowProps = { isFirstYear, onChange: handleChange, onChangeComp: handleComp };
  const subProps = { isFirstYear };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className={cardCls}>
        <h3 className={h3Cls}>Revenue</h3>
        <PLColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <PLRow label="Turnover" field="turnover" currentVal={l.turnover} priorVal={c.turnover} {...rowProps} />
          <PLRow label="Cost of Sales" field="costOfSales" currentVal={l.costOfSales} priorVal={c.costOfSales} {...rowProps} />
          <PLSubtotal label="Gross Profit" value={grossProfit} compValue={cGrossProfit} {...subProps} />
          <PLRow label="Other Operating Income" field="otherOperatingIncome" currentVal={l.otherOperatingIncome} priorVal={c.otherOperatingIncome} {...rowProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Operating Expenses</h3>
        <PLColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <PLRow label="Administrative Expenses" field="adminExpenses" currentVal={l.adminExpenses} priorVal={c.adminExpenses} {...rowProps} />
          <PLRow label="Distribution Costs" field="distributionCosts" currentVal={l.distributionCosts} priorVal={c.distributionCosts} {...rowProps} />
          <PLRow label="Wages & Salaries" field="wages" currentVal={l.wages} priorVal={c.wages} {...rowProps} />
          <PLRow label="Rent" field="rent" currentVal={l.rent} priorVal={c.rent} {...rowProps} />
          <PLRow label="Rates" field="rates" currentVal={l.rates} priorVal={c.rates} {...rowProps} />
          <PLRow label="Light & Heat" field="lightAndHeat" currentVal={l.lightAndHeat} priorVal={c.lightAndHeat} {...rowProps} />
          <PLRow label="Cleaning" field="cleaning" currentVal={l.cleaning} priorVal={c.cleaning} {...rowProps} />
          <PLRow label="Service Charges" field="serviceCharges" currentVal={l.serviceCharges} priorVal={c.serviceCharges} {...rowProps} />
          <PLRow label="Motor Expenses" field="motor" currentVal={l.motor} priorVal={c.motor} {...rowProps} />
          <PLRow label="Travel & Subsistence" field="travel" currentVal={l.travel} priorVal={c.travel} {...rowProps} />
          <PLRow label="Advertising & Marketing" field="advertising" currentVal={l.advertising} priorVal={c.advertising} {...rowProps} />
          <PLRow label="Computer & Software" field="computerSoftware" currentVal={l.computerSoftware} priorVal={c.computerSoftware} {...rowProps} />
          <PLRow label="Subscriptions" field="subscriptions" currentVal={l.subscriptions} priorVal={c.subscriptions} {...rowProps} />
          <PLRow label="Insurance" field="insurance" currentVal={l.insurance} priorVal={c.insurance} {...rowProps} />
          <PLRow label="Repairs & Maintenance" field="repairsMaintenance" currentVal={l.repairsMaintenance} priorVal={c.repairsMaintenance} {...rowProps} />
          <PLRow label="Sundry Expenses" field="sundryExpenses" currentVal={l.sundryExpenses} priorVal={c.sundryExpenses} {...rowProps} />
          <PLRow label="Support & Admin Costs" field="supportAdminCosts" currentVal={l.supportAdminCosts} priorVal={c.supportAdminCosts} {...rowProps} />
          <PLRow label="Donations" field="donations" currentVal={l.donations} priorVal={c.donations} {...rowProps} />
          <PLRow label="Hire of Plant & Machinery" field="hirePlantMachinery" currentVal={l.hirePlantMachinery} priorVal={c.hirePlantMachinery} {...rowProps} />
          <PLRow label="Telephone & Internet" field="telephoneInternet" currentVal={l.telephoneInternet} priorVal={c.telephoneInternet} {...rowProps} />
          <PLRow label="Printing & Postage" field="printingPostage" currentVal={l.printingPostage} priorVal={c.printingPostage} {...rowProps} />
          <PLRow label="Professional Fees" field="professionalFees" currentVal={l.professionalFees} priorVal={c.professionalFees} {...rowProps} />
          <PLRow label="Accountancy Fees" field="accountancyFees" currentVal={l.accountancyFees} priorVal={c.accountancyFees} {...rowProps} />
          <PLRow label="Consultancy Fees" field="consultancyFees" currentVal={l.consultancyFees} priorVal={c.consultancyFees} {...rowProps} />
          <PLRow label="Legal Fees" field="legalFees" currentVal={l.legalFees} priorVal={c.legalFees} {...rowProps} />
          <PLRow label="Other Expenses" field="otherExpenses" currentVal={l.otherExpenses} priorVal={c.otherExpenses} {...rowProps} />
          <PLRow label="Depreciation" field="depreciation" currentVal={l.depreciation} priorVal={c.depreciation} {...rowProps} />
          <PLRow label="Amortisation" field="amortisation" currentVal={l.amortisation} priorVal={c.amortisation} {...rowProps} />
          <PLSubtotal label="Operating Profit" value={operatingProfit} compValue={cOperatingProfit} {...subProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Finance & Taxation</h3>
        <PLColHeaders isFirstYear={isFirstYear} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <PLRow label="Interest Receivable" field="interestReceivable" currentVal={l.interestReceivable} priorVal={c.interestReceivable} {...rowProps} />
          <PLRow label="Interest Payable" field="interestPayable" currentVal={l.interestPayable} priorVal={c.interestPayable} {...rowProps} />
          <PLRow label="Finance Charges" field="financeCharges" currentVal={l.financeCharges} priorVal={c.financeCharges} {...rowProps} />
          <PLRow label="Bank Charges" field="bankCharges" currentVal={l.bankCharges} priorVal={c.bankCharges} {...rowProps} />
          <PLSubtotal label="Profit Before Tax" value={profitBeforeTax} compValue={cProfitBeforeTax} {...subProps} />
          <PLRow label="Tax Charge" field="taxCharge" currentVal={l.taxCharge} priorVal={c.taxCharge} {...rowProps} />
          <PLSubtotal label="Profit After Tax" value={profitAfterTax} compValue={cProfitAfterTax} highlight {...subProps} />
          <PLRow label="Dividends Declared" field="dividendsDeclared" currentVal={l.dividendsDeclared} priorVal={c.dividendsDeclared} {...rowProps} />
          <PLSubtotal label="Retained Profit for the Year" value={retained} compValue={cRetained} {...subProps} />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>P&L Summary</h3>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          {([
            ['Turnover', l.turnover, c.turnover],
            ['Cost of Sales', -l.costOfSales, -c.costOfSales],
            ['Gross Profit', grossProfit, cGrossProfit],
            ['Other Operating Income', l.otherOperatingIncome, c.otherOperatingIncome],
            ['Total Operating Expenses', -totalOpExpenses, -cTotalOpExpenses],
            ['Operating Profit', operatingProfit, cOperatingProfit],
            ['Net Finance Costs', l.interestReceivable - l.interestPayable - l.financeCharges - l.bankCharges, c.interestReceivable - c.interestPayable - c.financeCharges - c.bankCharges],
            ['Profit Before Tax', profitBeforeTax, cProfitBeforeTax],
            ['Tax Charge', -l.taxCharge, -c.taxCharge],
            ['Profit After Tax', profitAfterTax, cProfitAfterTax],
            ['Dividends', -l.dividendsDeclared, -c.dividendsDeclared],
            ['Retained Profit', retained, cRetained],
          ] as [string, number, number][]).map(([label, val, comp]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 120px' : '1fr 120px 120px', padding: '0.4rem 0', borderBottom: '1px solid #e2e8f0' }}>
              <span className="text-slate-700">{label}</span>
              <span className={`font-semibold text-right ${val < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(val)}</span>
              {!isFirstYear && <span className={`font-semibold text-right ${comp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(comp)}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

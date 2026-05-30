import { v4 as uuidv4 } from 'uuid';
import { storage } from '../config/database.js';

function getStore() {
  if (!storage.accountsSets) storage.accountsSets = new Map();
  return storage.accountsSets;
}

function makeDefaultAccountsSet(userId, overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(), user_id: userId, clientId: overrides.clientId || null,
    companyNumber: overrides.companyNumber || '',
    framework: overrides.framework || 'MICRO_FRS105', status: 'DRAFT',
    period: { startDate: overrides.startDate || '', endDate: overrides.endDate || '', isFirstYear: overrides.isFirstYear !== undefined ? overrides.isFirstYear : true },
    sections: {}, outputs: { htmlUrl: null, pdfUrl: null },
    validation: { errors: [], warnings: [], isBalanced: false },
    createdAt: now, updatedAt: now, createdBy: userId, lastEditedBy: userId,
  };
}

export function listAccountsSets(userId) {
  return Array.from(getStore().values()).filter(s => s.user_id === userId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getAccountsSet(id, userId) {
  const set = getStore().get(id);
  if (!set || set.user_id !== userId) return null;
  return set;
}

export function createAccountsSet(userId, data = {}) {
  const set = makeDefaultAccountsSet(userId, data);
  getStore().set(set.id, set);
  return set;
}

export function updateSection(id, userId, sectionKey, data) {
  const set = getAccountsSet(id, userId);
  if (!set) return null;
  set.sections = { ...set.sections, [sectionKey]: data };
  set.status = 'IN_PROGRESS';
  set.lastEditedBy = userId;
  set.updatedAt = new Date().toISOString();
  if (sectionKey === 'companyPeriod' && data) {
    if (data.framework) set.framework = data.framework;
    if (data.period) set.period = { ...set.period, ...data.period };
    if (data.company?.companyNumber) set.companyNumber = data.company.companyNumber;
  }
  getStore().set(id, set);
  return set;
}

export function validateAccountsSet(id, userId) {
  const set = getAccountsSet(id, userId);
  if (!set) return null;
  const errors = [];
  const warnings = [];

  const cp = set.sections.companyPeriod;
  if (!cp?.company?.name?.trim()) errors.push({ field: 'company.name', message: 'Company name is required', code: 'REQUIRED', section: 'companyPeriod' });
  if (!cp?.period?.startDate) errors.push({ field: 'period.startDate', message: 'Period start date is required', code: 'REQUIRED', section: 'companyPeriod' });
  if (!cp?.period?.endDate) errors.push({ field: 'period.endDate', message: 'Period end date is required', code: 'REQUIRED', section: 'companyPeriod' });
  if (!cp?.company?.directors?.length && set.framework !== 'SOLE_TRADER' && set.framework !== 'INDIVIDUAL') {
    warnings.push({ field: 'directors', message: 'No directors added', code: 'MISSING_DIRECTORS', section: 'companyPeriod' });
  }

  const fw = set.sections.frameworkDisclosures;
  if (!fw) errors.push({ field: 'frameworkDisclosures', message: 'Framework disclosures section is incomplete', code: 'REQUIRED', section: 'frameworkDisclosures' });

  const ap = set.sections.accountingPolicies;
  if (!ap?.basisOfPreparation?.trim()) errors.push({ field: 'basisOfPreparation', message: 'Basis of preparation is required', code: 'REQUIRED', section: 'accountingPolicies' });
  if (ap?.goingConcern?.isGoingConcern === false && !ap?.goingConcern?.noteText?.trim()) {
    errors.push({ field: 'goingConcern.noteText', message: 'Going concern note text is required when not a going concern', code: 'REQUIRED', section: 'accountingPolicies' });
  }

  const pl = set.sections.profitAndLoss;
  if (!pl?.lines) errors.push({ field: 'profitAndLoss', message: 'Profit and loss section is incomplete', code: 'REQUIRED', section: 'profitAndLoss' });

  // Notes validation
  const notes = set.sections.notes;
  if (notes?.dividends?.declared === true && !notes?.dividends?.totalAmount) {
    errors.push({ field: 'dividends.totalAmount', message: 'Dividend total amount is required when dividends are declared', code: 'REQUIRED', section: 'notes' });
  }
  if (notes?.relatedParties?.include === true && !notes?.relatedParties?.text?.trim()) {
    errors.push({ field: 'relatedParties.text', message: 'Related party note text is required', code: 'REQUIRED', section: 'notes' });
  }
  if (notes?.eventsAfterReportingDate?.include === true && !notes?.eventsAfterReportingDate?.text?.trim()) {
    errors.push({ field: 'eventsAfterReportingDate.text', message: 'Events after reporting date text is required', code: 'REQUIRED', section: 'notes' });
  }

  if (!set.sections.directorsApproval?.approved) {
    warnings.push({ field: 'approved', message: 'Accounts have not been approved by a director', code: 'NOT_APPROVED', section: 'directorsApproval' });
  }

  // Balance sheet check — Net Assets must equal Capital & Reserves
  const bs = set.sections.balanceSheet;
  let isBalanced = false;
  if (bs?.assets && bs?.liabilities && bs?.equity) {
    const fa = bs.assets.fixedAssets || {};
    const ca = bs.assets.currentAssets || {};
    const totalAssets =
      (Number(fa.tangibleFixedAssets)||0) + (Number(fa.intangibleAssets)||0) + (Number(fa.investments)||0) +
      (Number(ca.stock)||0) + (Number(ca.debtors)||0) + (Number(ca.cash)||0) + (Number(ca.prepayments)||0);
    const cw = bs.liabilities.creditorsWithinOneYear || {};
    const ca2 = bs.liabilities.creditorsAfterOneYear || {};
    const totalLiabilities =
      (Number(cw.bankLoans)||0) + (Number(cw.tradeCreditors)||0) + (Number(cw.groupUndertakings)||0) +
      (Number(cw.taxes)||0) + (Number(cw.accrualsDeferredIncome)||0) + (Number(cw.directorsLoan)||0) +
      (Number(cw.otherCreditors)||0) + (Number(ca2.loans)||0) + (Number(ca2.other)||0) + (Number(bs.provisions)||0);
    const netAssets = totalAssets - totalLiabilities;
    const eq = bs.equity || {};
    const capitalAndReserves =
      (Number(eq.shareCapital)||0) + (Number(eq.sharePremium)||0) + (Number(eq.revaluationReserve)||0) +
      (Number(eq.retainedEarnings)||0) + (Number(eq.otherReserves)||0);
    const difference = netAssets - capitalAndReserves;
    isBalanced = Math.abs(difference) < 1;
    if (!isBalanced) {
      errors.push({
        field: 'balanceSheet',
        message: `Balance sheet does not balance — Net Assets: ${netAssets.toFixed(0)}, Capital & Reserves: ${capitalAndReserves.toFixed(0)}, Difference: ${difference.toFixed(0)}`,
        code: 'UNBALANCED',
        section: 'balanceSheet',
      });
    }
  }

  const isValid = errors.length === 0;
  set.validation = { errors, warnings, isBalanced };
  if (isValid && isBalanced) set.status = 'READY';
  set.updatedAt = new Date().toISOString();
  getStore().set(id, set);
  return { errors, warnings, isBalanced, isValid };
}

export function generateOutputs(id, userId) {
  const set = getAccountsSet(id, userId);
  if (!set) return null;
  const html = buildAccountsHtml(set);
  const htmlUrl = `/accounts-sets/${id}/outputs/html/accounts.html`;
  const pdfUrl = `/accounts-sets/${id}/outputs/pdf/accounts.html`;
  set.outputs = { htmlUrl, pdfUrl, html };
  set.status = 'LOCKED';
  set.updatedAt = new Date().toISOString();
  getStore().set(id, set);
  return { htmlUrl, pdfUrl };
}

export function deleteAccountsSet(id, userId) {
  const set = getAccountsSet(id, userId);
  if (!set) return false;
  getStore().delete(id);
  return true;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = n => new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtDateShort = d => d ? new Date(d).toLocaleDateString('en-GB') : '';

function periodLabel(period) {
  if (!period?.startDate || !period?.endDate) return '';
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const isFullYear = months >= 11 && months <= 13;
  return isFullYear ? `year ended ${fmtDate(period.endDate)}` : `period ended ${fmtDate(period.endDate)}`;
}

function row(label, value, comp, bold = false, indent = false) {
  const style = bold ? 'font-weight:700;border-top:1px solid #4c1d95;' : '';
  const labelStyle = indent ? 'padding-left:1.5rem;' : '';
  const compCell = comp !== undefined ? `<td style="text-align:right;padding:4px 8px;">${comp !== null ? fmt(comp) : ''}</td>` : '';
  return `<tr><td style="padding:4px 8px;${labelStyle}${style}">${label}</td><td style="text-align:right;padding:4px 8px;${style}">${value !== null ? fmt(value) : ''}</td>${compCell}</tr>`;
}

function sectionHeader(label, hasComp) {
  const compCell = hasComp ? '<th style="text-align:right;padding:6px 8px;color:#7c3aed;">Prior Year £</th>' : '';
  return `<tr style="background:#f5f3ff;"><th style="text-align:left;padding:6px 8px;color:#4c1d95;">${label}</th><th style="text-align:right;padding:6px 8px;color:#7c3aed;">Current Year £</th>${compCell}</tr>`;
}
function buildPlSection(pl, hasComp) {
  const l = pl.lines || {};

  const c = pl.comparatives?.priorYearLines || {};
  const n = (v) => Number(v) || 0;

  const grossProfit = n(l.turnover) - n(l.costOfSales);
  const cGrossProfit = n(c.turnover) - n(c.costOfSales);

  const opEx = n(l.adminExpenses)+n(l.distributionCosts)+n(l.wages)+n(l.rent)+n(l.rates)+n(l.lightAndHeat)+n(l.cleaning)+n(l.serviceCharges)+n(l.motor)+n(l.travel)+n(l.advertising)+n(l.computerSoftware)+n(l.subscriptions)+n(l.insurance)+n(l.repairsMaintenance)+n(l.sundryExpenses)+n(l.supportAdminCosts)+n(l.donations)+n(l.hirePlantMachinery)+n(l.telephoneInternet)+n(l.printingPostage)+n(l.professionalFees)+n(l.accountancyFees)+n(l.consultancyFees)+n(l.legalFees)+n(l.otherExpenses)+n(l.depreciation)+n(l.amortisation);
  const cOpEx = n(c.adminExpenses)+n(c.distributionCosts)+n(c.wages)+n(c.rent)+n(c.rates)+n(c.lightAndHeat)+n(c.cleaning)+n(c.serviceCharges)+n(c.motor)+n(c.travel)+n(c.advertising)+n(c.computerSoftware)+n(c.subscriptions)+n(c.insurance)+n(c.repairsMaintenance)+n(c.sundryExpenses)+n(c.supportAdminCosts)+n(c.donations)+n(c.hirePlantMachinery)+n(c.telephoneInternet)+n(c.printingPostage)+n(c.professionalFees)+n(c.accountancyFees)+n(c.consultancyFees)+n(c.legalFees)+n(c.otherExpenses)+n(c.depreciation)+n(c.amortisation);

  const opProfit = grossProfit + n(l.otherOperatingIncome) - opEx;
  const cOpProfit = cGrossProfit + n(c.otherOperatingIncome) - cOpEx;
  const pbt = opProfit + n(l.interestReceivable) - n(l.interestPayable) - n(l.financeCharges) - n(l.bankCharges);
  const cPbt = cOpProfit + n(c.interestReceivable) - n(c.interestPayable) - n(c.financeCharges) - n(c.bankCharges);
  const pat = pbt - n(l.taxCharge);
  const cPat = cPbt - n(c.taxCharge);
  const retained = pat - n(l.dividendsDeclared);
  const cRetained = cPat - n(c.dividendsDeclared);

  const cv = (v, cv2) => hasComp ? cv2 : undefined;

  let t = `<table>${sectionHeader('Income Statement', hasComp)}`;
  t += row('Turnover', n(l.turnover), cv(0, n(c.turnover)));
  if (n(l.costOfSales) || n(c.costOfSales)) t += row('Cost of sales', -n(l.costOfSales), cv(0, -n(c.costOfSales)), false, true);
  t += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Gross profit</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(grossProfit)}</td>${hasComp ? `<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cGrossProfit)}</td>` : ''}</tr>`;
  if (n(l.otherOperatingIncome) || n(c.otherOperatingIncome)) t += row('Other operating income', n(l.otherOperatingIncome), cv(0, n(c.otherOperatingIncome)), false, true);
  t += row('Administrative and other expenses', -opEx, cv(0, -cOpEx), false, true);
  t += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Operating profit</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(opProfit)}</td>${hasComp ? `<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cOpProfit)}</td>` : ''}</tr>`;
  if (n(l.interestReceivable) || n(c.interestReceivable)) t += row('Interest receivable', n(l.interestReceivable), cv(0, n(c.interestReceivable)), false, true);
  if (n(l.interestPayable)+n(l.financeCharges)+n(l.bankCharges)) t += row('Interest payable and similar charges', -(n(l.interestPayable)+n(l.financeCharges)+n(l.bankCharges)), cv(0, -(n(c.interestPayable)+n(c.financeCharges)+n(c.bankCharges))), false, true);
  t += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Profit before taxation</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(pbt)}</td>${hasComp ? `<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cPbt)}</td>` : ''}</tr>`;
  if (n(l.taxCharge) || n(c.taxCharge)) t += row('Tax on profit', -n(l.taxCharge), cv(0, -n(c.taxCharge)), false, true);
  t += `<tr class="total-row"><td style="padding:4px 8px;">Profit for the financial year</td><td style="text-align:right;padding:4px 8px;">${fmt(pat)}</td>${hasComp ? `<td style="text-align:right;padding:4px 8px;">${fmt(cPat)}</td>` : ''}</tr>`;
  t += `</table>`;
  return { html: t, pat, cPat, retained, cRetained };
}

function buildBsSection(bs, hasComp) {
  const n = (v) => Number(v) || 0;
  const fa = bs.assets?.fixedAssets || {};
  const ca = bs.assets?.currentAssets || {};
  const cw = bs.liabilities?.creditorsWithinOneYear || {};
  const ca2 = bs.liabilities?.creditorsAfterOneYear || {};
  const eq = bs.equity || {};
  const pfa = bs.comparatives?.prior?.assets?.fixedAssets || {};
  const pca = bs.comparatives?.prior?.assets?.currentAssets || {};
  const pcw = bs.comparatives?.prior?.liabilities?.creditorsWithinOneYear || {};
  const pca2 = bs.comparatives?.prior?.liabilities?.creditorsAfterOneYear || {};
  const peq = bs.comparatives?.prior?.equity || {};

  const totalFA = n(fa.tangibleFixedAssets)+n(fa.intangibleAssets)+n(fa.investments);
  const totalCA = n(ca.stock)+n(ca.debtors)+n(ca.cash)+n(ca.prepayments);
  const totalAssets = totalFA + totalCA;
  const totalCL = n(cw.bankLoans)+n(cw.tradeCreditors)+n(cw.groupUndertakings)+n(cw.taxes)+n(cw.accrualsDeferredIncome)+n(cw.directorsLoan)+n(cw.otherCreditors);
  const totalLTL = n(ca2.loans)+n(ca2.other);
  const provisions = n(bs.provisions);
  const totalLiab = totalCL + totalLTL + provisions;
  const totalEq = n(eq.shareCapital)+n(eq.sharePremium)+n(eq.revaluationReserve)+n(eq.retainedEarnings)+n(eq.otherReserves);
  const netAssets = totalAssets - totalLiab;

  const pTotalFA = n(pfa.tangibleFixedAssets)+n(pfa.intangibleAssets)+n(pfa.investments);
  const pTotalCA = n(pca.stock)+n(pca.debtors)+n(pca.cash)+n(pca.prepayments);
  const pTotalAssets = pTotalFA + pTotalCA;
  const pTotalCL = n(pcw.bankLoans)+n(pcw.tradeCreditors)+n(pcw.groupUndertakings)+n(pcw.taxes)+n(pcw.accrualsDeferredIncome)+n(pcw.directorsLoan)+n(pcw.otherCreditors);
  const pTotalLTL = n(pca2.loans)+n(pca2.other);
  const pTotalLiab = pTotalCL + pTotalLTL + n(bs.comparatives?.prior?.provisions);
  const pTotalEq = n(peq.shareCapital)+n(peq.sharePremium)+n(peq.revaluationReserve)+n(peq.retainedEarnings)+n(peq.otherReserves);
  const pNetAssets = pTotalAssets - pTotalLiab;

  const cv = (v, pv) => hasComp ? pv : undefined;

  let t = `<table>${sectionHeader('Statement of Financial Position', hasComp)}`;
  t += `<tr><td colspan="${hasComp?3:2}" style="padding:6px 8px;font-weight:700;color:#4c1d95;">Fixed Assets</td></tr>`;
  if (n(fa.tangibleFixedAssets)||n(pfa.tangibleFixedAssets)) t += row('Tangible fixed assets', n(fa.tangibleFixedAssets), cv(0,n(pfa.tangibleFixedAssets)), false, true);
  if (n(fa.intangibleAssets)||n(pfa.intangibleAssets)) t += row('Intangible assets', n(fa.intangibleAssets), cv(0,n(pfa.intangibleAssets)), false, true);
  if (n(fa.investments)||n(pfa.investments)) t += row('Investments', n(fa.investments), cv(0,n(pfa.investments)), false, true);
  t += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Total fixed assets</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(totalFA)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(pTotalFA)}</td>`:''}</tr>`;
  t += `<tr><td colspan="${hasComp?3:2}" style="padding:6px 8px;font-weight:700;color:#4c1d95;">Current Assets</td></tr>`;
  if (n(ca.stock)||n(pca.stock)) t += row('Stocks', n(ca.stock), cv(0,n(pca.stock)), false, true);
  if (n(ca.debtors)||n(pca.debtors)) t += row('Debtors', n(ca.debtors), cv(0,n(pca.debtors)), false, true);
  if (n(ca.prepayments)||n(pca.prepayments)) t += row('Prepayments and accrued income', n(ca.prepayments), cv(0,n(pca.prepayments)), false, true);
  t += row('Cash at bank and in hand', n(ca.cash), cv(0,n(pca.cash)), false, true);
  t += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Total current assets</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(totalCA)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(pTotalCA)}</td>`:''}</tr>`;
  t += `<tr><td colspan="${hasComp?3:2}" style="padding:6px 8px;font-weight:700;color:#4c1d95;">Creditors: amounts falling due within one year</td></tr>`;
  if (n(cw.bankLoans)||n(pcw.bankLoans)) t += row('Bank loans and overdrafts', -n(cw.bankLoans), cv(0,-n(pcw.bankLoans)), false, true);
  if (n(cw.tradeCreditors)||n(pcw.tradeCreditors)) t += row('Trade creditors', -n(cw.tradeCreditors), cv(0,-n(pcw.tradeCreditors)), false, true);
  if (n(cw.groupUndertakings)||n(pcw.groupUndertakings)) t += row('Amounts owed to group undertakings', -n(cw.groupUndertakings), cv(0,-n(pcw.groupUndertakings)), false, true);
  if (n(cw.taxes)||n(pcw.taxes)) t += row('Taxation and social security', -n(cw.taxes), cv(0,-n(pcw.taxes)), false, true);
  if (n(cw.accrualsDeferredIncome)||n(pcw.accrualsDeferredIncome)) t += row('Accruals and deferred income', -n(cw.accrualsDeferredIncome), cv(0,-n(pcw.accrualsDeferredIncome)), false, true);
  if (n(cw.directorsLoan)||n(pcw.directorsLoan)) t += row("Directors' loan account", -n(cw.directorsLoan), cv(0,-n(pcw.directorsLoan)), false, true);
  if (n(cw.otherCreditors)||n(pcw.otherCreditors)) t += row('Other creditors', -n(cw.otherCreditors), cv(0,-n(pcw.otherCreditors)), false, true);
  t += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Net current assets</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(totalCA-totalCL)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(pTotalCA-pTotalCL)}</td>`:''}</tr>`;
  if (totalLTL || pTotalLTL) {
    t += `<tr><td colspan="${hasComp?3:2}" style="padding:6px 8px;font-weight:700;color:#4c1d95;">Creditors: amounts falling due after more than one year</td></tr>`;
    if (n(ca2.loans)||n(pca2.loans)) t += row('Bank and other loans', -n(ca2.loans), cv(0,-n(pca2.loans)), false, true);
    if (n(ca2.other)||n(pca2.other)) t += row('Other creditors', -n(ca2.other), cv(0,-n(pca2.other)), false, true);
  }
  if (provisions) t += row('Provisions for liabilities', -provisions, cv(0,-n(bs.comparatives?.prior?.provisions)), false, true);
  t += `<tr class="total-row"><td style="padding:4px 8px;">Net assets</td><td style="text-align:right;padding:4px 8px;">${fmt(netAssets)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;">${fmt(pNetAssets)}</td>`:''}</tr>`;
  t += `<tr><td colspan="${hasComp?3:2}" style="padding:6px 8px;font-weight:700;color:#4c1d95;">Capital and Reserves</td></tr>`;
  t += row('Called up share capital', n(eq.shareCapital), cv(0,n(peq.shareCapital)), false, true);
  if (n(eq.sharePremium)||n(peq.sharePremium)) t += row('Share premium account', n(eq.sharePremium), cv(0,n(peq.sharePremium)), false, true);
  if (n(eq.revaluationReserve)||n(peq.revaluationReserve)) t += row('Revaluation reserve', n(eq.revaluationReserve), cv(0,n(peq.revaluationReserve)), false, true);
  t += row('Profit and loss account', n(eq.retainedEarnings), cv(0,n(peq.retainedEarnings)), false, true);
  if (n(eq.otherReserves)||n(peq.otherReserves)) t += row('Other reserves', n(eq.otherReserves), cv(0,n(peq.otherReserves)), false, true);
  t += `<tr class="total-row"><td style="padding:4px 8px;">Shareholders' funds</td><td style="text-align:right;padding:4px 8px;">${fmt(totalEq)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;">${fmt(pTotalEq)}</td>`:''}</tr>`;
  t += `</table>`;
  return t;
}

function buildNotesSection(set, plResult, hasComp) {
  const notes = set.sections.notes || {};
  const ap = set.sections.accountingPolicies || {};
  const cp = set.sections.companyPeriod || {};
  const period = cp.period || set.period || {};
  const pLabel = periodLabel(period);
  const isST = set.framework === 'SOLE_TRADER' || set.framework === 'INDIVIDUAL';
  let html = `<div class="section"><h2>Notes to the Financial Statements</h2>`;
  let noteNum = 1;

  // 1. Statutory information
  html += `<h3>${noteNum++}. Statutory Information</h3>`;
  html += `<p class="note-text">${cp.company?.name || 'The company'} is a private company limited by shares, incorporated in ${notes.countryOfIncorporation || 'England and Wales'}.`;
  if (cp.company?.companyNumber) html += ` The registered company number is ${cp.company.companyNumber}.`;
  html += `</p>`;
  if (notes.principalActivity) html += `<p class="note-text">The principal activity of the company during the ${pLabel} was ${notes.principalActivity}.</p>`;

  // 2. Basis of preparation
  if (ap.basisOfPreparation) {
    html += `<h3>${noteNum++}. Basis of Preparation</h3><p class="note-text">${ap.basisOfPreparation}</p>`;
  }

  // 3. Going concern
  if (ap.goingConcern?.isGoingConcern === false && ap.goingConcern?.noteText) {
    html += `<h3>${noteNum++}. Going Concern</h3><p class="note-text">${ap.goingConcern.noteText}</p>`;
  }

  // 4. Turnover
  if (ap.turnoverPolicyText) {
    html += `<h3>${noteNum++}. Turnover</h3><p class="note-text">${ap.turnoverPolicyText}</p>`;
  }

  // 5. Tangible fixed assets policy
  if (ap.tangibleFixedAssets?.hasAssets) {
    html += `<h3>${noteNum++}. Tangible Fixed Assets</h3>`;
    if (ap.tangibleFixedAssets.policyText) html += `<p class="note-text">${ap.tangibleFixedAssets.policyText}</p>`;
    if (ap.tangibleFixedAssets.depreciationRates?.length) {
      html += `<p class="note-text">Depreciation is provided at the following rates:</p><table><tr><th style="text-align:left;padding:4px 8px;">Asset Category</th><th style="text-align:left;padding:4px 8px;">Method</th><th style="text-align:right;padding:4px 8px;">Rate</th></tr>`;
      for (const r of ap.tangibleFixedAssets.depreciationRates) {
        html += `<tr><td style="padding:4px 8px;">${r.category}</td><td style="padding:4px 8px;">${r.method === 'REDUCING_BALANCE' ? 'Reducing balance' : 'Straight line'}</td><td style="text-align:right;padding:4px 8px;">${r.ratePercent}%</td></tr>`;
      }
      html += `</table>`;
    }
    // Tangible asset categories note
    if (notes.tangibleAssetCategories?.length) {
      for (const cat of notes.tangibleAssetCategories) {
        html += `<h3 style="margin-top:12px;">${cat.name}</h3><table>`;
        html += `<tr style="background:#f5f3ff;"><th style="text-align:left;padding:4px 8px;">Movement</th><th style="text-align:right;padding:4px 8px;">£</th></tr>`;
        html += `<tr><td style="padding:4px 8px;">Cost brought forward</td><td style="text-align:right;padding:4px 8px;">${fmt(cat.costBfwd)}</td></tr>`;
        if (cat.additions) html += `<tr><td style="padding:4px 8px;padding-left:1.5rem;">Additions</td><td style="text-align:right;padding:4px 8px;">${fmt(cat.additions)}</td></tr>`;
        if (cat.disposals) html += `<tr><td style="padding:4px 8px;padding-left:1.5rem;">Disposals</td><td style="text-align:right;padding:4px 8px;">(${fmt(cat.disposals)})</td></tr>`;
        html += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Cost carried forward</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cat.costCfwd)}</td></tr>`;
        html += `<tr><td style="padding:4px 8px;">Depreciation brought forward</td><td style="text-align:right;padding:4px 8px;">${fmt(cat.depnBfwd)}</td></tr>`;
        if (cat.depnCharge) html += `<tr><td style="padding:4px 8px;padding-left:1.5rem;">Charge for the year</td><td style="text-align:right;padding:4px 8px;">${fmt(cat.depnCharge)}</td></tr>`;
        if (cat.depnOnDisposals) html += `<tr><td style="padding:4px 8px;padding-left:1.5rem;">On disposals</td><td style="text-align:right;padding:4px 8px;">(${fmt(cat.depnOnDisposals)})</td></tr>`;
        html += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Depreciation carried forward</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cat.depnCfwd)}</td></tr>`;
        html += `<tr class="total-row"><td style="padding:4px 8px;">Net book value — current year</td><td style="text-align:right;padding:4px 8px;">${fmt(cat.nbvCurrent)}</td></tr>`;
        if (hasComp) html += `<tr><td style="padding:4px 8px;">Net book value — prior year</td><td style="text-align:right;padding:4px 8px;">${fmt(cat.nbvPrior)}</td></tr>`;
        html += `</table>`;
      }
    }
  }

  // Debtors note
  if (notes.debtorBreakdown) {
    html += `<h3>${noteNum++}. Debtors</h3><table>${sectionHeader('Debtors', hasComp)}`;
    const db = notes.debtorBreakdown;
    const pdb = notes.priorDebtorBreakdown || {};
    if (db.tradeDebtors||pdb.tradeDebtors) html += row('Trade debtors', db.tradeDebtors, hasComp?pdb.tradeDebtors:undefined, false, true);
    if (db.otherDebtors||pdb.otherDebtors) html += row('Other debtors', db.otherDebtors, hasComp?pdb.otherDebtors:undefined, false, true);
    if (db.prepayments||pdb.prepayments) html += row('Prepayments and accrued income', db.prepayments, hasComp?pdb.prepayments:undefined, false, true);
    const total = (db.tradeDebtors||0)+(db.otherDebtors||0)+(db.prepayments||0)+(db.accrued||0);
    const pTotal = (pdb.tradeDebtors||0)+(pdb.otherDebtors||0)+(pdb.prepayments||0)+(pdb.accrued||0);
    html += `<tr class="total-row"><td style="padding:4px 8px;">Total debtors</td><td style="text-align:right;padding:4px 8px;">${fmt(total)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;">${fmt(pTotal)}</td>`:''}</tr>`;
    html += `</table>`;
  }

  // Creditors note
  if (notes.creditorBreakdownWithin) {
    html += `<h3>${noteNum++}. Creditors: amounts falling due within one year</h3><table>${sectionHeader('Creditors', hasComp)}`;
    const cb = notes.creditorBreakdownWithin;
    const pcb = notes.priorCreditorBreakdownWithin || {};
    const fields = [['bankLoans','Bank loans and overdrafts'],['tradeCreditors','Trade creditors'],['groupUndertakings','Amounts owed to group undertakings'],['taxationSocialSecurity','Taxation and social security'],['directorsLoan',"Directors' loan account"],['accrualsDeferredIncome','Accruals and deferred income'],['otherCreditors','Other creditors']];
    for (const [f, label] of fields) {
      if (cb[f]||pcb[f]) html += row(label, cb[f]||0, hasComp?(pcb[f]||0):undefined, false, true);
    }
    html += `</table>`;
  }

  // Share capital note
  if (!isST && notes.shareClasses?.length) {
    html += `<h3>${noteNum++}. Share Capital</h3><table>`;
    html += `<tr style="background:#f5f3ff;"><th style="text-align:left;padding:4px 8px;">Class</th><th style="text-align:right;padding:4px 8px;">Number</th><th style="text-align:right;padding:4px 8px;">Nominal Value</th><th style="text-align:right;padding:4px 8px;">Total £</th></tr>`;
    for (const sc of notes.shareClasses) {
      html += `<tr><td style="padding:4px 8px;">${sc.shareClass}</td><td style="text-align:right;padding:4px 8px;">${fmt(sc.numberOfShares)}</td><td style="text-align:right;padding:4px 8px;">£${sc.nominalValue.toFixed(2)}</td><td style="text-align:right;padding:4px 8px;">${fmt(sc.numberOfShares * sc.nominalValue)}</td></tr>`;
    }
    html += `</table>`;
  }

  // Dividends note — only if declared and amount is present
  if (notes.dividends?.declared === true && notes.dividends?.totalAmount) {
    html += `<h3>${noteNum++}. Dividends</h3>`;
    html += `<p class="note-text">During the ${pLabel}, dividends of ${fmt(notes.dividends.totalAmount)} were declared`;
    if (notes.dividends.perShare) html += ` (${fmt(notes.dividends.perShare)} per share)`;
    html += `.</p>`;
  }

  // Employees note
  if (notes.employees?.include === true && notes.employees.averageEmployees !== undefined) {
    html += `<h3>${noteNum++}. Employees</h3>`;
    html += `<p class="note-text">The average number of persons employed by the company during the ${pLabel} was ${notes.employees.averageEmployees}`;
    if (hasComp && notes.employees.priorAverageEmployees !== undefined) html += ` (prior year: ${notes.employees.priorAverageEmployees})`;
    html += `.</p>`;
  }

  // Directors' remuneration
  if (!isST && notes.directorsRemuneration?.include === true) {
    const dr = notes.directorsRemuneration;
    html += `<h3>${noteNum++}. Directors' Remuneration</h3><table>${sectionHeader("Directors' Remuneration", hasComp)}`;
    html += row('Aggregate remuneration', dr.aggregateRemuneration, hasComp?dr.priorAggregateRemuneration:undefined, false, true);
    if (dr.pensionContributions||dr.priorPensionContributions) html += row('Pension contributions', dr.pensionContributions, hasComp?dr.priorPensionContributions:undefined, false, true);
    html += `</table>`;
  }

  // Deferred tax
  if (notes.deferredTax?.include === true) {
    html += `<h3>${noteNum++}. Deferred Tax</h3><table>${sectionHeader('Deferred Tax', hasComp)}`;
    html += row('Other timing differences', notes.deferredTax.otherTimingDifferences, hasComp?notes.deferredTax.priorOtherTimingDifferences:undefined, false, true);
    html += `</table>`;
  }

  // Related parties
  if (notes.relatedParties?.include === true && notes.relatedParties.text) {
    html += `<h3>${noteNum++}. Related Party Transactions</h3><p class="note-text">${notes.relatedParties.text}</p>`;
  }

  // Events after reporting date
  if (notes.eventsAfterReportingDate?.include === true && notes.eventsAfterReportingDate.text) {
    html += `<h3>${noteNum++}. Events After the Reporting Date</h3><p class="note-text">${notes.eventsAfterReportingDate.text}</p>`;
  }

  // Additional notes
  for (const n of (notes.additionalNotes || [])) {
    if (n.title || n.text) {
      html += `<h3>${noteNum++}. ${n.title || 'Additional Note'}</h3><p class="note-text">${n.text}</p>`;
    }
  }

  html += `</div>`;
  return html;
}

// Override buildAccountsHtml with the complete version
function buildAccountsHtml(set) {
  const cp = set.sections.companyPeriod || {};
  const company = cp.company || {};
  const period = cp.period || set.period || {};
  const accountant = cp.accountant || {};
  const fw = set.sections.frameworkDisclosures || {};
  const ap = set.sections.accountingPolicies || {};
  const pl = set.sections.profitAndLoss || {};
  const bs = set.sections.balanceSheet || {};
  const notes = set.sections.notes || {};
  const approval = set.sections.directorsApproval || {};
  const isFirstYear = period.isFirstYear !== false;
  const hasComp = !isFirstYear;
  const pLabel = periodLabel(period);
  const isSoleTrader = set.framework === 'SOLE_TRADER' || set.framework === 'INDIVIDUAL';

  const addr = (a) => a ? [a.line1, a.line2, a.town, a.county, a.postcode, a.country].filter(Boolean).join(', ') : '';

  const css = `*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Arial',sans-serif;font-size:10pt;color:#1e1b4b;background:#fff;max-width:210mm;margin:0 auto;padding:0;}.cover{background:linear-gradient(135deg,#4c1d95 0%,#7c3aed 60%,#a78bfa 100%);color:#fff;padding:60px 48px;min-height:280px;display:flex;flex-direction:column;justify-content:flex-end;}.cover h1{font-size:28pt;font-weight:900;letter-spacing:-0.5px;margin-bottom:8px;}.cover .sub{font-size:12pt;opacity:0.85;margin-bottom:4px;}.cover .meta{font-size:9pt;opacity:0.7;margin-top:16px;}.section{padding:32px 48px;border-bottom:1px solid #ede9fe;}.section:last-child{border-bottom:none;}h2{font-size:13pt;font-weight:800;color:#4c1d95;margin-bottom:16px;padding-bottom:6px;border-bottom:2px solid #7c3aed;}h3{font-size:10pt;font-weight:700;color:#4c1d95;margin:16px 0 8px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:9.5pt;}td,th{padding:4px 8px;vertical-align:top;}.total-row td{font-weight:700;border-top:2px solid #4c1d95;border-bottom:2px solid #4c1d95;}.subtotal-row td{font-weight:600;border-top:1px solid #c4b5fd;}.info-table td:first-child{font-weight:600;width:200px;color:#4c1d95;}.note-text{font-size:9pt;color:#374151;line-height:1.6;margin-bottom:12px;}.approval-box{background:#f5f3ff;border:1px solid #c4b5fd;border-radius:6px;padding:20px;margin-top:16px;}.footer{background:#4c1d95;color:#fff;padding:16px 48px;font-size:8pt;text-align:center;opacity:0.9;}@media print{.section{page-break-inside:avoid;}.cover{page-break-after:always;}}`;

  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Statutory Accounts – ${company.name || ''}</title><style>${css}</style></head><body>`;

  // Cover
  html += `<div class="cover"><div class="sub">${isSoleTrader ? 'Accounts' : 'Statutory Accounts'}</div><h1>${company.name || 'Company'}</h1><div class="sub">For the ${pLabel}</div><div class="meta">${company.companyNumber ? `Company Number: ${company.companyNumber}` : ''}${company.sicCode ? ` &nbsp;|&nbsp; SIC: ${company.sicCode}` : ''}</div></div>`;

  // Company Information
  html += `<div class="section"><h2>Company Information</h2><table class="info-table">`;
  html += `<tr><td>Registered Name</td><td>${company.name || ''}</td></tr>`;
  if (company.companyNumber) html += `<tr><td>Company Number</td><td>${company.companyNumber}</td></tr>`;
  if (company.registeredOffice) html += `<tr><td>Registered Office</td><td>${addr(company.registeredOffice)}</td></tr>`;
  if (company.sicCode) html += `<tr><td>Nature of Business</td><td>${company.sicCode}${company.sicDescription ? ' – ' + company.sicDescription : ''}</td></tr>`;
  html += `<tr><td>Accounting Period</td><td>${fmtDate(period.startDate)} to ${fmtDate(period.endDate)}</td></tr>`;
  if (notes.countryOfIncorporation) html += `<tr><td>Country of Incorporation</td><td>${notes.countryOfIncorporation}</td></tr>`;
  if ((company.directors || []).length > 0) html += `<tr><td>Directors</td><td>${company.directors.map(d => d.name).join(', ')}</td></tr>`;
  if (accountant.firmName) html += `<tr><td>Accountants</td><td>${accountant.firmName}${accountant.address ? ', ' + addr(accountant.address) : ''}</td></tr>`;
  html += `</table></div>`;

  // Directors' Report
  if (fw.includeDirectorsReport) {
    html += `<div class="section"><h2>Directors' Report</h2>`;
    if (notes.principalActivity) html += `<h3>Principal Activity</h3><p class="note-text">${notes.principalActivity}</p>`;
    html += `<h3>Results</h3><p class="note-text">The results for the ${pLabel} are set out in the profit and loss account on the following pages.</p>`;
    if (notes.dividends?.declared && notes.dividends.totalAmount) html += `<h3>Dividends</h3><p class="note-text">Dividends of £${fmt(notes.dividends.totalAmount)} were declared during the ${pLabel}.</p>`;
    html += `<h3>Directors</h3><p class="note-text">The directors who served during the period were: ${(company.directors || []).map(d => d.name).join(', ') || 'None listed'}.</p>`;
    html += `</div>`;
  }

  // Accountants' Report
  if (fw.includeAccountantsReport && accountant.firmName) {
    html += `<div class="section"><h2>Accountants' Report to the Directors</h2>`;
    html += `<p class="note-text">We have prepared the accounts for the ${pLabel} from the accounting records and information and explanations supplied to us.</p>`;
    html += `<p class="note-text"><strong>${accountant.firmName}</strong><br/>${addr(accountant.address)}</p>`;
    if (accountant.signedDate) html += `<p class="note-text">Date: ${fmtDate(accountant.signedDate)}</p>`;
    html += `</div>`;
  }

  // Income Statement
  if (fw.includePLInClientPack !== false && pl.lines) {
    const plResult = buildPlSection(pl, hasComp);
    html += `<div class="section"><h2>Income Statement</h2><p class="note-text" style="margin-bottom:8px;">For the ${pLabel}</p>${plResult.html}</div>`;

    // Statement of Changes in Equity
    const eq = bs.equity || {};
    const peq = bs.comparatives?.prior?.equity || {};
    const pat = plResult.pat;
    const divs = Number(pl.lines?.dividendsDeclared) || 0;
    html += `<div class="section"><h2>Statement of Changes in Equity</h2><table>`;
    html += `<tr style="background:#f5f3ff;"><th style="text-align:left;padding:4px 8px;">Movement</th><th style="text-align:right;padding:4px 8px;">£</th></tr>`;
    html += `<tr><td style="padding:4px 8px;">Opening retained earnings</td><td style="text-align:right;padding:4px 8px;">${fmt(isFirstYear ? 0 : Number(peq.retainedEarnings)||0)}</td></tr>`;
    html += `<tr><td style="padding:4px 8px;padding-left:1.5rem;">Profit for the year</td><td style="text-align:right;padding:4px 8px;">${fmt(pat)}</td></tr>`;
    if (divs) html += `<tr><td style="padding:4px 8px;padding-left:1.5rem;">Dividends paid</td><td style="text-align:right;padding:4px 8px;">(${fmt(divs)})</td></tr>`;
    html += `<tr class="total-row"><td style="padding:4px 8px;">Closing retained earnings</td><td style="text-align:right;padding:4px 8px;">${fmt(Number(eq.retainedEarnings)||0)}</td></tr>`;
    html += `</table></div>`;

    // Balance Sheet
    html += `<div class="section"><h2>Statement of Financial Position</h2><p class="note-text" style="margin-bottom:8px;">As at ${fmtDate(period.endDate)}</p>${buildBsSection(bs, hasComp)}`;
    if (approval.approved) {
      html += `<div class="approval-box"><p class="note-text">These accounts were approved by the board of directors on ${fmtDate(approval.approvalDate)} and signed on its behalf by:</p><p style="margin-top:12px;font-weight:700;">${approval.directorName}</p><p style="font-size:9pt;color:#6b7280;">Director</p></div>`;
    }
    html += `</div>`;

    // Notes
    html += buildNotesSection(set, plResult, hasComp);

    // Detailed P&L
    if (fw.includeDetailedPL) {
      html += buildDetailedPL(pl, hasComp, pLabel);
    }
  }

  html += `<div class="footer">${company.name || ''}${company.companyNumber ? ' | Company No. ' + company.companyNumber : ''} | Accounts for the ${pLabel}</div>`;
  html += `</body></html>`;
  return html;
}

function buildDetailedPL(pl, hasComp, pLabel) {
  const l = pl.lines || {};
  const c = pl.comparatives?.priorYearLines || {};
  const n = v => Number(v) || 0;
  const cv = (v, pv) => hasComp ? pv : undefined;

  let html = `<div class="section"><h2>Detailed Profit and Loss Account</h2><p class="note-text" style="margin-bottom:8px;">For the ${pLabel} — not forming part of the statutory accounts</p><table>${sectionHeader('Detailed Profit and Loss', hasComp)}`;

  html += row('Turnover', n(l.turnover), cv(0, n(c.turnover)));
  html += row('Cost of sales', -n(l.costOfSales), cv(0, -n(c.costOfSales)), false, true);

  const grossProfit = n(l.turnover) - n(l.costOfSales);
  const cGrossProfit = n(c.turnover) - n(c.costOfSales);
  html += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Gross profit</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(grossProfit)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cGrossProfit)}</td>`:''}</tr>`;

  if (n(l.otherOperatingIncome)||n(c.otherOperatingIncome)) html += row('Other operating income', n(l.otherOperatingIncome), cv(0,n(c.otherOperatingIncome)), false, true);

  html += `<tr><td colspan="${hasComp?3:2}" style="padding:6px 8px;font-weight:700;color:#4c1d95;">Expenditure</td></tr>`;
  const expFields = [
    ['adminExpenses','Administrative expenses'],['distributionCosts','Distribution costs'],
    ['wages','Wages and salaries'],['rent','Rent'],['rates','Rates'],
    ['lightAndHeat','Light and heat'],['cleaning','Cleaning'],['serviceCharges','Service charges'],
    ['motor','Motor expenses'],['travel','Travel and subsistence'],['advertising','Advertising and marketing'],
    ['computerSoftware','Computer and software'],['subscriptions','Subscriptions'],['insurance','Insurance'],
    ['repairsMaintenance','Repairs and maintenance'],['sundryExpenses','Sundry expenses'],
    ['supportAdminCosts','Support and admin costs'],['donations','Donations'],
    ['hirePlantMachinery','Hire of plant and machinery'],['telephoneInternet','Telephone and internet'],
    ['printingPostage','Printing and postage'],['professionalFees','Professional fees'],
    ['accountancyFees','Accountancy fees'],['consultancyFees','Consultancy fees'],
    ['legalFees','Legal fees'],['otherExpenses','Other expenses'],
    ['depreciation','Depreciation'],['amortisation','Amortisation'],
  ];
  for (const [f, label] of expFields) {
    if (n(l[f])||n(c[f])) html += row(label, -n(l[f]), cv(0,-n(c[f])), false, true);
  }

  const opEx = expFields.reduce((s,[f]) => s + n(l[f]), 0);
  const cOpEx = expFields.reduce((s,[f]) => s + n(c[f]), 0);
  const opProfit = grossProfit + n(l.otherOperatingIncome) - opEx;
  const cOpProfit = cGrossProfit + n(c.otherOperatingIncome) - cOpEx;
  html += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Operating profit</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(opProfit)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cOpProfit)}</td>`:''}</tr>`;

  if (n(l.interestReceivable)||n(c.interestReceivable)) html += row('Interest receivable', n(l.interestReceivable), cv(0,n(c.interestReceivable)), false, true);
  if (n(l.interestPayable)+n(l.financeCharges)+n(l.bankCharges)) html += row('Interest payable and finance charges', -(n(l.interestPayable)+n(l.financeCharges)+n(l.bankCharges)), cv(0,-(n(c.interestPayable)+n(c.financeCharges)+n(c.bankCharges))), false, true);

  const pbt = opProfit + n(l.interestReceivable) - n(l.interestPayable) - n(l.financeCharges) - n(l.bankCharges);
  const cPbt = cOpProfit + n(c.interestReceivable) - n(c.interestPayable) - n(c.financeCharges) - n(c.bankCharges);
  html += `<tr class="subtotal-row"><td style="padding:4px 8px;font-weight:600;">Profit before taxation</td><td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(pbt)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;font-weight:600;">${fmt(cPbt)}</td>`:''}</tr>`;
  if (n(l.taxCharge)||n(c.taxCharge)) html += row('Tax on profit', -n(l.taxCharge), cv(0,-n(c.taxCharge)), false, true);

  const pat = pbt - n(l.taxCharge);
  const cPat = cPbt - n(c.taxCharge);
  html += `<tr class="total-row"><td style="padding:4px 8px;">Profit for the year</td><td style="text-align:right;padding:4px 8px;">${fmt(pat)}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;">${fmt(cPat)}</td>`:''}</tr>`;
  if (n(l.dividendsDeclared)||n(c.dividendsDeclared)) html += row('Dividends declared', -n(l.dividendsDeclared), cv(0,-n(c.dividendsDeclared)), false, true);
  html += `<tr class="total-row"><td style="padding:4px 8px;">Retained profit for the year</td><td style="text-align:right;padding:4px 8px;">${fmt(pat - n(l.dividendsDeclared))}</td>${hasComp?`<td style="text-align:right;padding:4px 8px;">${fmt(cPat - n(c.dividendsDeclared))}</td>`:''}</tr>`;
  html += `</table></div>`;
  return html;
}

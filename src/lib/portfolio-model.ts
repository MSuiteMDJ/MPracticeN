export interface Portfolio {
  id: string;
  code: number;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreatePortfolioInput {
  code: number;
  name: string;
  description?: string;
  isDefault?: boolean;
}

interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

const PORTFOLIO_STORAGE_KEY = 'm_practice_portfolios_v1';
const PORTFOLIO_DATA_UPDATED_EVENT = 'm-practice-portfolio-data-updated';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emitPortfolioDataUpdate(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(PORTFOLIO_DATA_UPDATED_EVENT));
}

function buildDefaultPortfolio(): Portfolio {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    code: 1,
    name: 'Main',
    description: 'Default client portfolio',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizePortfolios(portfolios: Portfolio[]): Portfolio[] {
  const normalized: Portfolio[] = [];
  const seenIds = new Set<string>();
  const seenCodes = new Set<number>();

  portfolios.forEach((portfolio) => {
    if (!portfolio || typeof portfolio !== 'object') return;
    if (typeof portfolio.id !== 'string' || !portfolio.id.trim()) return;
    if (!Number.isInteger(portfolio.code) || portfolio.code <= 0) return;
    if (seenIds.has(portfolio.id) || seenCodes.has(portfolio.code)) return;
    seenIds.add(portfolio.id);
    seenCodes.add(portfolio.code);
    normalized.push({
      ...portfolio,
      id: portfolio.id.trim(),
      name: String(portfolio.name || '').trim() || `Portfolio ${portfolio.code}`,
      description: portfolio.description?.trim() || undefined,
      isDefault: Boolean(portfolio.isDefault),
      createdAt: portfolio.createdAt || new Date().toISOString(),
      updatedAt: portfolio.updatedAt || new Date().toISOString(),
    });
  });

  let hasCodeOne = normalized.some((portfolio) => portfolio.code === 1);
  if (!hasCodeOne) {
    normalized.unshift(buildDefaultPortfolio());
    hasCodeOne = true;
  }

  const defaultCount = normalized.filter((portfolio) => portfolio.isDefault).length;
  if (defaultCount === 0) {
    const codeOne = normalized.find((portfolio) => portfolio.code === 1);
    if (codeOne) {
      codeOne.isDefault = true;
    } else if (normalized[0]) {
      normalized[0].isDefault = true;
    }
  } else if (defaultCount > 1) {
    let seenDefault = false;
    normalized.forEach((portfolio) => {
      if (!portfolio.isDefault) return;
      if (!seenDefault) {
        seenDefault = true;
        return;
      }
      portfolio.isDefault = false;
    });
  }

  return normalized.sort((a, b) => a.code - b.code);
}

function readPortfolios(): Portfolio[] {
  if (!isBrowser()) return [buildDefaultPortfolio()];
  const raw = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
  if (!raw) return [buildDefaultPortfolio()];
  try {
    const parsed = JSON.parse(raw) as Portfolio[];
    return normalizePortfolios(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [buildDefaultPortfolio()];
  }
}

function writePortfolios(portfolios: Portfolio[], emit: boolean = true): void {
  if (!isBrowser()) return;
  const normalized = normalizePortfolios(portfolios);
  window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(normalized));
  if (emit) emitPortfolioDataUpdate();
}

export function getPortfolios(): Portfolio[] {
  const portfolios = readPortfolios();
  writePortfolios(portfolios, false);
  return clone(portfolios);
}

export function getDefaultPortfolio(): Portfolio {
  const portfolios = getPortfolios();
  return clone(
    portfolios.find((portfolio) => portfolio.isDefault) ||
      portfolios.find((portfolio) => portfolio.code === 1) ||
      portfolios[0]
  );
}

export function createPortfolio(input: CreatePortfolioInput): Portfolio {
  const code = Number(input.code);
  const name = String(input.name || '').trim();
  const description = input.description?.trim() || undefined;
  const isDefault = Boolean(input.isDefault);
  if (!Number.isInteger(code) || code <= 0) {
    throw new Error('Portfolio code must be a positive whole number.');
  }
  if (code === 1) {
    throw new Error('Portfolio code 1 is reserved for the default portfolio.');
  }
  if (!name) {
    throw new Error('Portfolio name is required.');
  }

  const portfolios = readPortfolios();
  if (portfolios.some((portfolio) => portfolio.code === code)) {
    throw new Error(`Portfolio code ${code} already exists.`);
  }

  const now = new Date().toISOString();
  const created: Portfolio = {
    id: crypto.randomUUID(),
    code,
    name,
    description,
    isDefault,
    createdAt: now,
    updatedAt: now,
  };

  const next = portfolios.map((portfolio) =>
    isDefault ? { ...portfolio, isDefault: false, updatedAt: now } : portfolio
  );
  next.push(created);
  writePortfolios(next);
  return created;
}

export function updatePortfolio(id: string, patch: UpdatePortfolioInput): Portfolio {
  const portfolioId = String(id || '').trim();
  if (!portfolioId) {
    throw new Error('Portfolio id is required.');
  }

  const portfolios = readPortfolios();
  const index = portfolios.findIndex((portfolio) => portfolio.id === portfolioId);
  if (index < 0) {
    throw new Error('Portfolio not found.');
  }

  const target = portfolios[index];
  const now = new Date().toISOString();
  const nextName = patch.name === undefined ? target.name : String(patch.name).trim();
  if (!nextName) {
    throw new Error('Portfolio name is required.');
  }

  if (patch.isDefault === false && target.isDefault) {
    throw new Error('Assign another default portfolio before removing default status.');
  }

  const next = portfolios.map((portfolio, rowIndex) => {
    if (rowIndex !== index) {
      if (patch.isDefault) {
        return { ...portfolio, isDefault: false, updatedAt: now };
      }
      return portfolio;
    }
    return {
      ...portfolio,
      name: nextName,
      description:
        patch.description === undefined ? portfolio.description : patch.description?.trim() || undefined,
      isDefault: patch.isDefault === undefined ? portfolio.isDefault : patch.isDefault,
      updatedAt: now,
    };
  });

  writePortfolios(next);
  const updated = next.find((portfolio) => portfolio.id === portfolioId);
  if (!updated) {
    throw new Error('Portfolio not found after update.');
  }
  return clone(updated);
}

export function deletePortfolio(id: string, linkedClients: number = 0): void {
  const portfolioId = String(id || '').trim();
  if (!portfolioId) {
    throw new Error('Portfolio id is required.');
  }

  const portfolios = readPortfolios();
  const target = portfolios.find((portfolio) => portfolio.id === portfolioId);
  if (!target) {
    throw new Error('Portfolio not found.');
  }

  if (target.code === 1) {
    throw new Error('Portfolio code 1 cannot be deleted.');
  }
  if (target.isDefault) {
    throw new Error('Default portfolio cannot be deleted.');
  }
  if (portfolios.length <= 1) {
    throw new Error('At least one portfolio is required.');
  }
  if (linkedClients > 0) {
    throw new Error('Cannot delete a portfolio that has linked clients.');
  }

  writePortfolios(portfolios.filter((portfolio) => portfolio.id !== portfolioId));
}

export function subscribeToPortfolioUpdates(callback: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const listener = () => callback();
  window.addEventListener(PORTFOLIO_DATA_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PORTFOLIO_DATA_UPDATED_EVENT, listener);
}

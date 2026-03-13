import { Router } from 'express';
import {
  saveCompaniesHouseCredential,
  getCompaniesHouseCredential,
  deleteCompaniesHouseCredential,
} from '../services/companies-house-credentials.js';

const router = Router();

const COMPANIES_HOUSE_API_BASE = 'https://api.company-information.service.gov.uk';
const COMPANIES_HOUSE_WEB_BASE = 'https://find-and-update.company-information.service.gov.uk';

function getRequestApiKey(req) {
  const requestKey = (req.get('x-companies-house-api-key') || req.get('x-companies-house-key') || '').trim();
  return requestKey || '';
}

function maskApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}...${key.slice(-2)}`;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function getResolvedApiKey(req) {
  const requestKey = getRequestApiKey(req);
  if (requestKey) return { apiKey: requestKey, source: 'request' };

  const userId = req.userId || req.user?.id;
  if (userId) {
    const userCredential = getCompaniesHouseCredential(userId);
    if (userCredential?.apiKey) {
      return { apiKey: userCredential.apiKey, source: 'user' };
    }
  }

  const envKey = (process.env.COMPANIES_HOUSE_API_KEY || process.env.CH_API_KEY || '').trim();
  if (envKey) return { apiKey: envKey, source: 'environment' };

  return { apiKey: '', source: 'none' };
}

function buildBasicAuthHeader(apiKey) {
  const token = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${token}`;
}

function mapAddress(address = {}) {
  const addressParts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
    address.country,
  ].filter(Boolean);

  return {
    line1: [address.premises, address.address_line_1].filter(Boolean).join(' ').trim(),
    line2: address.address_line_2 || '',
    city: address.locality || '',
    region: address.region || '',
    postcode: address.postal_code || '',
    country: address.country || 'United Kingdom',
    fullAddress: addressParts.join(', '),
  };
}

function parseCHErrorDetails(payload, fallbackText) {
  if (payload && typeof payload === 'object') return payload;
  if (fallbackText) return fallbackText;
  return undefined;
}

async function companiesHouseGetJson(apiKey, path, params = {}) {
  const url = new URL(`${COMPANIES_HOUSE_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: buildBasicAuthHeader(apiKey),
      Accept: 'application/json',
    },
  });

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = new Error(`Companies House request failed (${response.status})`);
    error.status = response.status;
    error.details = parseCHErrorDetails(payload, raw);
    throw error;
  }

  return payload || {};
}

function isTruthy(input) {
  return String(input || '').toLowerCase() === 'true';
}

function formatDisplayName(rawName = '') {
  const normalized = String(rawName || '').trim();
  if (!normalized) return '';
  if (!normalized.includes(',')) return normalized;

  const commaIndex = normalized.indexOf(',');
  const lastName = normalized.slice(0, commaIndex).trim();
  const givenNames = normalized.slice(commaIndex + 1).trim();

  return [givenNames, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function formatPartialDate(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const asDate = new Date(value);
    if (Number.isNaN(asDate.getTime())) return value;
    return asDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (typeof value === 'object') {
    const year = value.year ? String(value.year) : '';
    const monthNum = Number(value.month || 0);
    if (!year) return '';
    if (!monthNum || monthNum < 1 || monthNum > 12) return year;

    const monthName = new Date(Date.UTC(2000, monthNum - 1, 1)).toLocaleDateString('en-GB', {
      month: 'long',
      timeZone: 'UTC',
    });

    return `${monthName} ${year}`;
  }

  return String(value);
}

function normalizeNatureOfControl(natures = []) {
  if (!Array.isArray(natures)) return [];
  return natures
    .map((item) => String(item || '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractIdentityVerification(info = {}) {
  if (!info || typeof info !== 'object') {
    return { dueFrom: '', dueBy: '' };
  }

  const dueFrom =
    info.due_from ||
    info.due_on_from ||
    info.identity_verification_due_from ||
    info.verification_due_from ||
    '';

  const dueBy =
    info.due_by ||
    info.due_on ||
    info.identity_verification_due_by ||
    info.verification_due_by ||
    '';

  return {
    dueFrom: dueFrom ? String(dueFrom) : '',
    dueBy: dueBy ? String(dueBy) : '',
  };
}

function mapCompanyOverview(company = {}) {
  const address = mapAddress(company.registered_office_address || {});
  return {
    companyNumber: company.company_number || '',
    companyName: company.company_name || '',
    companyStatus: company.company_status || '',
    companyType: company.type || '',
    sicCodes: Array.isArray(company.sic_codes) ? company.sic_codes : [],
    dateOfCreation: company.date_of_creation || '',
    jurisdiction: company.jurisdiction || '',
    accounts: company.accounts || null,
    confirmationStatement: company.confirmation_statement || null,
    hasCharges: Boolean(company.has_charges),
    canFile: Boolean(company.can_file),
    hasInsolvencyHistory: Boolean(company.has_insolvency_history),
    ...address,
  };
}

function mapOfficer(officer = {}) {
  const identity = extractIdentityVerification(officer.identity_verification_details || {});
  return {
    name: officer.name || '',
    displayName: formatDisplayName(officer.name || ''),
    role: officer.officer_role || '',
    status: officer.resigned_on ? 'resigned' : 'active',
    dateOfBirth: formatPartialDate(officer.date_of_birth || null),
    appointedOn: officer.appointed_on || '',
    resignedOn: officer.resigned_on || '',
    nationality: officer.nationality || '',
    countryOfResidence: officer.country_of_residence || '',
    occupation: officer.occupation || '',
    identityVerificationDueFrom: identity.dueFrom,
    identityVerificationDueBy: identity.dueBy,
    address: mapAddress(officer.address || {}),
  };
}

function mapPscEntry(item = {}) {
  const identity = extractIdentityVerification(item.identity_verification_details || {});
  return {
    name: item.name || '',
    displayName: formatDisplayName(item.name || ''),
    status: item.ceased_on ? 'ceased' : 'active',
    kind: item.kind || '',
    dateOfBirth: formatPartialDate(item.date_of_birth || null),
    notifiedOn: item.notified_on || '',
    ceasedOn: item.ceased_on || '',
    nationality: item.nationality || '',
    countryOfResidence: item.country_of_residence || '',
    natureOfControl: normalizeNatureOfControl(item.natures_of_control || []),
    identityVerificationDueFrom: identity.dueFrom,
    identityVerificationDueBy: identity.dueBy,
    address: mapAddress(item.address || {}),
  };
}

function mapFilingHistoryItem(companyNumber, item = {}) {
  const metadataPath = item?.links?.document_metadata || '';
  const metadataUrl = metadataPath
    ? `${COMPANIES_HOUSE_API_BASE}${metadataPath.startsWith('/') ? metadataPath : `/${metadataPath}`}`
    : '';

  const transactionId = item.transaction_id || '';
  const companyFilingUrl = `${COMPANIES_HOUSE_WEB_BASE}/company/${companyNumber}/filing-history`;

  return {
    transactionId,
    date: item.date || '',
    category: item.category || '',
    type: item.type || '',
    description: item.description || '',
    pages: Number(item.pages || 0) || 0,
    actionDate: item.action_date || '',
    metadataUrl,
    filingUrl: transactionId ? `${companyFilingUrl}/${transactionId}` : companyFilingUrl,
  };
}

async function getCompaniesHouseCompany(apiKey, companyNumber) {
  return companiesHouseGetJson(apiKey, `/company/${encodeURIComponent(companyNumber)}`);
}

async function getCompaniesHouseOfficers(apiKey, companyNumber, itemsPerPage = 100) {
  return companiesHouseGetJson(apiKey, `/company/${encodeURIComponent(companyNumber)}/officers`, {
    items_per_page: itemsPerPage,
  });
}

async function getCompaniesHousePsc(apiKey, companyNumber, itemsPerPage = 100) {
  return companiesHouseGetJson(
    apiKey,
    `/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
    {
      items_per_page: itemsPerPage,
    }
  );
}

async function getCompaniesHouseFilingHistory(apiKey, companyNumber, { category = '', itemsPerPage = 50 } = {}) {
  return companiesHouseGetJson(apiKey, `/company/${encodeURIComponent(companyNumber)}/filing-history`, {
    category,
    items_per_page: itemsPerPage,
  });
}

async function getCompaniesHouseCharges(apiKey, companyNumber) {
  try {
    return await companiesHouseGetJson(apiKey, `/company/${encodeURIComponent(companyNumber)}/charges`);
  } catch (error) {
    if (error?.status === 404) {
      return { total_count: 0, part_satisfied_count: 0, satisfied_count: 0, items: [] };
    }
    throw error;
  }
}

function requireApiKeyOrRespond(req, res) {
  const { apiKey } = getResolvedApiKey(req);
  if (!apiKey) {
    res.status(503).json({
      success: false,
      message: 'Companies House API key not configured',
      hint: 'Set the key in Settings -> Companies House API or COMPANIES_HOUSE_API_KEY in backend environment.',
    });
    return null;
  }
  return apiKey;
}

/**
 * POST /companies-house/credentials
 */
router.post('/credentials', async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const apiKey = String(req.body?.api_key || '').trim();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'api_key is required',
      });
    }

    const saved = saveCompaniesHouseCredential(userId, apiKey);
    res.json({
      success: true,
      message: 'Companies House API key saved',
      credential: {
        key_masked: saved.key_masked,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /companies-house/credentials
 */
router.get('/credentials', async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const credential = getCompaniesHouseCredential(userId);
    if (credential) {
      return res.json({
        success: true,
        configured: true,
        source: 'user',
        credential: {
          key_masked: credential.key_masked,
          created_at: credential.created_at,
        },
      });
    }

    const envKey = (process.env.COMPANIES_HOUSE_API_KEY || process.env.CH_API_KEY || '').trim();
    if (envKey) {
      return res.json({
        success: true,
        configured: true,
        source: 'environment',
        credential: {
          key_masked: maskApiKey(envKey),
        },
      });
    }

    return res.json({
      success: true,
      configured: false,
      source: 'none',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /companies-house/credentials
 */
router.delete('/credentials', async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    deleteCompaniesHouseCredential(userId);
    return res.json({
      success: true,
      message: 'Companies House API key removed',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /companies-house/search?q=<query>&items_per_page=20
 */
router.get('/search', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const q = String(req.query.q || '').trim();
    const itemsPerPage = Math.min(Math.max(parseInt(String(req.query.items_per_page || '20'), 10), 1), 50);

    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters.',
      });
    }

    const payload = await companiesHouseGetJson(apiKey, '/search/companies', {
      q,
      items_per_page: itemsPerPage,
    });

    const items = Array.isArray(payload.items) ? payload.items : [];

    const results = items.map((item) => ({
      companyNumber: item.company_number || '',
      companyName: item.title || '',
      companyStatus: item.company_status || '',
      companyType: item.company_type || '',
      dateOfCreation: item.date_of_creation || '',
      kind: item.kind || '',
      snippet: item.snippet || '',
      addressSnippet: item.address_snippet || '',
      ...mapAddress(item.address),
    }));

    res.json({
      success: true,
      query: q,
      totalResults: payload.total_results || results.length,
      itemsPerPage,
      results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /companies-house/company/:companyNumber
 */
router.get('/company/:companyNumber', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const companyNumber = String(req.params.companyNumber || '').trim();
    if (!companyNumber) {
      return res.status(400).json({
        success: false,
        message: 'Company number is required.',
      });
    }

    const company = await getCompaniesHouseCompany(apiKey, companyNumber);

    res.json({
      success: true,
      company: mapCompanyOverview(company),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: 'Failed to fetch company profile',
        details: error.details || `HTTP ${error.status}`,
      });
    }
    next(error);
  }
});

/**
 * GET /companies-house/company/:companyNumber/profile
 */
router.get('/company/:companyNumber/profile', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const companyNumber = String(req.params.companyNumber || '').trim();
    if (!companyNumber) {
      return res.status(400).json({
        success: false,
        message: 'Company number is required.',
      });
    }

    const filingCategory = String(req.query.category || '').trim();
    const filingItemsPerPage = Math.min(
      Math.max(parseInt(String(req.query.items_per_page || '50'), 10), 1),
      100
    );

    const [companyRaw, officersResult, pscResult, filingResult, chargesResult] = await Promise.all([
      getCompaniesHouseCompany(apiKey, companyNumber),
      getCompaniesHouseOfficers(apiKey, companyNumber, 100),
      getCompaniesHousePsc(apiKey, companyNumber, 100),
      getCompaniesHouseFilingHistory(apiKey, companyNumber, {
        category: filingCategory,
        itemsPerPage: filingItemsPerPage,
      }),
      getCompaniesHouseCharges(apiKey, companyNumber),
    ]);

    const officersRaw = Array.isArray(officersResult.items) ? officersResult.items : [];
    const officers = officersRaw.map(mapOfficer);
    const activeOfficers = officers.filter((item) => item.status === 'active');

    const pscRaw = Array.isArray(pscResult.items) ? pscResult.items : [];
    const pscItems = pscRaw.map(mapPscEntry);
    const activePsc = pscItems.filter((item) => item.status === 'active');

    const filingsRaw = Array.isArray(filingResult.items) ? filingResult.items : [];
    const filingItems = filingsRaw.map((entry) => mapFilingHistoryItem(companyNumber, entry));

    const chargesItems = Array.isArray(chargesResult.items) ? chargesResult.items : [];

    res.json({
      success: true,
      profile: {
        company: mapCompanyOverview(companyRaw),
        compliance: {
          accounts: companyRaw.accounts || null,
          confirmationStatement: companyRaw.confirmation_statement || null,
        },
        officers: {
          total: officers.length,
          active: activeOfficers.length,
          resigned: officers.length - activeOfficers.length,
          items: officers,
        },
        psc: {
          total: pscItems.length,
          active: activePsc.length,
          ceased: pscItems.length - activePsc.length,
          items: pscItems,
        },
        charges: {
          total: Number(chargesResult.total_count || chargesItems.length) || 0,
          satisfiedCount: Number(chargesResult.satisfied_count || 0) || 0,
          partSatisfiedCount: Number(chargesResult.part_satisfied_count || 0) || 0,
          items: chargesItems,
        },
        filingHistory: {
          selectedCategory: filingCategory || '',
          total: Number(filingResult.total_count || filingItems.length) || 0,
          startIndex: Number(filingResult.start_index || 0) || 0,
          itemsPerPage: Number(filingResult.items_per_page || filingItemsPerPage) || filingItemsPerPage,
          items: filingItems,
        },
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: 'Failed to fetch full company profile',
        details: error.details || `HTTP ${error.status}`,
      });
    }
    next(error);
  }
});

/**
 * GET /companies-house/company/:companyNumber/officers
 */
router.get('/company/:companyNumber/officers', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const companyNumber = String(req.params.companyNumber || '').trim();
    if (!companyNumber) {
      return res.status(400).json({ success: false, message: 'Company number is required.' });
    }

    const currentOnly = isTruthy(req.query.current_only);
    const officersResult = await getCompaniesHouseOfficers(apiKey, companyNumber, 100);
    const officersRaw = Array.isArray(officersResult.items) ? officersResult.items : [];
    const officers = officersRaw.map(mapOfficer);
    const filtered = currentOnly ? officers.filter((item) => item.status === 'active') : officers;

    return res.json({
      success: true,
      officers: {
        total: officers.length,
        active: officers.filter((item) => item.status === 'active').length,
        resigned: officers.filter((item) => item.status === 'resigned').length,
        items: filtered,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: 'Failed to fetch officers',
        details: error.details || `HTTP ${error.status}`,
      });
    }
    next(error);
  }
});

/**
 * GET /companies-house/company/:companyNumber/psc
 */
router.get('/company/:companyNumber/psc', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const companyNumber = String(req.params.companyNumber || '').trim();
    if (!companyNumber) {
      return res.status(400).json({ success: false, message: 'Company number is required.' });
    }

    const activeOnly = isTruthy(req.query.active_only);
    const pscResult = await getCompaniesHousePsc(apiKey, companyNumber, 100);
    const items = (Array.isArray(pscResult.items) ? pscResult.items : []).map(mapPscEntry);
    const filtered = activeOnly ? items.filter((item) => item.status === 'active') : items;

    return res.json({
      success: true,
      psc: {
        total: items.length,
        active: items.filter((item) => item.status === 'active').length,
        ceased: items.filter((item) => item.status === 'ceased').length,
        items: filtered,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: 'Failed to fetch PSC entries',
        details: error.details || `HTTP ${error.status}`,
      });
    }
    next(error);
  }
});

/**
 * GET /companies-house/company/:companyNumber/filing-history?category=accounts
 */
router.get('/company/:companyNumber/filing-history', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const companyNumber = String(req.params.companyNumber || '').trim();
    if (!companyNumber) {
      return res.status(400).json({ success: false, message: 'Company number is required.' });
    }

    const category = String(req.query.category || '').trim();
    const itemsPerPage = Math.min(Math.max(parseInt(String(req.query.items_per_page || '50'), 10), 1), 100);

    const filingResult = await getCompaniesHouseFilingHistory(apiKey, companyNumber, {
      category,
      itemsPerPage,
    });

    const items = (Array.isArray(filingResult.items) ? filingResult.items : []).map((entry) =>
      mapFilingHistoryItem(companyNumber, entry)
    );

    return res.json({
      success: true,
      filingHistory: {
        selectedCategory: category,
        total: Number(filingResult.total_count || items.length) || 0,
        startIndex: Number(filingResult.start_index || 0) || 0,
        itemsPerPage: Number(filingResult.items_per_page || itemsPerPage) || itemsPerPage,
        items,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: 'Failed to fetch filing history',
        details: error.details || `HTTP ${error.status}`,
      });
    }
    next(error);
  }
});

/**
 * GET /companies-house/company/:companyNumber/charges
 */
router.get('/company/:companyNumber/charges', async (req, res, next) => {
  try {
    const apiKey = requireApiKeyOrRespond(req, res);
    if (!apiKey) return;

    const companyNumber = String(req.params.companyNumber || '').trim();
    if (!companyNumber) {
      return res.status(400).json({ success: false, message: 'Company number is required.' });
    }

    const chargesResult = await getCompaniesHouseCharges(apiKey, companyNumber);

    return res.json({
      success: true,
      charges: {
        total: Number(chargesResult.total_count || 0) || 0,
        satisfiedCount: Number(chargesResult.satisfied_count || 0) || 0,
        partSatisfiedCount: Number(chargesResult.part_satisfied_count || 0) || 0,
        items: Array.isArray(chargesResult.items) ? chargesResult.items : [],
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        message: 'Failed to fetch charges',
        details: error.details || `HTTP ${error.status}`,
      });
    }
    next(error);
  }
});

export default router;

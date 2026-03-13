import express from 'express';
import { getAuthDb, queryAuth } from '../config/auth-database.js';
import {
  loadEmailSettings,
  sanitiseEmailSettingsForResponse,
  sendTestEmail,
  validateEmailSettings,
} from '../services/email-service.js';

const router = express.Router();

function loadCompanySettings(db) {
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function saveCompanySetting(db, key, value) {
  db.prepare(
    `INSERT INTO company_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, value ?? '');
}

function boolToSetting(value) {
  return value ? 'true' : 'false';
}

router.get('/company', async (req, res) => {
  try {
    const db = req.tenantDb;
    const settings = loadCompanySettings(db);

    res.json({
      success: true,
      settings: {
        company_name: settings.company_name || '',
        eori_number: settings.eori_number || '',
        vat_number: settings.vat_number || '',
        company_email: settings.company_email || '',
        company_address: settings.company_address || '',
        company_phone: settings.company_phone || '',
        bank_name: settings.bank_name || '',
        account_name: settings.account_name || '',
        account_number: settings.account_number || '',
        sort_code: settings.sort_code || '',
        iban: settings.iban || '',
        swift: settings.swift || '',
      },
    });
  } catch (error) {
    console.error('Failed to load company settings', error);
    res.status(500).json({ error: 'Failed to load company settings' });
  }
});

router.put('/company', async (req, res) => {
  try {
    const db = req.tenantDb;
    const payload = {
      company_name: String(req.body?.company_name || '').trim(),
      eori_number: String(req.body?.eori_number || '').trim(),
      vat_number: String(req.body?.vat_number || '').trim(),
      company_email: String(req.body?.company_email || '').trim(),
      company_address: String(req.body?.company_address || '').trim(),
      company_phone: String(req.body?.company_phone || '').trim(),
      bank_name: String(req.body?.bank_name || '').trim(),
      account_name: String(req.body?.account_name || '').trim(),
      account_number: String(req.body?.account_number || '').trim(),
      sort_code: String(req.body?.sort_code || '').trim(),
      iban: String(req.body?.iban || '').trim(),
      swift: String(req.body?.swift || '').trim(),
    };

    for (const [key, value] of Object.entries(payload)) {
      saveCompanySetting(db, key, value);
    }

    if (payload.company_name && req.user?.company_id) {
      const { useSQLite } = getAuthDb();
      const sql = useSQLite
        ? 'UPDATE companies SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE companies SET name = $1, updated_at = NOW() WHERE id = $2';
      await queryAuth(sql, [payload.company_name, req.user.company_id]);
    }

    res.json({ success: true, settings: payload });
  } catch (error) {
    console.error('Failed to save company settings', error);
    res.status(500).json({ error: 'Failed to save company settings' });
  }
});

router.get('/email', async (req, res) => {
  try {
    const db = req.tenantDb;
    const settings = loadCompanySettings(db);

    res.json({
      success: true,
      settings: sanitiseEmailSettingsForResponse(settings),
    });
  } catch (error) {
    console.error('Failed to load email settings', error);
    res.status(500).json({ error: 'Failed to load email settings' });
  }
});

router.put('/email', async (req, res) => {
  try {
    const db = req.tenantDb;
    const existing = loadCompanySettings(db);
    const nextPassword = typeof req.body?.email_smtp_password === 'string'
      ? req.body.email_smtp_password.trim()
      : '';

    const payload = {
      email_provider: String(req.body?.email_provider || 'smtp').trim() || 'smtp',
      email_enabled: boolToSetting(Boolean(req.body?.email_enabled)),
      email_from_name: String(req.body?.email_from_name || '').trim(),
      email_from_address: String(req.body?.email_from_address || '').trim(),
      email_reply_to: String(req.body?.email_reply_to || '').trim(),
      email_smtp_host: String(req.body?.email_smtp_host || '').trim(),
      email_smtp_port: String(req.body?.email_smtp_port || '587').trim() || '587',
      email_smtp_username: String(req.body?.email_smtp_username || '').trim(),
      email_smtp_password: req.body?.clear_email_smtp_password
        ? ''
        : nextPassword || existing.email_smtp_password || '',
      email_smtp_secure: boolToSetting(Boolean(req.body?.email_smtp_secure)),
    };

    for (const [key, value] of Object.entries(payload)) {
      saveCompanySetting(db, key, value);
    }

    res.json({
      success: true,
      settings: sanitiseEmailSettingsForResponse(loadCompanySettings(db)),
    });
  } catch (error) {
    console.error('Failed to save email settings', error);
    res.status(500).json({ error: 'Failed to save email settings' });
  }
});

router.post('/email/test', async (req, res) => {
  try {
    const db = req.tenantDb;
    const companySettings = loadCompanySettings(db);
    const emailSettings = loadEmailSettings(companySettings);
    const validation = validateEmailSettings(emailSettings);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Email settings are incomplete',
        missing_fields: validation.missing,
      });
    }

    const recipient = String(req.body?.recipient || '').trim() || req.user?.email || emailSettings.email_from_address;
    if (!recipient) {
      return res.status(400).json({ error: 'A test recipient is required' });
    }

    const requestedBy = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || req.user?.email || 'Practice user';
    const practiceName = companySettings.company_name || emailSettings.email_from_name || 'Your Practice';
    const result = await sendTestEmail(emailSettings, {
      to: recipient,
      practiceName,
      requestedBy,
    });

    res.json({
      success: true,
      recipient,
      message_id: result.messageId,
    });
  } catch (error) {
    console.error('Failed to send test email', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send test email',
    });
  }
});

export default router;

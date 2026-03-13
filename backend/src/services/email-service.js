import nodemailer from 'nodemailer';

export function loadEmailSettings(values = {}) {
  return {
    email_provider: values.email_provider || 'smtp',
    email_enabled: values.email_enabled === 'true',
    email_from_name: values.email_from_name || '',
    email_from_address: values.email_from_address || '',
    email_reply_to: values.email_reply_to || '',
    email_smtp_host: values.email_smtp_host || '',
    email_smtp_port: values.email_smtp_port || '587',
    email_smtp_username: values.email_smtp_username || '',
    email_smtp_password: values.email_smtp_password || '',
    email_smtp_secure: values.email_smtp_secure === 'true',
  };
}

export function sanitiseEmailSettingsForResponse(values = {}) {
  const settings = loadEmailSettings(values);
  return {
    ...settings,
    email_smtp_password: '',
    email_smtp_password_set: Boolean(settings.email_smtp_password),
  };
}

export function validateEmailSettings(settings) {
  const missing = [];

  if (!settings.email_enabled) {
    missing.push('email_enabled');
  }
  if (!settings.email_from_name) {
    missing.push('email_from_name');
  }
  if (!settings.email_from_address) {
    missing.push('email_from_address');
  }
  if (!settings.email_smtp_host) {
    missing.push('email_smtp_host');
  }
  if (!settings.email_smtp_port) {
    missing.push('email_smtp_port');
  }
  if (!settings.email_smtp_username) {
    missing.push('email_smtp_username');
  }
  if (!settings.email_smtp_password) {
    missing.push('email_smtp_password');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

function buildTransport(settings) {
  return nodemailer.createTransport({
    host: settings.email_smtp_host,
    port: Number(settings.email_smtp_port || 587),
    secure: settings.email_smtp_secure,
    auth: {
      user: settings.email_smtp_username,
      pass: settings.email_smtp_password,
    },
  });
}

export async function sendEmail(settings, message) {
  const transport = buildTransport(settings);
  await transport.verify();

  const info = await transport.sendMail({
    from: `"${settings.email_from_name}" <${settings.email_from_address}>`,
    to: message.to,
    cc: message.cc || undefined,
    bcc: message.bcc || undefined,
    replyTo: message.replyTo || settings.email_reply_to || undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
  });

  return {
    messageId: info.messageId || '',
  };
}

export async function sendTestEmail(settings, options = {}) {
  const to = options.to;
  const practiceName = options.practiceName || settings.email_from_name || 'Your Practice';
  const requestedBy = options.requestedBy || 'Practice user';
  const sentAt = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return sendEmail(settings, {
    to,
    subject: `${practiceName} email settings test`,
    text: [
      `This is a test email from ${practiceName}.`,
      '',
      `Requested by: ${requestedBy}`,
      `Sent at: ${sentAt}`,
      '',
      'Your SMTP settings are working correctly.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 16px;">${practiceName} email settings test</h2>
        <p style="margin: 0 0 12px;">This is a test email from your practice workspace.</p>
        <table style="border-collapse: collapse; margin: 0 0 16px;">
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: 700;">Requested by</td>
            <td style="padding: 6px 0;">${requestedBy}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: 700;">Sent at</td>
            <td style="padding: 6px 0;">${sentAt}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: 700;">From</td>
            <td style="padding: 6px 0;">${settings.email_from_address}</td>
          </tr>
        </table>
        <p style="margin: 0;">Your SMTP settings are working correctly.</p>
      </div>
    `,
  });
}

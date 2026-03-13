import { chromium } from 'playwright-core';

const BROWSER_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

function resolveBrowserExecutable() {
  const match = BROWSER_CANDIDATES.find((candidate) => candidate && candidate.trim().length > 0);
  if (!match) {
    throw new Error('No Chrome-compatible browser executable is configured for PDF generation');
  }
  return match;
}

function injectBaseHref(html, baseUrl) {
  if (!baseUrl || /<base\s/i.test(html)) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`);
  }

  return `<base href="${baseUrl}">${html}`;
}

export async function renderHtmlToPdfBuffer(html, options = {}) {
  const executablePath = resolveBrowserExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const preparedHtml = injectBaseHref(html, options.baseUrl || process.env.FRONTEND_URL || 'http://localhost:3002');
    await page.setContent(preparedHtml, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'screen' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '16mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm',
      },
    });
  } finally {
    await browser.close();
  }
}

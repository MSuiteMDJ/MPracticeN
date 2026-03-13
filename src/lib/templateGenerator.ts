/**
 * Universal Template Generator Engine
 *
 * Loads HTML templates, injects headers/footers, and replaces placeholders
 * with real practice/client data to generate print-ready documents.
 */

import { getPracticeTemplateSampleData } from '@/lib/practice-template-library';

const NO_DATA = 'No Data';

export interface TemplateData {
  document_title?: string;
  'claim.reference'?: string;
  'claim.mrn'?: string;
  'claim.acceptance_date'?: string;
  'claim.total_claim_amount'?: string;
  'claim.reason'?: string;
  'trader.name'?: string;
  'trader.eori'?: string;
  'trader.legal_entity_type'?: string;
  'trader.address'?: string;
  'trader.postcode'?: string;
  'trader.country'?: string;
  'agent.company'?: string;
  'agent.contact'?: string;
  'agent.eori'?: string;
  'agent.address'?: string;
  today?: string;
  year?: string | number;
  [key: string]: string | number | undefined;
}

/**
 * Clean and format value to avoid duplicates
 */
function cleanValue(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return NO_DATA;
  }

  let cleaned = String(value);
  if (!cleaned.trim()) {
    return NO_DATA;
  }

  // Remove leading currency symbols if present (we'll let templates handle formatting)
  // This prevents ££ when template has £{{amount}}
  cleaned = cleaned.replace(/^[£$€]/, '');

  return cleaned.trim() || NO_DATA;
}

/**
 * Replace all placeholders in template with actual data
 */
function replacePlaceholders(html: string, data: TemplateData): string {
  let result = html;

  // Replace each placeholder
  Object.entries(data).forEach(([key, value]) => {
    const cleanedValue = cleanValue(value);
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, cleanedValue);
  });

  // Remove any remaining unreplaced placeholders
  result = result.replace(/{{[^}]+}}/g, NO_DATA);

  // Fix common duplication issues
  result = result.replace(/££/g, '£'); // Remove duplicate pound signs
  result = result.replace(/\$\$/g, '$'); // Remove duplicate dollar signs
  result = result.replace(/€€/g, '€'); // Remove duplicate euro signs

  return result;
}

/**
 * Load template from file
 */
async function loadTemplate(templateFile: string): Promise<string> {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const templatePath = `${baseUrl}template_library/${templateFile}`;
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${templateFile}`);
    }
    const html = await response.text();

    // Templates now have built-in headers/footers with M Practice branding
    // Just return the template as-is
    return html;
  } catch (error) {
    console.error('Error loading template:', error);
    throw error;
  }
}

/**
 * Generate a complete document from template
 *
 * @param templateFile - Name of the template file (e.g., 'evidence_checklist.html')
 * @param data - Data to inject into the template
 * @returns Complete HTML document ready for display/print
 */
function prefixAssetPaths(html: string): string {
  if (typeof window === 'undefined') return html;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const origin = window.location.origin;
  
  return html.replace(
    /(src|href)=["'](?!https?:|data:|mailto:|#)([^"']+)["']/gi,
    (_match, attr, rawPath) => {
      let path = rawPath.trim();
      
      // Skip if already has base URL
      if (path.startsWith(baseUrl)) {
        return `${attr}="${origin}${path}"`;
      }
      
      // Add base URL prefix
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      
      // Ensure base URL is included
      const fullPath = baseUrl === '/' ? path : `${baseUrl}${path}`;
      return `${attr}="${origin}${fullPath}"`;
    }
  );
}

export async function generateDocument(templateFile: string, data: TemplateData): Promise<string> {
  let html = await loadTemplate(templateFile);

  const year = data.year || new Date().getFullYear();
  const today = data.today || new Date().toLocaleDateString('en-GB');
  const baseUrl = import.meta.env.BASE_URL || '/';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const absoluteAsset = (path: string) => {
    if (!origin) return path;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = baseUrl === '/' ? normalizedPath : `${baseUrl}${normalizedPath.slice(1)}`;
    return `${origin}${fullPath}`;
  };

  const fullData: TemplateData = {
    ...data,
    today,
    year: String(year),
    logo_purple_url: absoluteAsset('/M_Logo_PurpleD.png'),
    logo_black_url: absoluteAsset('/M_Logo_Black.png'),
  };

  html = replacePlaceholders(html, fullData);
  html = prefixAssetPaths(html);

  return html;
}

/**
 * Open generated document in new window for viewing/printing
 */
export function openGeneratedDocument(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');
  if (!newWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked. Allow popups to preview generated documents.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Download generated document as HTML file
 */
export function downloadDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get sample data for testing templates
 */
export function getSampleData(): TemplateData {
  return getPracticeTemplateSampleData();
}

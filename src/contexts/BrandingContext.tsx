// Minimal BrandingContext shim for the copied MP components.
// Exports a DEFAULT_LOGO (data URL) and a useBranding hook.

export const DEFAULT_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <rect width='100%' height='100%' fill='none' />
    <circle cx='32' cy='32' r='28' fill='%23c18f1c' />
    <text x='50%' y='52%' font-size='18' text-anchor='middle' fill='%23000' font-family='Arial,Helvetica,sans-serif' font-weight='700'>MP</text>
  </svg>
`);

export function useBranding() {
  return { resolvedLogo: DEFAULT_LOGO };
}

export default useBranding;

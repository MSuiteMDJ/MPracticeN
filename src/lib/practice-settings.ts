type PracticeAddressInput = {
  address?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
  country?: string;
};

function cleanPart(value?: string): string {
  return String(value || '').trim();
}

function normalizePart(value?: string): string {
  return cleanPart(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function lineContainsPart(line: string, part?: string): boolean {
  const normalizedLine = normalizePart(line);
  const normalizedPart = normalizePart(part);
  if (!normalizedLine || !normalizedPart) return false;
  return normalizedLine.includes(normalizedPart);
}

export function getPracticeAddressParts(settings: PracticeAddressInput) {
  const line1 = cleanPart(settings.address);
  const line2 = cleanPart(settings.address_line_2);
  const city = cleanPart(settings.city);
  const postcode = cleanPart(settings.postcode);
  const country = cleanPart(settings.country);

  return {
    line1,
    line2: lineContainsPart(line1, line2) ? '' : line2,
    city: lineContainsPart(line1, city) ? '' : city,
    postcode: lineContainsPart(line1, postcode) ? '' : postcode,
    country: lineContainsPart(line1, country) ? '' : country,
  };
}

export function buildPracticeAddress(settings: PracticeAddressInput): string {
  const parts = getPracticeAddressParts(settings);
  return [parts.line1, parts.line2, parts.city, parts.postcode, parts.country].filter(Boolean).join(', ');
}

/**
 * Parse une saisie décimale ("42,50" / "42.50") vers les unités mineures.
 * Retourne null si invalide.
 */
export function parseToMinorUnits(
  input: string,
  minorDigits = 2,
): bigint | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const negative = normalized.startsWith('-');
  const [intPart, decPart = ''] = normalized.replace('-', '').split('.');
  if (decPart.length > minorDigits) return null;
  const units =
    BigInt(intPart || '0') * 10n ** BigInt(minorDigits) +
    BigInt((decPart + '0'.repeat(minorDigits)).slice(0, minorDigits) || '0');
  return negative ? -units : units;
}

/**
 * Formatage des montants stockés en unités mineures (BigInt côté API,
 * reçus en string JSON). minorUnits vient du registre `currencies`.
 */
export function formatAmount(
  minorUnits: string | number | bigint,
  currencyCode: string,
  minorDigits = 2,
  locale?: string,
): string {
  const value = Number(minorUnits) / 10 ** minorDigits;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: minorDigits,
    maximumFractionDigits: minorDigits,
  }).format(value);
}

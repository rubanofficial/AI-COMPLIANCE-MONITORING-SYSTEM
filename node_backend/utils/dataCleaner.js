/**
 * Data cleaning utilities — equivalent to utils/data_cleaner.py
 */

const WEIGHT_UNIT_RE = /\b(?:ml|l|ltr|litre|liter|g|gm|gms|gram|grams|kg|kilo|kilogram|kilograms|pcs|pc|piece|pieces|units?|nos?|pack|packs|sachets?|capsules?|tablets?)\b/i;
const SELECT_UNIT_RE = /select\s*unit/i;

/**
 * Detects whether a string represents weight, volume, count, or unit-picker text
 * rather than a monetary price.
 */
export function isWeightOrUnit(value) {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (SELECT_UNIT_RE.test(s)) return true;
  return WEIGHT_UNIT_RE.test(s);
}

/**
 * Parses and validates a monetary price or MRP.
 * Rejects weight/volume values, unit pickers, negative values, and non-numeric inputs.
 */
export function cleanPrice(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === 'N/A' || s === 'null' || s === 'undefined' || s === '-') return null;

  // Never treat package weight, volume, or unit-picker text as a price
  if (isWeightOrUnit(s)) return null;

  // Strip currency prefixes and symbols (₹, Rs, Rs., INR), spaces, and commas
  const sanitized = s
    .replace(/(?:₹|Rs\.?|INR)/gi, '')
    .replace(/,/g, '')
    .trim();

  // Must be a valid decimal or integer number
  if (!/^\d+(?:\.\d+)?$/.test(sanitized)) {
    return null;
  }

  const num = parseFloat(sanitized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function cleanDiscount(value) {
  if (!value) return null;
  const match = String(value).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export default { cleanPrice, cleanDiscount, isWeightOrUnit };

/**
 * Data cleaning utilities — equivalent to utils/data_cleaner.py
 */

function cleanPrice(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function cleanDiscount(value) {
  if (!value) return null;
  const match = String(value).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

module.exports = { cleanPrice, cleanDiscount };

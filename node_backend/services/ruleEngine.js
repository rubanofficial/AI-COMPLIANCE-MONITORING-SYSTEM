/**
 * Rule Engine — equivalent to services/rule_engine.py
 * Validates product compliance against FSSAI and other Indian regulations.
 */
const { cleanPrice, cleanDiscount } = require('../utils/dataCleaner');

function validateProduct(product, deepScrapeAvailable = true) {
  const violations = [];
  const passedRules = [];
  let totalRules = 0;
  let score = 100;

  function addViolation(ruleId, ruleName, message, severity, field = null, penalty = 0) {
    violations.push({ id: ruleId, rule: ruleName, message, severity, field });
    return penalty;
  }

  function addAdvisory(ruleId, ruleName, message, field = null) {
    violations.push({
      id: ruleId,
      rule: ruleName,
      message: message + ' (could not verify — deep scrape unavailable)',
      severity: 'INFO',
      field,
    });
  }

  // Extract fields
  const price = cleanPrice(product.price);
  const mrp = cleanPrice(product.mrp);
  const name = product.product_name || product.name;
  const weight = product.weight;
  const ingredients = product.ingredients || 'N/A';
  const manufacturerName = product.manufacturer_name || 'N/A';
  const manufacturerAddress = product.manufacturer_address || 'N/A';
  const fssaiNumber = product.fssai_number || 'N/A';
  const expiryDate = product.expiry_date || 'N/A';
  const fssaiOcr = product.fssai_from_ocr || 'N/A';

  // === BASIC VALIDATIONS (always checked) ===

  totalRules++;
  if (!name || String(name).trim() === '' || String(name).trim() === 'N/A') {
    score -= addViolation('VAL001', 'Product Name Check', 'Missing product name', 'CRITICAL', 'name', 30);
  } else {
    passedRules.push('VAL001');
  }

  totalRules++;
  if (!price || price <= 0) {
    score -= addViolation('VAL002', 'Price Check', 'Missing or invalid price', 'HIGH', 'price', 25);
  } else {
    passedRules.push('VAL002');
  }

  totalRules++;
  if (!weight || weight === 'N/A') {
    score -= addViolation('VAL003', 'Weight Check', 'Missing weight/quantity information', 'MEDIUM', 'weight', 15);
  } else {
    passedRules.push('VAL003');
  }

  if (mrp && price && mrp < price) {
    totalRules++;
    score -= addViolation('VAL004', 'MRP Compliance', 'MRP lower than selling price (illegal)', 'CRITICAL', 'mrp', 40);
  }

  // === REGULATORY COMPLIANCE VALIDATIONS ===

  totalRules++;
  const effectiveFssai = fssaiOcr !== 'N/A' ? fssaiOcr : fssaiNumber;
  if (effectiveFssai === 'N/A' || !effectiveFssai) {
    if (deepScrapeAvailable) {
      score -= addViolation('REG001', 'FSSAI License', 'Missing FSSAI license number (required for food products)', 'CRITICAL', 'fssai_number', 35);
    } else {
      addAdvisory('REG001', 'FSSAI License', 'FSSAI license number not found on listing', 'fssai_number');
    }
  } else if (String(effectiveFssai).trim().length !== 14) {
    score -= addViolation('REG001', 'FSSAI Format', 'Invalid FSSAI number format (must be 14 digits)', 'HIGH', 'fssai_number', 25);
  } else {
    passedRules.push('REG001');
  }

  totalRules++;
  if (manufacturerName === 'N/A' || !manufacturerName) {
    if (deepScrapeAvailable) {
      score -= addViolation('REG002', 'Manufacturer Name', 'Missing manufacturer name (legally required)', 'HIGH', 'manufacturer_name', 30);
    } else {
      addAdvisory('REG002', 'Manufacturer Name', 'Manufacturer name not found on listing', 'manufacturer_name');
    }
  } else {
    passedRules.push('REG002');
  }

  totalRules++;
  if (manufacturerAddress === 'N/A' || !manufacturerAddress) {
    if (deepScrapeAvailable) {
      score -= addViolation('REG003', 'Manufacturer Address', 'Missing manufacturer address (legally required)', 'MEDIUM', 'manufacturer_address', 25);
    } else {
      addAdvisory('REG003', 'Manufacturer Address', 'Manufacturer address not found on listing', 'manufacturer_address');
    }
  } else {
    passedRules.push('REG003');
  }

  totalRules++;
  if (ingredients === 'N/A' || !ingredients || String(ingredients).trim().length < 5) {
    if (deepScrapeAvailable) {
      score -= addViolation('REG004', 'Ingredients List', 'Missing or incomplete ingredient list', 'HIGH', 'ingredients', 20);
    } else {
      addAdvisory('REG004', 'Ingredients List', 'Ingredient list not found on listing', 'ingredients');
    }
  } else {
    passedRules.push('REG004');
  }

  totalRules++;
  if (expiryDate === 'N/A' || !expiryDate) {
    if (deepScrapeAvailable) {
      score -= addViolation('REG005', 'Expiry Date', 'Missing expiry/best before date', 'MEDIUM', 'expiry_date', 15);
    } else {
      addAdvisory('REG005', 'Expiry Date', 'Expiry date not found on listing', 'expiry_date');
    }
  } else {
    passedRules.push('REG005');
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    rule_score: score,
    violations,
    passed_rules: passedRules,
    total_rules: totalRules,
    deep_scrape_available: deepScrapeAvailable,
  };
}

module.exports = { validateProduct };

/**
 * Seed data for platforms and the compliance rule catalogue.
 *
 * Rule codes/severities/penalties mirror services/ruleEngine.js so the rules
 * table stays in sync with the rules the engine actually enforces.
 */

export const PLATFORMS = [
  { slug: 'blinkit', name: 'Blinkit' },
  { slug: 'zepto', name: 'Zepto' },
];

export const RULES = [
  // --- Basic listing validations (always checked) ---
  {
    code: 'VAL001',
    name: 'Product Name Check',
    category: 'Basic Listing',
    severity: 'CRITICAL',
    penalty: 30,
    regulatory_ref: 'Legal Metrology Act, 2009',
  },
  {
    code: 'VAL002',
    name: 'Price Check',
    category: 'Basic Listing',
    severity: 'HIGH',
    penalty: 25,
    regulatory_ref: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  },
  {
    code: 'VAL003',
    name: 'Weight Check',
    category: 'Basic Listing',
    severity: 'MEDIUM',
    penalty: 15,
    regulatory_ref: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  },
  {
    code: 'VAL004',
    name: 'MRP Compliance',
    category: 'Basic Listing',
    severity: 'CRITICAL',
    penalty: 40,
    regulatory_ref: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  },

  // --- Regulatory label declarations ---
  {
    code: 'REG001',
    name: 'FSSAI License',
    category: 'Regulatory Label',
    severity: 'CRITICAL',
    penalty: 35,
    regulatory_ref: 'FSSAI (Licensing and Registration of Food Businesses) Regulations, 2011',
  },
  {
    code: 'REG002',
    name: 'Manufacturer Name',
    category: 'Regulatory Label',
    severity: 'HIGH',
    penalty: 30,
    regulatory_ref: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  },
  {
    code: 'REG003',
    name: 'Manufacturer Address',
    category: 'Regulatory Label',
    severity: 'MEDIUM',
    penalty: 25,
    regulatory_ref: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  },
  {
    code: 'REG004',
    name: 'Ingredients List',
    category: 'Regulatory Label',
    severity: 'HIGH',
    penalty: 20,
    regulatory_ref: 'FSSAI (Labelling and Display) Regulations, 2020',
  },
  {
    code: 'REG005',
    name: 'Expiry Date',
    category: 'Regulatory Label',
    severity: 'MEDIUM',
    penalty: 15,
    regulatory_ref: 'FSSAI (Labelling and Display) Regulations, 2020',
  },
];

export default { PLATFORMS, RULES };

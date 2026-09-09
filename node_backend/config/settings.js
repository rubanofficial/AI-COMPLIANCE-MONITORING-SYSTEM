const path = require('path');

// Scraping limits
const MAX_PRODUCTS = 5;        // max products per platform for live scraping
const MAX_DEEP_PRODUCTS = 3;   // max products to deep-scrape for compliance

// Output file path (same location as Python version)
const OUTPUT_FILE = path.join(__dirname, '..', 'output.json');

module.exports = {
  MAX_PRODUCTS,
  MAX_DEEP_PRODUCTS,
  OUTPUT_FILE,
};

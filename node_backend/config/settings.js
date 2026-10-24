import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scraping limits
export const MAX_PRODUCTS = 5;        // max products per platform for live scraping
export const MAX_DEEP_PRODUCTS = 3;   // max products to deep-scrape for compliance

// Output file path (same location as Python version)
export const OUTPUT_FILE = path.join(__dirname, '..', 'output.json');

export default {
  MAX_PRODUCTS,
  MAX_DEEP_PRODUCTS,
  OUTPUT_FILE,
};

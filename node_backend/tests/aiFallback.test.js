import { describe, it, expect } from 'vitest';
import { fallbackAnalysis } from '../services/aiService.js';

describe('AI Fallback Analysis', () => {
  it('returns ai_score null and an empty ai_violations array', () => {
    const product = {
      name: 'Sample Product',
      price: '100',
      mrp: '120',
      weight: '500g',
    };
    const result = fallbackAnalysis(product);
    expect(result.ai_score).toBeNull();
    expect(result.ai_violations).toEqual([]);
    expect(result.ai_risk).toBeNull();
    expect(result.ai_status).toBe('AI unavailable - rule-based score only');
  });
});

import { describe, it, expect } from 'vitest';
import { combineScores } from '../services/scoringEngine.js';

describe('Scoring Engine', () => {
  it('1. final score equals rule_score even when ai_score is very different (e.g. rule 80, ai 10)', () => {
    const ruleResult = {
      rule_score: 80,
      violations: [],
      passed_rules: [],
      total_rules: 9,
      deep_scrape_available: true,
    };
    const aiResult = {
      ai_score: 10,
      ai_risk: 'High',
      ai_violations: [],
      ai_status: 'Complete',
    };
    const result = combineScores(ruleResult, aiResult);
    expect(result.score).toBe(80);
    expect(result.rule_score).toBe(80);
    expect(result.ai_score).toBe(10);
  });

  it('2. same input called twice gives the same score', () => {
    const ruleResult = {
      rule_score: 75,
      violations: [],
      passed_rules: [],
      total_rules: 9,
      deep_scrape_available: true,
    };
    const aiResult = {
      ai_score: 40,
      ai_risk: 'Medium',
      ai_violations: [],
      ai_status: 'Complete',
    };
    const result1 = combineScores(ruleResult, aiResult);
    const result2 = combineScores(ruleResult, aiResult);
    expect(result1.score).toBe(result2.score);
    expect(result1.risk).toBe(result2.risk);
  });

  it('3. an AI violation with the same field as a rule violation is dropped (only 1 remains)', () => {
    const ruleResult = {
      rule_score: 80,
      violations: [
        { id: 'VAL001', rule: 'Rule Price', message: 'Price invalid', severity: 'HIGH', field: 'price' },
      ],
      passed_rules: [],
      total_rules: 9,
      deep_scrape_available: true,
    };
    const aiResult = {
      ai_score: 80,
      ai_risk: 'Low',
      ai_violations: [
        { id: 'AI_PRICE_001', rule: 'AI Price', message: 'AI price issue', severity: 'HIGH', field: 'price' },
      ],
      ai_status: 'Complete',
    };
    const result = combineScores(ruleResult, aiResult);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].id).toBe('VAL001');
    expect(result.violations[0].field).toBe('price');
    expect(result.violations[0].source).toBe('rule');
  });

  it('4. an AI violation with a different field is kept', () => {
    const ruleResult = {
      rule_score: 85,
      violations: [
        { id: 'VAL001', rule: 'Rule Price', message: 'Price invalid', severity: 'HIGH', field: 'price' },
      ],
      passed_rules: [],
      total_rules: 9,
      deep_scrape_available: true,
    };
    const aiResult = {
      ai_score: 80,
      ai_risk: 'Low',
      ai_violations: [
        { id: 'AI_ING_001', rule: 'AI Ingredients', message: 'Ingredients issue', severity: 'MEDIUM', field: 'ingredients' },
      ],
      ai_status: 'Complete',
    };
    const result = combineScores(ruleResult, aiResult);
    expect(result.violations).toHaveLength(2);
    const fields = result.violations.map(v => v.field);
    expect(fields).toContain('price');
    expect(fields).toContain('ingredients');
    const aiV = result.violations.find(v => v.field === 'ingredients');
    expect(aiV.source).toBe('ai');
  });

  it('5. ai_score null does not throw and does not change the score', () => {
    const ruleResult = {
      rule_score: 85,
      violations: [],
      passed_rules: [],
      total_rules: 9,
      deep_scrape_available: true,
    };
    const aiResult = {
      ai_score: null,
      ai_risk: null,
      ai_violations: [],
      ai_status: 'AI unavailable - rule-based score only',
    };
    expect(() => {
      const result = combineScores(ruleResult, aiResult);
      expect(result.score).toBe(85);
      expect(result.ai_score).toBeNull();
    }).not.toThrow();
  });

  it('6. deep_scrape_available false stays false (Fix 1 regression test)', () => {
    const ruleResult = {
      rule_score: 90,
      violations: [],
      passed_rules: [],
      total_rules: 9,
      deep_scrape_available: false,
    };
    const aiResult = {
      ai_score: 90,
      ai_violations: [],
    };
    const result = combineScores(ruleResult, aiResult);
    expect(result.deep_scrape_available).toBe(false);
  });
});

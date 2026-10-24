/**
 * Scoring Engine — equivalent to services/scoring_engine.py
 * Combines rule-based and AI scores, normalizes violations.
 */

export function normalizeViolation(v) {
  if (typeof v === 'string') {
    return {
      id: `MSG_${Math.abs(hashStr(v)) % 10000}`,
      rule: 'System Message',
      message: v,
      severity: 'MEDIUM',
      field: null,
    };
  }

  let severity = String(v.severity || 'MEDIUM').toUpperCase();
  if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(severity)) {
    severity = 'MEDIUM';
  }

  const res = {
    id: v.id || `UNK_${Math.abs(hashStr(v.message || '')) % 10000}`,
    rule: v.rule || 'Compliance Rule',
    message: v.message || 'Rule violation detected',
    severity,
    field: v.field || null,
  };
  if (v.source) {
    res.source = v.source;
  }
  return res;
}

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export function combineScores(ruleResult, aiResult) {
  // Score is deterministic and derived from rules only because LLM scores are not reproducible
  const finalScore = ruleResult.rule_score;

  let risk;
  if (finalScore >= 80) risk = 'Low';
  else if (finalScore >= 50) risk = 'Medium';
  else risk = 'High';

  // Tag violations with source ('rule' or 'ai')
  const ruleViolations = (ruleResult.violations || []).map(v =>
    typeof v === 'object' && v !== null ? { ...v, source: 'rule' } : v
  );
  const aiViolations = (aiResult?.ai_violations || []).map(v =>
    typeof v === 'object' && v !== null ? { ...v, source: 'ai' } : v
  );

  // Build a Set of field values from rule violations (ignore null fields)
  const ruleFields = new Set(
    ruleViolations
      .map(v => (typeof v === 'object' && v !== null ? v.field : null))
      .filter(f => f !== null && f !== undefined && f !== '')
  );

  // Drop AI violations with a field flagged by rules; keep AI violations with no field or non-conflicting field
  const filteredAiViolations = aiViolations.filter(v => {
    if (typeof v !== 'object' || v === null) return true;
    return !v.field || !ruleFields.has(v.field);
  });

  const rawViolations = [
    ...ruleViolations,
    ...filteredAiViolations,
  ];
  const normalizedViolations = rawViolations.map(normalizeViolation);

  return {
    score: finalScore,
    rule_score: ruleResult.rule_score,
    ai_score: aiResult?.ai_score ?? null,
    risk,
    violations: normalizedViolations,
    passed_rules: ruleResult.passed_rules,
    total_rules: ruleResult.total_rules,
    ai_analysis_status: aiResult?.ai_status || 'Success',
    deep_scrape_available: ruleResult.deep_scrape_available ?? true,
  };
}

export default { combineScores, normalizeViolation };

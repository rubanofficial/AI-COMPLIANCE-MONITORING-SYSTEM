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

  return {
    id: v.id || `UNK_${Math.abs(hashStr(v.message || '')) % 10000}`,
    rule: v.rule || 'Compliance Rule',
    message: v.message || 'Rule violation detected',
    severity,
    field: v.field || null,
  };
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
  const finalScore = Math.round((ruleResult.rule_score * 0.5) + (aiResult.ai_score * 0.5));

  let risk;
  if (finalScore >= 80) risk = 'Low';
  else if (finalScore >= 50) risk = 'Medium';
  else risk = 'High';

  // Normalize all violations from both sources
  const rawViolations = [
    ...(ruleResult.violations || []),
    ...(aiResult.ai_violations || []),
  ];
  const normalizedViolations = rawViolations.map(normalizeViolation);

  return {
    score: finalScore,
    rule_score: ruleResult.rule_score,
    ai_score: aiResult.ai_score,
    risk,
    violations: normalizedViolations,
    passed_rules: ruleResult.passed_rules,
    total_rules: ruleResult.total_rules,
    ai_analysis_status: aiResult.ai_status || 'Success',
    deep_scrape_available: ruleResult.deep_scrape_available || true,
  };
}

export default { combineScores, normalizeViolation };

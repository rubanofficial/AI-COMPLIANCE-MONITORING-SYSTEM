def combine_scores(rule_result, ai_result):
    """
    Combines rule-based and AI scores, and normalizes all violations.
    """
    def normalize_violation(v):
        if isinstance(v, str):
            return {
                "id": f"MSG_{abs(hash(v)) % 10000}",
                "rule": "System Message",
                "message": v,
                "severity": "MEDIUM",
                "field": None
            }
        
        # Ensure severity is uppercase and valid
        severity = str(v.get("severity", "MEDIUM")).upper()
        if severity not in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            severity = "MEDIUM"
            
        return {
            "id": v.get("id", f"UNK_{abs(hash(v.get('message', ''))) % 10000}"),
            "rule": v.get("rule", "Compliance Rule"),
            "message": v.get("message", "Rule violation detected"),
            "severity": severity,
            "field": v.get("field")
        }

    final_score = int((rule_result["rule_score"] * 0.5) + (ai_result["ai_score"] * 0.5))

    if final_score >= 80:
        risk = "Low"
    elif final_score >= 50:
        risk = "Medium"
    else:
        risk = "High"

    # Normalize all violations from both sources
    raw_violations = rule_result.get("violations", []) + ai_result.get("ai_violations", [])
    normalized_violations = [normalize_violation(v) for v in raw_violations]

    return {
        "score": final_score,
        "rule_score": rule_result["rule_score"],
        "risk": risk,
        "violations": normalized_violations,
        "passed_rules": rule_result["passed_rules"],
        "total_rules": rule_result["total_rules"],
        "ai_analysis_status": ai_result.get("ai_status", "Success")
    }

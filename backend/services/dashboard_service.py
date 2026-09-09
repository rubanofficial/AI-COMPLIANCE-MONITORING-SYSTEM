"""
Dashboard Service - Manages scan history, statistics, and output.json persistence
"""
from datetime import datetime, timedelta
from typing import List, Dict
import json
import os

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output.json")

# In-memory storage
scan_history: List[Dict] = []
evaluated_products: List[Dict] = []  # Full product data with compliance


def _save_output():
    """Persist all evaluated data to output.json"""
    data = {
        "last_updated": datetime.now().isoformat(),
        "total_products": len(evaluated_products),
        "scan_history": scan_history,
        "evaluated_products": evaluated_products,
    }
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        print(f"    💾 [output.json] Saved {len(evaluated_products)} products to {OUTPUT_FILE}")
    except Exception as e:
        print(f"    ⚠️ [output.json] Save failed: {e}")


def _load_output():
    """Load existing data from output.json on startup"""
    global scan_history, evaluated_products
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            scan_history.clear()
            scan_history.extend(data.get("scan_history", []))
            evaluated_products.clear()
            evaluated_products.extend(data.get("evaluated_products", []))
            print(f"    ✅ [output.json] Loaded {len(evaluated_products)} products, {len(scan_history)} scans")
        except Exception as e:
            print(f"    ⚠️ [output.json] Load failed: {e}")


def add_evaluated_product(product_data: dict, compliance_data: dict, ai_analysis: dict, platform: str):
    """Store a fully evaluated product with compliance results"""
    entry = {
        "product": product_data,
        "compliance": compliance_data,
        "ai_analysis": ai_analysis,
        "platform": platform,
        "evaluated_at": datetime.now().isoformat(),
    }
    evaluated_products.append(entry)
    _save_output()
    return entry


def get_evaluated_products() -> List[Dict]:
    """Return all evaluated products (for dashboard)"""
    return list(reversed(evaluated_products))  # Newest first


def get_latest_scan_data() -> Dict:
    """Return the latest full scan results for the dashboard"""
    if not evaluated_products:
        return {"products": [], "stats": get_dashboard_stats()}

    return {
        "products": list(reversed(evaluated_products[-20:])),  # Last 20
        "stats": get_dashboard_stats(),
    }


def add_scan_to_history(product_name: str, platform: str, compliance_score: int, risk: str):
    """Add a completed scan to history"""
    scan_history.append({
        "name": product_name,
        "platform": platform,
        "score": compliance_score,
        "risk": risk,
        "timestamp": datetime.now().isoformat(),
        "time": datetime.now().strftime("%I:%M %p")
    })
    
    # Keep only last 100 scans
    if len(scan_history) > 100:
        scan_history.pop(0)
    _save_output()

def get_recent_scans(limit: int = 10) -> List[Dict]:
    """Get most recent scans"""
    return list(reversed(scan_history[-limit:]))

def get_dashboard_stats() -> Dict:
    """Calculate dashboard statistics from scan history and evaluated products"""
    if not scan_history:
        return {
            "avg_compliance_score": 0,
            "products_scanned": 0,
            "total_violations": 0,
            "rules_passing_percentage": 0,
            "total_critical": 0,
            "total_high": 0,
            "passed_rules_count": 0,
            "total_rules": 14,
        }
    
    total_score = sum(scan["score"] for scan in scan_history)
    avg_score = total_score // len(scan_history)
    
    # Count actual violations from evaluated products
    total_violations = 0
    total_critical = 0
    total_high = 0
    total_passed = 0
    total_rules_sum = 0

    for ep in evaluated_products:
        comp = ep.get("compliance", {})
        violations = comp.get("violations", [])
        total_violations += len(violations)
        for v in violations:
            sev = v.get("severity", "MEDIUM").upper()
            if sev == "CRITICAL":
                total_critical += 1
            elif sev == "HIGH":
                total_high += 1
        total_passed += len(comp.get("passed_rules", []))
        total_rules_sum += comp.get("total_rules", 0)

    # If no evaluated products, approximate from scores
    if not evaluated_products:
        total_violations = sum(max(0, (100 - scan["score"]) // 10) for scan in scan_history)
        total_critical = sum(1 for scan in scan_history if scan["score"] < 50)
        total_high = sum(1 for scan in scan_history if 50 <= scan["score"] < 70)
        total_passed = (avg_score * 14) // 100
        total_rules_sum = 14 * len(scan_history)

    rules_passing_pct = (total_passed * 100 // total_rules_sum) if total_rules_sum > 0 else 0

    return {
        "avg_compliance_score": avg_score,
        "products_scanned": len(scan_history),
        "total_violations": total_violations,
        "rules_passing_percentage": rules_passing_pct,
        "passed_rules_count": total_passed,
        "total_rules": total_rules_sum if total_rules_sum > 0 else 14,
        "total_critical": total_critical,
        "total_high": total_high,
    }

def get_trend_data(days: int = 7) -> List[Dict]:
    """Generate trend data from scan history, filling gaps so the chart always has a full date range."""
    today = datetime.now().date()
    
    # Build a map of actual scan data keyed by date string
    scan_map: Dict[str, Dict] = {}
    for scan in scan_history:
        try:
            timestamp = datetime.fromisoformat(scan["timestamp"])
        except (ValueError, KeyError):
            continue
        date_key = timestamp.strftime("%b %d")
        date_obj = timestamp.date()
        
        if date_key not in scan_map:
            scan_map[date_key] = {
                "date_obj": date_obj,
                "scores": [],
                "violations": [],
                "products_scanned": 0,
            }
        
        scan_map[date_key]["scores"].append(scan.get("score", 0))
        violations = max(0, (100 - scan.get("score", 0)) // 10)
        scan_map[date_key]["violations"].append(violations)
        scan_map[date_key]["products_scanned"] += 1
    
    # Generate a full range of dates (last N days) so chart always has multiple points
    trend_data = []
    for i in range(days - 1, -1, -1):  # oldest → newest
        d = today - timedelta(days=i)
        date_key = d.strftime("%b %d")
        
        if date_key in scan_map:
            entry = scan_map[date_key]
            avg_score = sum(entry["scores"]) // len(entry["scores"])
            trend_data.append({
                "date": date_key,
                "score": avg_score,
                "violations": sum(entry["violations"]),
                "products_scanned": entry["products_scanned"],
            })
        else:
            # Fill gap — no scans on this day
            trend_data.append({
                "date": date_key,
                "score": None,      # null so Recharts skips the point
                "violations": None,
                "products_scanned": 0,
            })
    
    return trend_data

def initialize_sample_data():
    """Load persisted data from output.json on startup (no more fake sample data)"""
    _load_output()
    if evaluated_products:
        print(f"✓ Dashboard loaded {len(evaluated_products)} products, {len(scan_history)} scans from output.json")
    else:
        print("✓ Dashboard initialized (no previous data — scan products to populate)")

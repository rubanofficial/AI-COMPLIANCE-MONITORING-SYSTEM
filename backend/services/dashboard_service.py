"""
Dashboard Service - Manages scan history and statistics
"""
from datetime import datetime, timedelta
from typing import List, Dict
import random

# In-memory storage for scan history (replace with database in production)
scan_history: List[Dict] = []

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

def get_recent_scans(limit: int = 10) -> List[Dict]:
    """Get most recent scans"""
    return list(reversed(scan_history[-limit:]))

def get_dashboard_stats() -> Dict:
    """Calculate dashboard statistics from scan history"""
    if not scan_history:
        return {
            "avg_compliance_score": 0,
            "products_scanned": 0,
            "total_violations": 0,
            "rules_passing_percentage": 0,
            "total_critical": 0,
            "total_high": 0
        }
    
    # Calculate averages
    total_score = sum(scan["score"] for scan in scan_history)
    avg_score = total_score // len(scan_history)
    
    # Count violations (approximation based on score)
    total_violations = sum(max(0, (100 - scan["score"]) // 10) for scan in scan_history)
    
    # Critical and high violations (approximation)
    critical_count = sum(1 for scan in scan_history if scan["score"] < 50)
    high_count = sum(1 for scan in scan_history if 50 <= scan["score"] < 70)
    
    # Rules passing percentage (average)
    rules_passing = (avg_score * 14) // 100  # 14 total rules
    
    return {
        "avg_compliance_score": avg_score,
        "products_scanned": len(scan_history),
        "total_violations": total_violations,
        "rules_passing_percentage": (rules_passing * 100) // 14,
        "passed_rules_count": rules_passing,
        "total_rules": 14,
        "total_critical": critical_count,
        "total_high": high_count
    }

def get_trend_data(days: int = 7) -> List[Dict]:
    """Generate trend data from scan history"""
    if not scan_history:
        # Return empty trend data
        return []
    
    # Group scans by date
    trends = {}
    for scan in scan_history:
        timestamp = datetime.fromisoformat(scan["timestamp"])
        date_key = timestamp.strftime("%b %d")
        
        if date_key not in trends:
            trends[date_key] = {
                "date": date_key,
                "compliance_score": [],
                "violations": []
            }
        
        trends[date_key]["compliance_score"].append(scan["score"])
        # Estimate violations from score
        violations = max(0, (100 - scan["score"]) // 10)
        trends[date_key]["violations"].append(violations)
    
    # Calculate averages
    trend_data = []
    for date_key, data in trends.items():
        trend_data.append({
            "date": date_key,
            "compliance_score": sum(data["compliance_score"]) // len(data["compliance_score"]),
            "violations": sum(data["violations"]) // len(data["violations"])
        })
    
    # Sort by date and return last N days
    return trend_data[-days:]

def initialize_sample_data():
    """Initialize with some sample data for demonstration"""
    if scan_history:
        return  # Already has data
    
    sample_products = [
        ("Amul Taaza Milk", "blinkit", 85),
        ("Britannia Bread", "zepto", 72),
        ("Nestle Maggi", "blinkit", 68),
        ("Mother Dairy Curd", "zepto", 91),
        ("Parle-G Biscuits", "blinkit", 78),
    ]
    
    base_time = datetime.now() - timedelta(hours=5)
    
    for i, (name, platform, score) in enumerate(sample_products):
        risk = "LOW" if score >= 80 else "MEDIUM" if score >= 50 else "HIGH"
        scan_time = base_time + timedelta(minutes=i * 30)
        
        scan_history.append({
            "name": name,
            "platform": platform,
            "score": score,
            "risk": risk,
            "timestamp": scan_time.isoformat(),
            "time": scan_time.strftime("%I:%M %p")
        })

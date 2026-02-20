import asyncio
import sys
import traceback

# FIX for Playwright on Windows + Python 3.12
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.scraper.scraper_manager import scrape_all
from services.rule_engine import validate_product
from services.openai_service import analyze_product  # Currently returns mock data
from services.scoring_engine import combine_scores
from services.ocr_service import perform_ocr_on_images, extract_compliance_data_rules
from services.dashboard_service import (
    add_scan_to_history,
    get_recent_scans,
    get_dashboard_stats,
    get_trend_data,
    initialize_sample_data
)

app = FastAPI()

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sample data on startup
@app.on_event("startup")
async def startup_event():
    initialize_sample_data()
    print("✓ Dashboard initialized with sample data")

@app.post("/evaluate")
async def evaluate(product_name: str):

    scraped = await scrape_all(product_name)

    if not scraped:
        return {"error": "Scraping failed"}

    results = []

    for product in scraped:
        try:
            # 1. Local OCR Pipeline
            image_urls = product.get("product_images", [])
            ocr_result = await perform_ocr_on_images(image_urls)
            ocr_data = extract_compliance_data_rules(ocr_result)
            
            # Merge OCR data into product
            product.update(ocr_data)
            product["ocr_raw_text"] = ocr_result.get("raw_text", "")
    
            # 2. Local Rule Engine Validation
            rule_result = validate_product(product)
    
            # 3. AI Analysis (Currently Mocked)
            # TODO: Enable real AI analysis when ready
            ai_result = await analyze_product(product)
    
            final = combine_scores(rule_result, ai_result)
    
            results.append({
                "product": product,
                "compliance": final,
                "ocr_summary": ocr_data,
                "ai_meta": {"status": ai_result.get("ai_status", "Success")}
            })
            
            # Add to scan history for dashboard
            platform = product.get("platform", "unknown")
            product_name_str = product.get("product_name") or product.get("name", "Unknown Product")
            risk_level = "LOW" if final["score"] >= 80 else "MEDIUM" if final["score"] >= 50 else "HIGH"
            add_scan_to_history(product_name_str, platform, final["score"], risk_level)
            
        except Exception as product_err:
            print(f"  ✗ Error evaluating product: {product_err}")
            traceback.print_exc()
            continue

    return {
        "products_analyzed": len(results),
        "results": results
    }

@app.get("/dashboard/stats")
async def get_stats():
    """Get dashboard statistics"""
    return get_dashboard_stats()

@app.get("/dashboard/recent-scans")
async def get_recent(limit: int = 10):
    """Get recent scans"""
    return {"scans": get_recent_scans(limit)}

@app.get("/dashboard/trends")
async def get_trends(days: int = 7):
    """Get compliance trend data"""
    return {"trends": get_trend_data(days)}

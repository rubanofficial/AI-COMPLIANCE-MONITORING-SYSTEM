import asyncio
import sys
import traceback
import json
import time
import os

# FIX for Playwright on Windows + Python 3.12
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Load .env BEFORE any service imports
from dotenv import load_dotenv
load_dotenv()
print(f"✓ .env loaded — GEMINI_API_KEY={'SET' if os.getenv('GEMINI_API_KEY') else 'MISSING'}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
# Use faster live scrapers for Phase 1
from services.scraper.blinkit_live import scrape_blinkit_live
from services.scraper.zepto_live import scrape_zepto_live
# Product detail scrapers for Phase 2 (deep scraping)
from services.scraper.blinkit_detail import scrape_blinkit_detail
from services.scraper.zepto_detail import scrape_zepto_detail
from services.rule_engine import validate_product
from services.gemini_service import analyze_product_with_gemini
from services.openai_service import analyze_product  # Fallback mock
from services.scoring_engine import combine_scores
from services.dashboard_service import (
    add_scan_to_history,
    add_evaluated_product,
    get_evaluated_products,
    get_latest_scan_data,
    get_recent_scans,
    get_dashboard_stats,
    get_trend_data,
    initialize_sample_data
)

app = FastAPI()

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sample data on startup
@app.on_event("startup")
async def startup_event():
    initialize_sample_data()
    print("✓ Dashboard initialized with sample data")


def sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event message."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def evaluate_stream_generator(product_name: str):
    """
    Two-phase streaming generator:
    Phase 1: Quick scrape basic product listings → send immediately
    Phase 2: Deep scrape each product → Gemini compliance → send per-product
    """
    start_time = time.time()

    # ═══════════════════════════════════════════════════════════
    # PHASE 1: Quick Scrape — Get basic product listings fast
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print(f"🚀 PHASE 1: Quick Scraping for '{product_name}'")
    print(f"{'='*60}")

    yield sse_event("status", {"message": f"Searching for '{product_name}' on Blinkit & Zepto...", "phase": "scraping"})

    # Run both live scrapers in parallel
    print(f"  📡 Launching parallel scrapers (Blinkit + Zepto)...")
    blinkit_task = scrape_blinkit_live(product_name)
    zepto_task = scrape_zepto_live(product_name)

    blinkit_results, zepto_results = await asyncio.gather(
        blinkit_task, zepto_task, return_exceptions=True
    )

    # Combine results
    scraped = []
    if isinstance(blinkit_results, list):
        scraped.extend(blinkit_results[:5])
        print(f"  ✅ Blinkit: Found {len(blinkit_results)} products (using top {min(5, len(blinkit_results))})")
    else:
        print(f"  ⚠️ Blinkit scraping failed: {blinkit_results}")

    if isinstance(zepto_results, list):
        scraped.extend(zepto_results[:5])
        print(f"  ✅ Zepto: Found {len(zepto_results)} products (using top {min(5, len(zepto_results))})")
    else:
        print(f"  ⚠️ Zepto scraping failed: {zepto_results}")

    phase1_time = time.time() - start_time
    print(f"\n  ⏱ Phase 1 completed in {phase1_time:.1f}s — {len(scraped)} products found")

    if not scraped:
        print(f"  ❌ No products found!")
        yield sse_event("error", {"message": "No products found. Try a different search term."})
        yield sse_event("complete", {"total": 0, "time": round(phase1_time, 1)})
        return

    # Send basic product listings immediately to UI
    basic_products = []
    for i, product in enumerate(scraped):
        basic_products.append({
            "index": i,
            "product": {
                "name": product.get("product_name") or product.get("name", "Unknown"),
                "price": product.get("price", "N/A"),
                "mrp": product.get("mrp", "N/A"),
                "discount": product.get("discount", "0"),
                "weight": product.get("weight", "N/A"),
                "platform": product.get("platform", "unknown"),
                "store_name": product.get("store_name", "Unknown"),
                "product_image": product.get("product_image", ""),
                "product_url": product.get("product_url", ""),
            },
            "compliance": None,  # Not yet evaluated
            "status": "pending"
        })

    yield sse_event("products_found", {
        "count": len(basic_products),
        "products": basic_products,
        "phase1_time": round(phase1_time, 1)
    })

    # ═══════════════════════════════════════════════════════════
    # PHASE 2: Deep Scraping + Compliance Analysis per product
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print(f"🔬 PHASE 2: Deep Scraping & Compliance Analysis")
    print(f"{'='*60}")

    for i, product in enumerate(scraped):
        product_name_str = product.get("product_name") or product.get("name", "Unknown")
        product_url = product.get("product_url", "")
        platform = product.get("platform", "unknown")
        product_start = time.time()

        print(f"\n  ┌─ Product [{i+1}/{len(scraped)}]: {product_name_str[:50]}")
        print(f"  │  Platform: {platform}")
        print(f"  │  URL: {product_url[:80]}...")

        yield sse_event("product_evaluating", {
            "index": i,
            "product_name": product_name_str,
            "step": "deep_scraping"
        })

        try:
            # Step 1: Deep scrape the product detail page
            deep_data = product.copy()  # Start with basic data
            deep_scrape_success = False

            if product_url and product_url.startswith("http"):
                print(f"  │  📄 Step 1: Deep scraping product page...")
                yield sse_event("product_step", {"index": i, "step": "deep_scraping", "message": f"Scraping full details for {product_name_str[:30]}..."})

                try:
                    if "zepto" in platform.lower() or "zepto" in product_url.lower():
                        detail = await scrape_zepto_detail(product_url)
                    else:
                        detail = await scrape_blinkit_detail(product_url)

                    if detail:
                        # Check if deep scrape got any regulatory data
                        reg_fields = ["fssai_number", "ingredients", "manufacturer_name", "expiry_date"]
                        got_reg_data = any(
                            detail.get(f) and str(detail[f]).strip() not in ("", "N/A", "None")
                            for f in reg_fields
                        )
                        # Merge deep data into product (keeping non-N/A values)
                        for key, value in detail.items():
                            if value and str(value).strip() not in ("", "N/A", "None"):
                                deep_data[key] = value
                        deep_scrape_success = got_reg_data
                        print(f"  │  ✅ Deep scrape {'successful — got regulatory data' if got_reg_data else 'partial — no regulatory data found'}")
                    else:
                        print(f"  │  ⚠️ Deep scrape returned no data, using basic info")
                except Exception as deep_err:
                    print(f"  │  ⚠️ Deep scrape failed: {str(deep_err)[:80]}")
                    print(f"  │     Continuing with basic scraped data...")
            else:
                print(f"  │  ⚠️ No product URL — skipping deep scrape")

            # Step 2: Rule Engine Validation
            print(f"  │  📋 Step 2: Running rule engine validation (deep_scrape={deep_scrape_success})...")
            yield sse_event("product_step", {"index": i, "step": "rule_engine", "message": f"Validating compliance rules..."})

            rule_result = validate_product(deep_data, deep_scrape_available=deep_scrape_success)
            print(f"  │  ✅ Rule engine: Score={rule_result['rule_score']}, Violations={len(rule_result['violations'])}, Passed={len(rule_result['passed_rules'])}")

            # Step 3: Gemini AI Analysis
            print(f"  │  🤖 Step 3: Running Gemini AI analysis...")
            yield sse_event("product_step", {"index": i, "step": "ai_analysis", "message": f"Analyzing with Gemini AI..."})

            ai_result = await analyze_product_with_gemini(deep_data, deep_scrape_available=deep_scrape_success)
            print(f"  │  ✅ AI analysis: Score={ai_result['ai_score']}, Risk={ai_result['ai_risk']}, Status={ai_result['ai_status']}")

            # Step 4: Combine scores
            print(f"  │  📊 Step 4: Combining scores...")
            final = combine_scores(rule_result, ai_result)

            product_time = time.time() - product_start
            print(f"  │  🏁 Final Score: {final['score']}/100, Risk: {final['risk']}")
            print(f"  └─ Completed in {product_time:.1f}s")

            # Add to scan history
            risk_level = "LOW" if final["score"] >= 80 else "MEDIUM" if final["score"] >= 50 else "HIGH"
            add_scan_to_history(product_name_str, platform, final["score"], risk_level)

            # Save full evaluated data to output.json
            product_out = {
                "name": deep_data.get("product_name") or deep_data.get("name", "Unknown"),
                "price": deep_data.get("price", "N/A"),
                "mrp": deep_data.get("mrp", "N/A"),
                "discount": deep_data.get("discount", "0"),
                "weight": deep_data.get("weight", "N/A"),
                "ingredients": deep_data.get("ingredients", "N/A"),
                "fssai_number": deep_data.get("fssai_number", "N/A"),
                "manufacturer_name": deep_data.get("manufacturer_name", "N/A"),
                "manufacturer_address": deep_data.get("manufacturer_address", "N/A"),
                "expiry_date": deep_data.get("expiry_date", "N/A"),
                "platform": deep_data.get("platform", "unknown"),
                "store_name": deep_data.get("store_name", "Unknown"),
                "product_image": deep_data.get("product_image", ""),
                "product_url": deep_data.get("product_url", ""),
            }
            compliance_out = {
                "score": final["score"],
                "rule_score": final["rule_score"],
                "risk": final["risk"],
                "violations": final["violations"],
                "passed_rules": final["passed_rules"],
                "total_rules": final["total_rules"],
            }
            # Build AI analysis output — use the FINAL combined score in summary
            # so AI summary and compliance score are always consistent
            deep_note = '' if deep_scrape_success else ' Based on listing data only (product detail page was not accessible).'
            violation_count = len([v for v in final['violations'] if v.get('severity') != 'INFO'])
            ai_out = {
                "ai_score": ai_result.get("ai_score", 0),
                "summary": f"Compliance score: {final['score']}/100 — {violation_count} issue(s) found.{deep_note}",
                "risk_level": final["risk"].upper(),
                "detailed_insights": ai_result.get("detailed_insights", ""),
                "recommendations": ai_result.get("recommendations", []),
                "status": ai_result.get("ai_status", "Complete"),
                "final_score": final["score"],
                "deep_scrape_available": deep_scrape_success,
            }
            add_evaluated_product(product_out, compliance_out, ai_out, platform)

            # Send evaluated product to UI
            yield sse_event("product_evaluated", {
                "index": i,
                "product": product_out,
                "compliance": compliance_out,
                "ai_analysis": ai_out,
                "time": round(product_time, 1),
            })

        except Exception as product_err:
            product_time = time.time() - product_start
            print(f"  │  ❌ Error: {product_err}")
            traceback.print_exc()
            print(f"  └─ Failed after {product_time:.1f}s")

            yield sse_event("product_error", {
                "index": i,
                "product_name": product_name_str,
                "error": str(product_err),
            })

    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"✅ ALL DONE — {len(scraped)} products processed in {total_time:.1f}s")
    print(f"{'='*60}\n")

    yield sse_event("complete", {
        "total": len(scraped),
        "time": round(total_time, 1)
    })


@app.get("/evaluate/stream")
async def evaluate_stream(product_name: str):
    """
    SSE streaming endpoint for two-phase product evaluation.
    Phase 1: Quick scrape → products appear in UI immediately
    Phase 2: Deep scrape + Gemini analysis → per-product compliance updates
    """
    return StreamingResponse(
        evaluate_stream_generator(product_name),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@app.post("/product/details")
async def get_product_details(product_url: str, platform: str = "blinkit"):
    """
    Scrape full product details (images, highlights, description, etc.)
    from a product detail page URL.
    platform: 'blinkit' or 'zepto'
    """
    if not product_url or not product_url.startswith("http"):
        return {"error": "Invalid product URL"}

    print(f"\n🔎 Fetching product details from {platform}: {product_url}")

    try:
        if "zepto" in platform.lower() or "zepto" in product_url.lower():
            detail = await scrape_zepto_detail(product_url)
        else:
            detail = await scrape_blinkit_detail(product_url)

        print(f"✓ Product detail fetched: {detail.get('product_name')}")
        return {"status": "success", "detail": detail}
    except Exception as e:
        print(f"✗ Product detail fetch failed: {e}")
        return {"error": str(e), "detail": None}


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

@app.get("/dashboard/live-data")
async def get_live_data():
    """Get full live data for dashboard - all evaluated products with compliance"""
    return get_latest_scan_data()

@app.get("/dashboard/evaluated-products")
async def get_all_evaluated():
    """Get all evaluated products with full compliance details"""
    return {"products": get_evaluated_products()}

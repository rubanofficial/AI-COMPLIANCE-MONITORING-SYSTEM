import asyncio
import sys
import json

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from services.scraper.scraper_manager import scrape_all
from services.rule_engine import validate_product
from services.gemini_service import analyze_product
from services.scoring_engine import combine_scores

async def test_deep_scraping():
    """
    Test the complete deep scraping and compliance analysis pipeline
    """
    
    print("\n" + "="*70)
    print("🚀 TESTING DEEP PRODUCT PAGE SCRAPING")
    print("="*70)
    
    # Test with a simple product
    product_query = "poha"
    
    print(f"\n📦 Query: {product_query}")
    print("-"*70)
    
    # Stage 1: Deep scraping
    products = await scrape_all(product_query)
    
    if not products:
        print("\n❌ No products found!")
        return
    
    print(f"\n✅ Scraped {len(products)} products with deep compliance data")
    print("-"*70)
    
    # Stage 2: Analyze first product in detail
    if products:
        product = products[0]
        
        print("\n📋 SAMPLE PRODUCT DATA:")
        print(f"  Platform: {product.get('platform')}")
        print(f"  Name: {product.get('product_name')}")
        print(f"  Price: ₹{product.get('price')}")
        print(f"  MRP: ₹{product.get('mrp')}")
        print(f"  Weight: {product.get('weight')}")
        print(f"  Discount: {product.get('discount')}%")
        print(f"  FSSAI: {product.get('fssai_number')}")
        print(f"  Manufacturer: {product.get('manufacturer_name')}")
        print(f"  Ingredients: {product.get('ingredients', 'N/A')[:100]}...")
        print(f"  Expiry: {product.get('expiry_date')}")
        print(f"  URL: {product.get('product_url')}")
        
        # Stage 3: Compliance validation
        print("\n🔍 COMPLIANCE ANALYSIS:")
        print("-"*70)
        
        rule_result = validate_product(product)
        print(f"\n  Rule-Based Score: {rule_result['rule_score']}/100")
        print(f"  Violations Found: {len(rule_result['violations'])}")
        if rule_result['violations']:
            for v in rule_result['violations']:
                print(f"    - {v}")
        
        # Stage 4: AI Analysis
        print("\n🤖 AI ANALYSIS (Gemini):")
        print("-"*70)
        
        try:
            ai_result = await analyze_product(product)
            print(f"\n  AI Score: {ai_result['ai_score']}/100")
            print(f"  AI Risk: {ai_result['ai_risk']}")
            print(f"  AI Violations: {len(ai_result['ai_violations'])}")
            if ai_result['ai_violations']:
                for v in ai_result['ai_violations']:
                    print(f"    - {v}")
            
            # Stage 5: Combined score
            combined = combine_scores(rule_result, ai_result)
            print("\n📊 FINAL COMPLIANCE SCORE:")
            print("-"*70)
            print(f"  Score: {combined['score']}/100")
            print(f"  Risk Level: {combined['risk']}")
            print(f"  Total Violations: {len(combined['violations'])}")
            
        except Exception as e:
            print(f"\n  ⚠️  AI analysis error: {e}")
    
    # Save results
    output_file = "deep_scraping_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 Results saved to: {output_file}")
    print("\n" + "="*70)
    print("✅ DEEP SCRAPING TEST COMPLETE")
    print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(test_deep_scraping())

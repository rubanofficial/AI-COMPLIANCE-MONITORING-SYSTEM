import asyncio
import sys

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from services.rule_engine import validate_product
from services.openai_service import analyze_product
from services.scoring_engine import combine_scores

async def test_compliance():
    print("=" * 60)
    print("COMPLIANCE TESTING - Various Product Scenarios")
    print("=" * 60)
    
    # Test Case 1: Perfect product
    print("\n[TEST 1] Perfect Product:")
    product1 = {
        "product_name": "Tata Sampann Poha",
        "price": "56",
        "mrp": "63",
        "discount": "11%",
        "weight": "500 g"
    }
    rule_result1 = validate_product(product1)
    print(f"  Rule Score: {rule_result1['rule_score']}")
    print(f"  Violations: {rule_result1['violations']}")
    
    # Test Case 2: Missing weight
    print("\n[TEST 2] Missing Weight:")
    product2 = {
        "product_name": "Fortune Poha",
        "price": "40",
        "mrp": "60",
        "discount": "33%",
        "weight": "N/A"
    }
    rule_result2 = validate_product(product2)
    print(f"  Rule Score: {rule_result2['rule_score']}")
    print(f"  Violations: {rule_result2['violations']}")
    
    # Test Case 3: Discount mismatch
    print("\n[TEST 3] Discount Mismatch:")
    product3 = {
        "product_name": "Rajdhani Poha",
        "price": "36",
        "mrp": "68",
        "discount": "47%",  # Actual is 47%, claimed is 47% - should pass
        "weight": "500 g"
    }
    rule_result3 = validate_product(product3)
    print(f"  Rule Score: {rule_result3['rule_score']}")
    print(f"  Violations: {rule_result3['violations']}")
    
    # Test Case 4: Suspicious high discount
    print("\n[TEST 4] Suspicious High Discount:")
    product4 = {
        "product_name": "Super Deal Poha",
        "price": "10",
        "mrp": "100",
        "discount": "90%",
        "weight": "1 kg"
    }
    rule_result4 = validate_product(product4)
    print(f"  Rule Score: {rule_result4['rule_score']}")
    print(f"  Violations: {rule_result4['violations']}")
    
    # Test Case 5: MRP < Price (illegal)
    print("\n[TEST 5] MRP Lower Than Price (Illegal):")
    product5 = {
        "product_name": "Bad Pricing Poha",
        "price": "100",
        "mrp": "80",
        "discount": "0%",
        "weight": "500 g"
    }
    rule_result5 = validate_product(product5)
    print(f"  Rule Score: {rule_result5['rule_score']}")
    print(f"  Violations: {rule_result5['violations']}")
    
    # Test Case 6: Missing name
    print("\n[TEST 6] Missing Product Name:")
    product6 = {
        "product_name": "",
        "price": "50",
        "mrp": "60",
        "discount": "16%",
        "weight": "500 g"
    }
    rule_result6 = validate_product(product6)
    print(f"  Rule Score: {rule_result6['rule_score']}")
    print(f"  Violations: {rule_result6['violations']}")
    
    # Test with AI (one example)
    print("\n" + "=" * 60)
    print("TESTING AI INTEGRATION (Gemini)")
    print("=" * 60)
    print("\n[AI TEST] Analyzing product with Gemini API...")
    try:
        ai_result = await analyze_product(product4)  # Test suspicious discount product
        print(f"  AI Score: {ai_result['ai_score']}")
        print(f"  AI Risk: {ai_result['ai_risk']}")
        print(f"  AI Violations: {ai_result['ai_violations']}")
        
        # Combined score
        combined = combine_scores(rule_result4, ai_result)
        print(f"\n  Combined Score: {combined['score']}")
        print(f"  Combined Risk: {combined['risk']}")
        print(f"  All Violations: {combined['violations']}")
    except Exception as e:
        print(f"  AI Test Failed: {e}")
    
    print("\n" + "=" * 60)
    print("COMPLIANCE TESTING COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_compliance())

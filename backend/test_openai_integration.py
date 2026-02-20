import asyncio
import sys
import os

# Set search path
sys.path.append(os.getcwd())

from services.openai_service import analyze_product

async def verify_openai():
    print("Verifying OpenAI Pipeline...")
    
    product = {
        "product_name": "Test Energy Drink",
        "ingredients_from_ocr": "Caffeine, Sugar, Carbonated Water, Taurine",
        "fssai_from_ocr": "10012022000590",
        "ocr_raw_text": "Caffeine content high. Not for children. FSSAI Lic No 10012022000590. Manufactured by Energy Corp, Bangalore."
    }
    
    try:
        print("1. Calling analyze_product (OpenAI)...")
        result = await analyze_product(product)
        print(f"Status: {result.get('ai_status')}")
        print(f"Risk: {result.get('ai_risk')}")
        print(f"Score: {result.get('ai_score')}")
        print(f"Violations: {result.get('ai_violations')}")
        
        # Validations
        assert "ai_status" in result
        assert "ai_risk" in result
        
        if result["ai_status"] == "Success":
            print("\n✅ OpenAI Integration Successful!")
        else:
            print("\n⚠️ OpenAI returned Fallback/Skip. Check API Key/Quota.")
            
    except Exception as e:
        print(f"\n❌ OpenAI Verification Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_openai())

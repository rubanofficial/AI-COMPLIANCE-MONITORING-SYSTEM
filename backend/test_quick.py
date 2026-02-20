import asyncio
import sys
import httpx

# Windows async fix
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def test_evaluate():
    """Quick test of the evaluate endpoint"""
    
    base_url = "http://127.0.0.1:8005"
    
    print(f"🔍 Testing evaluate endpoint at {base_url}")
    print(f"   Query: 'poha'\n")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # Test evaluate endpoint
            response = await client.post(f"{base_url}/evaluate?product_name=poha")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SUCCESS!")
                print(f"   Products analyzed: {data.get('products_analyzed', 0)}")
                
                if data.get('results'):
                    print(f"\n📦 Sample products:")
                    for i, result in enumerate(data['results'][:2], 1):
                        product = result.get('product', {})
                        compliance = result.get('compliance', {})
                        print(f"\n   {i}. {product.get('product_name', 'N/A')}")
                        print(f"      Platform: {product.get('platform', 'N/A')}")
                        print(f"      Price: ₹{product.get('price', 'N/A')}")
                        print(f"      Compliance Score: {compliance.get('score', 'N/A')}/100")
            else:
                print(f"❌ FAILED - Status {response.status_code}")
                print(f"   Response: {response.text[:300]}")
                
        except httpx.ReadTimeout:
            print(f"❌ TIMEOUT - Request took longer than 60 seconds")
        except Exception as e:
            print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_evaluate())

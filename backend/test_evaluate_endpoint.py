import asyncio
import sys
import httpx

# Windows async fix
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def test_evaluate():
    """Test the /evaluate endpoint directly"""
    
    # Find which port the server is running on by trying common ports
    ports_to_try = [8006, 8001, 8002, 8003, 8004]
    base_url = None
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for port in ports_to_try:
            try:
                test_url = f"http://127.0.0.1:{port}/dashboard/stats"
                response = await client.get(test_url)
                if response.status_code == 200:
                    base_url = f"http://127.0.0.1:{port}"
                    print(f"✓ Found server running on port {port}")
                    break
            except Exception:
                continue
        
        if not base_url:
            print("✗ Server not found on any port. Please start the server first:")
            print("  cd backend && python run.py")
            return
        
        # Test the evaluate endpoint
        print(f"\n🔍 Testing /evaluate endpoint with 'poha'...")
        evaluate_url = f"{base_url}/evaluate?product_name=poha"
        
        try:
            response = await client.post(evaluate_url)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Evaluation successful!")
                print(f"  Products analyzed: {data.get('products_analyzed', 0)}")
                
                if data.get('results'):
                    for i, result in enumerate(data['results'][:2], 1):
                        product = result.get('product', {})
                        compliance = result.get('compliance', {})
                        print(f"\n  Product {i}:")
                        print(f"    Name: {product.get('product_name', 'N/A')}")
                        print(f"    Platform: {product.get('platform', 'N/A')}")
                        print(f"    Compliance Score: {compliance.get('score', 'N/A')}")
            else:
                print(f"✗ Request failed with status {response.status_code}")
                print(f"  Response: {response.text[:500]}")
                
        except Exception as e:
            print(f"✗ Error testing endpoint: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_evaluate())

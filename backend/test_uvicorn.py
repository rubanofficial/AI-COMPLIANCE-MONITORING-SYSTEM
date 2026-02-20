import sys
print(f"Python: {sys.version}")

try:
    import uvicorn
    print(f"uvicorn version: {uvicorn.__version__}")
    
    # Test if loop parameter exists
    import inspect
    sig = inspect.signature(uvicorn.run)
    params = list(sig.parameters.keys())
    print(f"uvicorn.run parameters: {params}")
    
    if 'loop' in params:
        print("✓ 'loop' parameter EXISTS")
    else:
        print("✗ 'loop' parameter DOES NOT EXIST - this is the problem!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

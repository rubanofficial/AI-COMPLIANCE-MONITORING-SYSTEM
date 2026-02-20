import uvicorn
import sys
import asyncio

if __name__ == "__main__":
    # FIX: Force ProactorEventLoopPolicy on Windows for Playwright compatibility
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Run the application
    from main import app
    uvicorn.run(app, host="127.0.0.1", port=8000, loop="asyncio")

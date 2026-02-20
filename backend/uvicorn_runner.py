import sys
import asyncio
import logging

# Ensure Windows proactor policy for Playwright compatibility
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("uvicorn_runner")

try:
    from main import app
except Exception as e:
    logger.exception("Failed to import main.app")
    raise

if __name__ == '__main__':
    import uvicorn
    logger.info("Starting uvicorn with app from main.py")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="debug")

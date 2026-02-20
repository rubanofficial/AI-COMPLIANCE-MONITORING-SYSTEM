import asyncio
from playwright.async_api import async_playwright
import sys

# FIX: Force Proactor
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def main():
    print(f"Loop policy: {type(asyncio.get_event_loop_policy())}")
    print(f"Running loop: {type(asyncio.get_running_loop())}")
    try:
        async with async_playwright() as p:
            print("Launching browser...")
            browser = await p.chromium.launch(headless=True)
            print("Browser launched successfully!")
            await browser.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

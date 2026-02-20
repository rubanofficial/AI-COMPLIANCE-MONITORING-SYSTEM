import asyncio
from playwright.async_api import async_playwright
import sys

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def capture_blinkit():
    url = "https://www.blinkit.com/s/?q=milk"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        try:
            print(f"Navigating to {url}...")
            await page.goto(url, timeout=30000)
            await page.wait_for_timeout(5000) # Wait for content to load
            
            # Scroll down to trigger lazy loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)
            
            content = await page.content()
            with open("blinkit_debug.html", "w", encoding="utf-8") as f:
                f.write(content)
            print("Captured blinkit_debug.html")
            
            await page.screenshot(path="blinkit_debug.png")
            print("Captured blinkit_debug.png")
            
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(capture_blinkit())

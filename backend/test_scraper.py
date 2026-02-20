import asyncio
import sys
import json
import os

# FIX: Force Proactor on Windows
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from services.scraper.blinkit_live import scrape_blinkit_live
from services.scraper.zepto_live import scrape_zepto_live

async def main():
    results = {
        "blinkit": [],
        "zepto": []
    }
    
    print("Testing Blinkit Scraper...")
    try:
        results["blinkit"] = await scrape_blinkit_live("poha")
        print(f"Blinkit Results count: {len(results['blinkit'])}")
    except Exception:
        import traceback
        with open("traceback.log", "a") as f:
            f.write("Blinkit Error:\n")
            f.write(traceback.format_exc())
            f.write("\n")
        print("Blinkit failed.")

    print("\nTesting Zepto Scraper...")
    try:
        results["zepto"] = await scrape_zepto_live("poha")
        print(f"Zepto Results count: {len(results['zepto'])}")
    except Exception:
        import traceback
        with open("traceback.log", "a") as f:
            f.write("Zepto Error:\n")
            f.write(traceback.format_exc())
            f.write("\n")
        print("Zepto failed.")

    output_file = "scraper_results.json"
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=4)
        print(f"Results dumped to {os.path.abspath(output_file)}")
    except Exception as e:
        print(f"Failed to dump results: {e}")

if __name__ == "__main__":
    asyncio.run(main())

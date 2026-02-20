from services.scraper.blinkit_deep import scrape_blinkit_deep
from services.scraper.zepto_deep import scrape_zepto_deep
import re
from urllib.parse import urlparse, unquote

# Patterns that indicate a non-product entry
INVALID_PRODUCT_PATTERNS = [
    r"^showing results for",
    r"^results for",
    r"^search results",
    r"^no results",
    r"^did you mean",
    r"^all products",
    r"^category:",
    r"^filter",
    r"^sort by",
]

def extract_search_query(input_string: str) -> tuple:
    """
    Extracts search query and platform info from URL or plain text input.
    Returns: (search_query, direct_url, platform)
    """
    # Check if input is a URL
    if input_string.startswith('http://') or input_string.startswith('https://'):
        parsed = urlparse(input_string)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()
        
        # Detect platform
        platform = None
        if 'blinkit' in domain or 'grofers' in domain:
            platform = 'blinkit'
        elif 'zepto' in domain:
            platform = 'zepto'
        elif 'swiggy' in domain:
            platform = 'swiggy'
        
        # Check if it's a direct product page
        if platform == 'blinkit' and ('/prn/' in path or '/product/' in path):
            # Direct Blinkit product URL
            return None, input_string, 'blinkit'
        
        if platform == 'zepto' and '/pn/' in path:
            # Direct Zepto product URL
            return None, input_string, 'zepto'
        
        # Try to extract product name from URL path
        path_parts = [p for p in path.split('/') if p and p not in ['s', 'search', 'prn', 'pn', 'product']]
        if path_parts:
            # Clean up URL-encoded characters and dashes
            query = unquote(path_parts[-1]).replace('-', ' ').replace('_', ' ')
            return query, None, platform
        
        # Check query parameters
        if parsed.query:
            query_params = dict(qc.split('=') for qc in parsed.query.split('&') if '=' in qc)
            if 'q' in query_params or 'query' in query_params:
                query = unquote(query_params.get('q') or query_params.get('query', ''))
                return query, None, platform
    
    # Not a URL, treat as plain search query
    return input_string, None, None

def is_valid_product(product: dict) -> bool:
    """
    Returns True if the product looks like a real purchasable item.
    Filters out search headers, category titles, and junk entries.
    """
    name = (product.get("product_name") or product.get("name") or "").strip()

    if not name or len(name) < 3:
        return False

    name_lower = name.lower()
    for pattern in INVALID_PRODUCT_PATTERNS:
        if re.search(pattern, name_lower):
            return False

    # Must have at least a price or MRP to be a real product
    has_price = bool(product.get("price") and str(product.get("price")).strip() not in ("N/A", "", "0"))
    has_mrp   = bool(product.get("mrp")   and str(product.get("mrp")).strip() not in ("N/A", "", "0"))
    
    if not has_price and not has_mrp:
        return False

    return True


async def scrape_all(product_input: str):
    """
    Orchestrates deep scraping across Blinkit and Zepto.
    Handles both URLs and plain search queries.
    Filters invalid entries and caps at top 3 per platform.
    """
    import asyncio

    print(f"\n🔍 Deep scraping for: {product_input}")
    print("=" * 60)
    
    # Parse input to determine if it's a URL or search query
    search_query, direct_url, detected_platform = extract_search_query(product_input)
    
    if direct_url:
        print(f"  🔗 Detected direct product URL for {detected_platform}")
        print(f"  📄 Navigating to: {direct_url}")
    else:
        print(f"  🔎 Search query: '{search_query}'")
        if detected_platform:
            print(f"  🎯 Target platform: {detected_platform}")
    
    # Determine which scrapers to run
    tasks = []
    
    if detected_platform == 'blinkit' and direct_url:
        # Only scrape Blinkit with direct URL
        tasks.append(scrape_blinkit_deep(direct_url, is_direct_url=True))
    elif detected_platform == 'zepto' and direct_url:
        # Only scrape Zepto with direct URL
        tasks.append(scrape_zepto_deep(direct_url, is_direct_url=True))
    elif detected_platform == 'blinkit':
        # Search only on Blinkit
        tasks.append(scrape_blinkit_deep(search_query))
    elif detected_platform == 'zepto':
        # Search only on Zepto
        tasks.append(scrape_zepto_deep(search_query))
    else:
        # Search on all platforms
        tasks.append(scrape_blinkit_deep(search_query or product_input))
        tasks.append(scrape_zepto_deep(search_query or product_input))
    
    # Run scrapers
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Combine and filter results
    all_products = []

    for platform_results in results:
        if isinstance(platform_results, list):
            valid = [p for p in platform_results if is_valid_product(p)]
            all_products.extend(valid[:3])          # Top 3 per platform
        elif isinstance(platform_results, Exception):
            print(f"⚠️  Platform error: {platform_results}")

    print(f"\n✓ Real products scraped and validated: {len(all_products)}")
    print("=" * 60)

    return all_products

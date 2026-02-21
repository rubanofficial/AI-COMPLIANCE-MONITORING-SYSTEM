import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Scraping limits
MAX_PRODUCTS = 5  # max products per platform for live scraping
MAX_DEEP_PRODUCTS = 3  # max products to deep-scrape for compliance

#!/usr/bin/env python
"""Simple test script to diagnose import issues"""

import sys
import traceback

print("=" * 60)
print("TESTING IMPORTS")
print("=" * 60)

# Test 1: Basic imports
try:
    print("\n1. Testing FastAPI...")
    from fastapi import FastAPI
    print("   ✓ FastAPI imported successfully")
except Exception as e:
    print(f"   ✗ FastAPI failed: {e}")
    traceback.print_exc()

# Test 2: Uvicorn
try:
    print("\n2. Testing uvicorn...")
    import uvicorn
    print(f"   ✓ uvicorn imported successfully (version: {uvicorn.__version__})")
except Exception as e:
    print(f"   ✗ uvicorn failed: {e}")
    traceback.print_exc()

# Test 3: Playwright
try:
    print("\n3. Testing Playwright...")
    from playwright.async_api import async_playwright
    print("   ✓ Playwright imported successfully")
except Exception as e:
    print(f"   ✗ Playwright failed: {e}")
    traceback.print_exc()

# Test 4: EasyOCR
try:
    print("\n4. Testing EasyOCR...")
    import easyocr
    print("   ✓ EasyOCR imported successfully (NOT initializing reader)")
except Exception as e:
    print(f"   ✗ EasyOCR failed: {e}")
    traceback.print_exc()

# Test 5: Our services
try:
    print("\n5. Testing services.ocr_service...")
    from services.ocr_service import get_reader
    print("   ✓ OCR service imported successfully (reader not yet initialized)")
except Exception as e:
    print(f"   ✗ OCR service failed: {e}")
    traceback.print_exc()

# Test 6: Main app
try:
    print("\n6. Testing main app...")
    from main import app
    print("   ✓ Main app imported successfully")
except Exception as e:
    print(f"   ✗ Main app failed: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
print("IMPORT TESTING COMPLETE")
print("=" * 60)

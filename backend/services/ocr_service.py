import easyocr
import cv2
import numpy as np
import httpx
import asyncio
import re
import logging
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OCR_Service")

# Initialize EasyOCR Reader (Loaded once to save memory/time)
# Includes English as the primary language
reader = easyocr.Reader(['en'], gpu=False) # gpu=True if CUDA is available

async def download_image(client: httpx.AsyncClient, url: str) -> bytes:
    """Download image asynchronously, skipping placeholders and retrying on failure."""
    if not url or "placeholder" in url.lower() or "via.placeholder.com" in url:
        logger.info(f"Skipping placeholder image: {url}")
        return None
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.google.com"
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.get(url, headers=headers, timeout=15.0)
            response.raise_for_status()
            return response.content
        except (httpx.ConnectError, httpx.ConnectTimeout) as dns_err:
            logger.warning(f"DNS/Connection error for {url} (Attempt {attempt+1}/{max_retries}): {dns_err}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt) # Exponential backoff
        except Exception as e:
            logger.error(f"Failed to download image {url}: {str(e)[:100]}")
            break
    
    logger.error(f"Failed to download image {url} after {max_retries} attempts.")
    return None

def preprocess_image(image_bytes: bytes):
    """
    Grayscale + Sharpening for better OCR results.
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None

        # 1. Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 2. Sharpening using a kernel
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(gray, -1, kernel)

        return sharpened
    except Exception as e:
        logger.error(f"Image preprocessing error: {e}")
        return None

async def extract_text_from_image(image_bytes: bytes):
    """
    Apply EasyOCR on preprocessed image.
    Returns: (consolidated_text, average_confidence)
    """
    try:
        processed_img = preprocess_image(image_bytes)
        if processed_img is None:
            return "", 0.0

        # OCR execution
        # detail=1 returns bounding box, text, and confidence
        results = reader.readtext(processed_img, detail=1)
        
        if not results:
            return "", 0.0

        texts = [res[1] for res in results]
        confidences = [res[2] for res in results]
        
        consolidated = " ".join(texts)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        
        return consolidated, avg_conf
    except Exception as e:
        logger.error(f"OCR execution error: {e}")
        return "", 0.0

async def perform_ocr_on_images(image_urls: list[str]) -> dict:
    """
    Main entry point for the FastAPI service.
    Downloads, preprocesses, and extracts text from multiple images.
    Returns: Structured dictionary with combined text and average confidence.
    """
    if not image_urls:
        return {"raw_text": "", "avg_confidence": 0.0}

    logger.info(f"Starting OCR on {len(image_urls)} images...")
    
    async with httpx.AsyncClient() as client:
        # Download all images concurrently - process ALL images, not just first 5
        max_images = min(len(image_urls), 10)  # Increased from 5 to 10
        download_tasks = [download_image(client, url) for url in image_urls[:max_images]]
        image_contents = await asyncio.gather(*download_tasks)
        
        # Filter out failed downloads or skipped placeholders
        valid_contents = [content for content in image_contents if content]
        
        if not valid_contents:
            logger.warning("No valid images for OCR.")
            return {"raw_text": "", "avg_confidence": 0.0}

        logger.info(f"Processing {len(valid_contents)} valid images with OCR...")
        ocr_text_results = []
        confidences = []
        
        for idx, content in enumerate(valid_contents, 1):
            logger.info(f"  OCR processing image {idx}/{len(valid_contents)}")
            text, conf = await extract_text_from_image(content)
            if text:
                ocr_text_results.append(text)
                confidences.append(conf)
        
        combined_text = "\n---\n".join(ocr_text_results)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        
        logger.info(f"OCR Complete. Extracted {len(combined_text)} characters from {len(ocr_text_results)} images")
        return {
            "raw_text": combined_text,
            "avg_confidence": avg_conf
        }

def extract_compliance_data_rules(ocr_result: dict) -> dict:
    """
    Enhanced Regex-based extraction from EasyOCR result.
    Extracts: FSSAI, Ingredients, Manufacturer, Expiry Date, etc.
    """
    text = ocr_result.get("raw_text", "")
    data = {
        "fssai_from_ocr": "N/A",
        "ingredients_from_ocr": "N/A",
        "manufacturer_name_from_ocr": "N/A",
        "manufacturer_address_from_ocr": "N/A",
        "expiry_from_ocr": "N/A",
        "ocr_confidence": ocr_result.get("avg_confidence", 0.0)
    }

    if not text:
        return data

    # Clean text for better matching
    text_cleaned = text.replace('\n', ' ').replace('  ', ' ')
    
    # 1. FSSAI Number: Exactly 14 digits, handle OCR errors (O->0, I->1, l->1)
    fssai_text = text.replace('O', '0').replace('I', '1').replace('l', '1').replace('o', '0')
    fssai_patterns = [
        r'FSSAI[^0-9]{0,10}(\d{14})',  # FSSAI followed by 14 digits
        r'Lic(?:ense)?[^0-9]{0,10}(\d{14})',  # License number
        r'\b(1\d{13})\b',  # Just 14 digits starting with 1
    ]
    for pattern in fssai_patterns:
        fssai_match = re.search(pattern, fssai_text, re.IGNORECASE)
        if fssai_match:
            data["fssai_from_ocr"] = fssai_match.group(1)
            break

    # 2. Ingredients: Look for 'Ingredients' followed by list
    ingredients_patterns = [
        r'Ingredients?[:\s-]+(.*?)(?:Nutritional|Allergen|Best Before|Expiry|Manufacturer|Mfd|Net|$)',
        r'INGREDIENTS?[:\s-]+(.*?)(?:NUTRITIONAL|ALLERGEN|BEST BEFORE|EXPIRY|MFD|NET|$)',
    ]
    for pattern in ingredients_patterns:
        ingredients_match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if ingredients_match:
            ingredients_text = ingredients_match.group(1).strip()
            # Clean up
            ingredients_text = re.sub(r'\s+', ' ', ingredients_text)
            data["ingredients_from_ocr"] = ingredients_text[:500]
            break

    # 3. Manufacturer Name & Address
    mfr_patterns = [
        r'(?:Manufactured|Mfd|Marketed|Mktd|Packed|Produced)\s+(?:by|By|BY)[:\s-]+(.*?)(?:FSSAI|Lic|Batch|Ingredients|Best Before|Expiry|$)',
        r'(?:MFD|MKTD|PKD)\s*(?:BY)?[:\s-]+(.*?)(?:FSSAI|LIC|BATCH|INGREDIENTS|BEST|EXPIRY|$)',
    ]
    for pattern in mfr_patterns:
        mfr_match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if mfr_match:
            full_mfr_text = mfr_match.group(1).strip()
            # Clean up extra whitespace
            full_mfr_text = re.sub(r'\s+', ' ', full_mfr_text)
            
            # Try to split name and address (usually separated by comma or newline in OCR)
            parts = re.split(r'\s*[,\n]\s*', full_mfr_text, 1)
            data["manufacturer_name_from_ocr"] = parts[0].strip()[:200]
            if len(parts) > 1:
                data["manufacturer_address_from_ocr"] = parts[1].strip()[:300]
            break

    # 4. Expiry / Best Before / Shelf Life - Multiple patterns
    expiry_patterns = [
        # Pattern: "Best Before: 12 months from mfg"
        r'(?:Best Before|BB|USE BY|USE BEFORE)[:\s-]+(\d+\s*(?:days?|months?|years?).*?)(?:\.|,|\n|$)',
        # Pattern: "Expiry: DD/MM/YYYY"
        r'(?:Expiry|Exp Date|EXP)[:\s-]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        # Pattern: "Best Before DD/MM/YYYY"
        r'(?:Best Before|BB)[:\s-]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        # Pattern: Just date
        r'(?:BB|EXP)[:\s-]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        # Pattern: "Shelf Life: 12 months"
        r'(?:Shelf Life|Shelf life)[:\s-]+(\d+\s*(?:days?|months?|years?))',
        # Pattern: Month and Year format "Mar 2026"
        r'(?:Best Before|BB|EXP)[:\s-]+([A-Za-z]{3,9}\s+\d{4})',
        # Pattern: "See on package" or "See on cap"
        r'(?:Best Before|Expiry)[:\s-]+(See\s+(?:on|at)\s+.*?)(?:\.|,|\n|$)',
    ]
    
    for pattern in expiry_patterns:
        expiry_match = re.search(pattern, text, re.IGNORECASE)
        if expiry_match:
            expiry_text = expiry_match.group(1).strip()
            # Clean up
            expiry_text = re.sub(r'\s+', ' ', expiry_text)
            data["expiry_from_ocr"] = expiry_text[:150]
            break
    
    # If still not found, try very loose date pattern anywhere in text
    if data["expiry_from_ocr"] == "N/A":
        loose_date = re.search(r'\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b', text)
        if loose_date:
            data["expiry_from_ocr"] = loose_date.group(1)

    return data

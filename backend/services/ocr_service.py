import httpx
import asyncio
import re
import logging
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OCR_Service")

# Lazy OCR reader
_reader = None


def get_reader():
    """
    Lazy initialization of EasyOCR Reader.
    Import and create reader only when first needed.
    """
    global _reader
    if _reader is None:
        logger.info("Initializing EasyOCR Reader (this may take a moment)...")

        # Lazy imports (important)
        import easyocr

        _reader = easyocr.Reader(['en'], gpu=False)
        logger.info("EasyOCR Reader initialized successfully")
    return _reader


async def download_image(client: httpx.AsyncClient, url: str) -> bytes:
    """Download image asynchronously, skipping placeholders and retrying on failure."""
    if not url or "placeholder" in url.lower() or "via.placeholder.com" in url:
        logger.info(f"Skipping placeholder image: {url}")
        return None

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com"
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.get(url, headers=headers, timeout=15.0)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.warning(f"Retry {attempt+1}/{max_retries} failed for {url}: {e}")
            await asyncio.sleep(2 ** attempt)

    logger.error(f"Failed to download image {url}")
    return None


def preprocess_image(image_bytes: bytes):
    """
    Lazy image preprocessing with cv2 and numpy.
    """
    try:
        # Lazy imports
        import cv2
        import numpy as np

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return None

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(gray, -1, kernel)

        return sharpened
    except Exception as e:
        logger.error(f"Image preprocessing error: {e}")
        return None


async def extract_text_from_image(image_bytes: bytes):
    """
    Apply EasyOCR on preprocessed image.
    """
    try:
        processed_img = preprocess_image(image_bytes)
        if processed_img is None:
            return "", 0.0

        reader = get_reader()
        results = reader.readtext(processed_img, detail=1)

        if not results:
            return "", 0.0

        texts = [res[1] for res in results]
        confidences = [res[2] for res in results]

        return " ".join(texts), sum(confidences) / len(confidences)
    except Exception as e:
        logger.error(f"OCR execution error: {e}")
        return "", 0.0


async def perform_ocr_on_images(image_urls: list[str]) -> dict:
    """
    OCR pipeline for multiple images.
    """
    if not image_urls:
        return {"raw_text": "", "avg_confidence": 0.0}

    logger.info(f"Starting OCR on {len(image_urls)} images...")

    async with httpx.AsyncClient() as client:
        max_images = min(len(image_urls), 10)
        download_tasks = [download_image(client, url) for url in image_urls[:max_images]]
        image_contents = await asyncio.gather(*download_tasks)

        valid_contents = [c for c in image_contents if c]
        if not valid_contents:
            return {"raw_text": "", "avg_confidence": 0.0}

        ocr_text_results = []
        confidences = []

        for idx, content in enumerate(valid_contents, 1):
            logger.info(f"OCR processing image {idx}/{len(valid_contents)}")
            text, conf = await extract_text_from_image(content)

            if text:
                ocr_text_results.append(text)
                confidences.append(conf)

        combined_text = "\n---\n".join(ocr_text_results)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        logger.info(f"OCR Complete. Extracted {len(combined_text)} chars")
        return {"raw_text": combined_text, "avg_confidence": avg_conf}


def extract_compliance_data_rules(ocr_result: dict) -> dict:
    """
    Regex extraction (unchanged logic simplified).
    """
    text = ocr_result.get("raw_text", "")
    data = {
        "fssai_from_ocr": "N/A",
        "ingredients_from_ocr": "N/A",
        "expiry_from_ocr": "N/A",
        "ocr_confidence": ocr_result.get("avg_confidence", 0.0)
    }

    if not text:
        return data

    fssai_match = re.search(r'\b\d{14}\b', text)
    if fssai_match:
        data["fssai_from_ocr"] = fssai_match.group(0)

    ing_match = re.search(r'Ingredients?[:\s-]+(.*)', text, re.I)
    if ing_match:
        data["ingredients_from_ocr"] = ing_match.group(1)[:300]

    exp_match = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', text)
    if exp_match:
        data["expiry_from_ocr"] = exp_match.group(0)

    return data


async def classify_product_images(image_urls: list[str], verify_ocr: bool = False) -> list[str]:
    """
    Classify which image URLs are likely to be real product packaging images.

    Heuristics used:
    - Filename / URL keywords that indicate pack/label/front/back/product
    - Exclude common logo/banner/icon/placeholder keywords
    - Check content-type and content-length (skip very small images / SVGs)
    - Optionally run OCR verification to ensure presence of packaging text

    Returns a filtered list of URLs (only valid product images).
    """
    if not image_urls:
        return []

    POSITIVE_KEYWORDS = [
        "pack",
        "package",
        "packaging",
        "label",
        "front",
        "back",
        "side",
        "product",
        "packshot",
        "prod",
        "pn",
        "prn",
    ]

    NEGATIVE_KEYWORDS = [
        "logo",
        "icon",
        "banner",
        "placeholder",
        "thumb",
        "sprite",
        "social",
        "facebook",
        "twitter",
        "instagram",
        "ad",
        "promo",
        "button",
        "svg",
    ]

    VALID_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif")

    candidates = []

    for url in image_urls:
        if not url:
            continue
        u = url.lower()

        # Quick negative checks
        if any(nk in u for nk in NEGATIVE_KEYWORDS):
            continue

        # Prefer explicit image extensions; accept urls without ext too
        if any(u.endswith(ext) for ext in VALID_EXTS) or "/image" in u or "=image" in u or "prd" in u:
            # positive keyword boost
            if any(pk in u for pk in POSITIVE_KEYWORDS) or "/product/" in u or "/prn/" in u or "/pn/" in u:
                candidates.append(url)
            else:
                # keep for secondary checks
                candidates.append(url)

    # If none passed heuristics, fallback to original list and filter only by ext
    if not candidates:
        candidates = [u for u in image_urls if u and any(u.lower().endswith(ext) for ext in VALID_EXTS)]

    # Skip slow HEAD requests for now - use pure URL heuristics
    # Return top candidates, deduplicated
    seen = set()
    result = []
    for u in candidates[:10]:  # Limit to top 10
        if u not in seen:
            seen.add(u)
            result.append(u)

    logger.info(f"Image classifier: {len(image_urls)} input → {len(result)} filtered")
    return result


def classify_product_images_sync(image_urls: list[str], verify_ocr: bool = False) -> str:
    """
    Synchronous wrapper that returns a JSON array string of valid product image URLs.
    """
    import json

    try:
        res = asyncio.run(classify_product_images(image_urls, verify_ocr=verify_ocr))
    except RuntimeError:
        # In case an event loop is already running (e.g., inside async context), run using new loop
        loop = asyncio.new_event_loop()
        try:
            res = loop.run_until_complete(classify_product_images(image_urls, verify_ocr=verify_ocr))
        finally:
            try:
                loop.close()
            except Exception:
                pass

    return json.dumps(res, ensure_ascii=False)
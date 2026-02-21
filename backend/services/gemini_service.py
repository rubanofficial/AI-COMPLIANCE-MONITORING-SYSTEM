import asyncio
import os
import json
import logging
import re

from dotenv import load_dotenv

# Ensure .env is loaded before anything reads env vars
load_dotenv()

logger = logging.getLogger("GeminiService")

# ── google-generativeai SDK (pip install google-generativeai) ──
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
    logger.info("google-generativeai SDK loaded successfully.")
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-generativeai not installed. Run: pip install google-generativeai")

# Module-level model — created once
_gemini_model = None


def _get_gemini_model():
    """Get or create the Gemini GenerativeModel (singleton)."""
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("    ❌ [Gemini] GEMINI_API_KEY is missing in .env")
        return None
    if not GENAI_AVAILABLE:
        print("    ❌ [Gemini] google-generativeai SDK not installed")
        return None

    genai.configure(api_key=api_key)

    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
    }

    _gemini_model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=generation_config,
    )
    print("    ✅ [Gemini] Model initialized successfully (gemini-2.5-flash)")
    return _gemini_model


def _build_compliance_prompt(product: dict) -> str:
    """Build a detailed compliance analysis prompt for Gemini."""
    name = product.get("product_name") or product.get("name", "Unknown")
    price = product.get("price", "N/A")
    mrp = product.get("mrp", "N/A")
    weight = product.get("weight", "N/A")
    ingredients = product.get("ingredients", "N/A")
    fssai = product.get("fssai_number", "N/A")
    manufacturer = product.get("manufacturer_name", "N/A")
    manufacturer_addr = product.get("manufacturer_address", "N/A")
    expiry = product.get("expiry_date", "N/A")
    platform = product.get("platform", "unknown")
    description = product.get("description", "N/A")

    return f"""You are an Indian food safety & regulatory compliance expert. Analyze this product listing from an e-commerce platform for FSSAI and legal compliance.

PRODUCT DATA:
- Name: {name}
- Platform: {platform}
- Price: ₹{price}
- MRP: ₹{mrp}
- Weight/Quantity: {weight}
- Ingredients: {ingredients}
- FSSAI License Number: {fssai}
- Manufacturer: {manufacturer}
- Manufacturer Address: {manufacturer_addr}
- Expiry/Best Before: {expiry}
- Description: {description}

ANALYZE FOR:
1. FSSAI license validity (must be 14 digits for food products)
2. Mandatory label declarations (ingredients, allergens, nutritional info)
3. MRP vs selling price compliance (selling price must not exceed MRP)
4. Weight/quantity declaration accuracy
5. Manufacturer details completeness
6. Expiry date / shelf life presence
7. Misleading claims or missing mandatory info
8. Any other Indian food safety regulation violations

RESPOND IN THIS EXACT JSON FORMAT ONLY (no markdown, no code blocks, no extra text):
{{
  "ai_score": <number 0-100>,
  "ai_risk": "<Low|Medium|High>",
  "summary": "<2-3 sentence compliance summary>",
  "detailed_insights": "<detailed analysis paragraph>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "ai_violations": [
    {{
      "id": "<violation_id>",
      "rule": "<rule name>",
      "message": "<violation description>",
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "field": "<affected field or null>"
    }}
  ]
}}
"""


def _parse_gemini_response(raw_text: str) -> dict:
    """Robustly parse Gemini's JSON response, handling markdown fences and extra text."""
    cleaned = raw_text.strip()

    # Remove markdown code fences
    if "```" in cleaned:
        # Extract content between first ``` and last ```
        match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1).strip()

    # Try direct JSON parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object in the text
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("Could not extract valid JSON from Gemini response", cleaned, 0)


async def analyze_product_with_gemini(product: dict, deep_scrape_available: bool = True) -> dict:
    """
    Analyze a product using Gemini AI for compliance scoring.
    Uses google-generativeai SDK (synchronous) wrapped in asyncio.to_thread.
    Falls back to rule-based analysis if Gemini is unavailable.
    """
    product_name = product.get("product_name") or product.get("name", "Unknown")

    model = _get_gemini_model()
    if model is not None:
        try:
            print(f"    🤖 [Gemini] Sending product for AI analysis: {product_name[:50]}")

            prompt = _build_compliance_prompt(product)

            # Use synchronous generate_content in a thread to keep async compatibility
            response = await asyncio.to_thread(model.generate_content, prompt)

            raw_text = response.text.strip()
            print(f"    🤖 [Gemini] Received response ({len(raw_text)} chars)")

            result = _parse_gemini_response(raw_text)

            # Validate and normalize
            ai_score = max(0, min(100, int(result.get("ai_score", 50))))
            ai_risk = result.get("ai_risk", "Medium")
            if ai_risk not in ("Low", "Medium", "High"):
                ai_risk = "Medium"

            violations = result.get("ai_violations", [])
            for v in violations:
                sev = str(v.get("severity", "MEDIUM")).upper()
                if sev not in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                    v["severity"] = "MEDIUM"

            print(f"    ✅ [Gemini] AI Score: {ai_score}, Risk: {ai_risk}, Violations: {len(violations)}")

            return {
                "ai_score": ai_score,
                "ai_risk": ai_risk,
                "ai_violations": violations,
                "ai_status": "Gemini Analysis Complete",
                "summary": result.get("summary", "Analysis complete."),
                "detailed_insights": result.get("detailed_insights", ""),
                "recommendations": result.get("recommendations", []),
            }

        except json.JSONDecodeError as je:
            print(f"    ⚠️ [Gemini] JSON parse error: {je}")
            print(f"    ⚠️ [Gemini] Raw response preview: {raw_text[:300]}")
        except Exception as e:
            print(f"    ⚠️ [Gemini] API error ({type(e).__name__}): {e}")

    # Fallback: smart rule-based analysis
    print(f"    🔧 [Fallback] Using rule-based AI analysis for: {product_name[:50]}")
    return _fallback_analysis(product, deep_scrape_available=deep_scrape_available)


def _fallback_analysis(product: dict, deep_scrape_available: bool = True) -> dict:
    """Fallback analysis when Gemini is unavailable.
    When deep_scrape_available=False, only scores on basic listing fields."""
    violations = []
    score = 100
    recommendations = []

    name = product.get("product_name") or product.get("name", "N/A")
    price = product.get("price", "N/A")
    weight = product.get("weight", "N/A")
    fssai = product.get("fssai_number", "N/A")
    ingredients = product.get("ingredients", "N/A")
    manufacturer = product.get("manufacturer_name", "N/A")
    expiry = product.get("expiry_date", "N/A")

    # Basic listing checks (always apply)
    if not name or str(name).strip() in ("", "N/A"):
        violations.append({
            "id": "AI_NAME_001", "rule": "Product Name Verification",
            "message": "Product name is missing from listing",
            "severity": "HIGH", "field": "name"
        })
        score -= 15

    # Check price is a valid number
    price_valid = False
    if price and str(price).strip() not in ("", "N/A"):
        try:
            float(str(price).replace(",", ""))
            price_valid = True
        except ValueError:
            pass

    if not price_valid:
        violations.append({
            "id": "AI_PRICE_001", "rule": "Price Verification",
            "message": "Price information is missing or invalid on listing",
            "severity": "MEDIUM", "field": "price"
        })
        score -= 10

    if not weight or str(weight).strip() in ("", "N/A"):
        violations.append({
            "id": "AI_WEIGHT_001", "rule": "Weight Declaration",
            "message": "Weight/quantity not declared on listing",
            "severity": "MEDIUM", "field": "weight"
        })
        score -= 10
        recommendations.append("Ensure weight/quantity is clearly stated on the listing")

    # Regulatory checks — only penalize if deep scrape was available
    if fssai == "N/A" or not fssai:
        if deep_scrape_available:
            violations.append({
                "id": "AI_FSSAI_001", "rule": "FSSAI License Verification",
                "message": "FSSAI license number not found on product listing - mandatory for all food products in India",
                "severity": "CRITICAL", "field": "fssai_number"
            })
            score -= 20
            recommendations.append("Ensure FSSAI license number (14 digits) is prominently displayed on the product listing")
        else:
            recommendations.append("FSSAI license could not be verified (detail page unavailable) — check product packaging")

    if ingredients == "N/A" or not ingredients or len(str(ingredients)) < 10:
        if deep_scrape_available:
            violations.append({
                "id": "AI_ING_001", "rule": "Ingredient Declaration",
                "message": "Ingredient list is missing or incomplete - required under FSSAI regulations",
                "severity": "HIGH", "field": "ingredients"
            })
            score -= 15
            recommendations.append("Complete ingredient list with allergen information must be provided")
        else:
            recommendations.append("Ingredients could not be verified (detail page unavailable) — check product label")

    if manufacturer == "N/A" or not manufacturer:
        if deep_scrape_available:
            violations.append({
                "id": "AI_MFG_001", "rule": "Manufacturer Information",
                "message": "Manufacturer details not available on the product listing",
                "severity": "HIGH", "field": "manufacturer_name"
            })
            score -= 10
            recommendations.append("Add complete manufacturer/packer name and address")
        else:
            recommendations.append("Manufacturer info could not be verified (detail page unavailable)")

    if expiry == "N/A" or not expiry:
        if deep_scrape_available:
            violations.append({
                "id": "AI_EXP_001", "rule": "Expiry Date Declaration",
                "message": "Expiry or best-before date not found on the listing",
                "severity": "MEDIUM", "field": "expiry_date"
            })
            score -= 10
            recommendations.append("Display clear expiry date or best-before information")
        else:
            recommendations.append("Expiry date could not be verified (detail page unavailable)")

    if not recommendations:
        recommendations = [
            "Continue maintaining good compliance practices",
            "Regularly verify FSSAI license renewal dates",
            "Ensure allergen warnings are prominently displayed"
        ]

    score = max(0, min(100, score))
    risk = "Low" if score >= 80 else "Medium" if score >= 50 else "High"

    deep_note = "" if deep_scrape_available else " Based on listing data only (product detail page was not accessible)."

    return {
        "ai_score": score,
        "ai_risk": risk,
        "ai_violations": violations,
        "ai_status": "Fallback Analysis (Gemini Unavailable)",
        "summary": f"Compliance score: {score}/100 — {len(violations)} issue(s) found.{deep_note}",
        "detailed_insights": f"The product was evaluated against Indian food safety regulations. {len(violations)} potential compliance issues were identified.{deep_note}",
        "recommendations": recommendations,
    }

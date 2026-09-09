/**
 * AI Service — equivalent to services/gemini_service.py + openai_service.py
 * Uses Google Gemini REST API. Falls back to rule-based analysis if unavailable.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';

function buildCompliancePrompt(product) {
  const name = product.product_name || product.name || 'Unknown';
  const price = product.price || 'N/A';
  const mrp = product.mrp || 'N/A';
  const weight = product.weight || 'N/A';
  const ingredients = product.ingredients || 'N/A';
  const fssai = product.fssai_number || 'N/A';
  const manufacturer = product.manufacturer_name || 'N/A';
  const manufacturerAddr = product.manufacturer_address || 'N/A';
  const expiry = product.expiry_date || 'N/A';
  const platform = product.platform || 'unknown';
  const description = product.description || 'N/A';

  return `You are an Indian food safety & regulatory compliance expert. Analyze this product listing from an e-commerce platform for FSSAI and legal compliance.

PRODUCT DATA:
- Name: ${name}
- Platform: ${platform}
- Price: ₹${price}
- MRP: ₹${mrp}
- Weight/Quantity: ${weight}
- Ingredients: ${ingredients}
- FSSAI License Number: ${fssai}
- Manufacturer: ${manufacturer}
- Manufacturer Address: ${manufacturerAddr}
- Expiry/Best Before: ${expiry}
- Description: ${description}

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
{
  "ai_score": <number 0-100>,
  "ai_risk": "<Low|Medium|High>",
  "summary": "<2-3 sentence compliance summary>",
  "detailed_insights": "<detailed analysis paragraph>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "ai_violations": [
    {
      "id": "<violation_id>",
      "rule": "<rule name>",
      "message": "<violation description>",
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "field": "<affected field or null>"
    }
  ]
}`;
}

function parseGeminiResponse(rawText) {
  let cleaned = rawText.trim();

  // Remove markdown code fences
  if (cleaned.includes('```')) {
    const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match) cleaned = match[1].trim();
  }

  // Try direct JSON parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Could not extract valid JSON from Gemini response');
  }
}

async function analyzeWithGemini(product, deepScrapeAvailable = true) {
  const productName = product.product_name || product.name || 'Unknown';

  if (GEMINI_API_KEY) {
    try {
      console.log(`    🤖 [Gemini] Sending product for AI analysis: ${productName.slice(0, 50)}`);

      const prompt = buildCompliancePrompt(product);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`    🤖 [Gemini] Received response (${rawText.length} chars)`);

      const result = parseGeminiResponse(rawText);

      // Validate and normalize
      let aiScore = Math.max(0, Math.min(100, parseInt(result.ai_score || 50, 10)));
      let aiRisk = result.ai_risk || 'Medium';
      if (!['Low', 'Medium', 'High'].includes(aiRisk)) aiRisk = 'Medium';

      const violations = result.ai_violations || [];
      for (const v of violations) {
        const sev = String(v.severity || 'MEDIUM').toUpperCase();
        if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev)) {
          v.severity = 'MEDIUM';
        }
      }

      console.log(`    ✅ [Gemini] AI Score: ${aiScore}, Risk: ${aiRisk}, Violations: ${violations.length}`);

      return {
        ai_score: aiScore,
        ai_risk: aiRisk,
        ai_violations: violations,
        ai_status: 'Gemini Analysis Complete',
        summary: result.summary || 'Analysis complete.',
        detailed_insights: result.detailed_insights || '',
        recommendations: result.recommendations || [],
      };
    } catch (err) {
      console.log(`    ⚠️ [Gemini] Error: ${err.message}`);
    }
  }

  // Fallback: rule-based analysis
  console.log(`    🔧 [Fallback] Using rule-based AI analysis for: ${productName.slice(0, 50)}`);
  return fallbackAnalysis(product, deepScrapeAvailable);
}

function fallbackAnalysis(product, deepScrapeAvailable = true) {
  const violations = [];
  let score = 100;
  const recommendations = [];

  const name = product.product_name || product.name || 'N/A';
  const price = product.price || 'N/A';
  const weight = product.weight || 'N/A';
  const fssai = product.fssai_number || 'N/A';
  const ingredients = product.ingredients || 'N/A';
  const manufacturer = product.manufacturer_name || 'N/A';
  const expiry = product.expiry_date || 'N/A';

  // Basic listing checks
  if (!name || String(name).trim() === '' || String(name).trim() === 'N/A') {
    violations.push({
      id: 'AI_NAME_001', rule: 'Product Name Verification',
      message: 'Product name is missing from listing',
      severity: 'HIGH', field: 'name',
    });
    score -= 15;
  }

  // Check price is valid
  let priceValid = false;
  if (price && String(price).trim() !== '' && String(price).trim() !== 'N/A') {
    try { parseFloat(String(price).replace(/,/g, '')); priceValid = true; } catch { /* ignore */ }
  }
  if (!priceValid) {
    violations.push({
      id: 'AI_PRICE_001', rule: 'Price Verification',
      message: 'Price information is missing or invalid on listing',
      severity: 'MEDIUM', field: 'price',
    });
    score -= 10;
  }

  if (!weight || String(weight).trim() === '' || String(weight).trim() === 'N/A') {
    violations.push({
      id: 'AI_WEIGHT_001', rule: 'Weight Declaration',
      message: 'Weight/quantity not declared on listing',
      severity: 'MEDIUM', field: 'weight',
    });
    score -= 10;
    recommendations.push('Ensure weight/quantity is clearly stated on the listing');
  }

  // Regulatory checks — only penalize if deep scrape was available
  if (fssai === 'N/A' || !fssai) {
    if (deepScrapeAvailable) {
      violations.push({
        id: 'AI_FSSAI_001', rule: 'FSSAI License Verification',
        message: 'FSSAI license number not found on product listing - mandatory for all food products in India',
        severity: 'CRITICAL', field: 'fssai_number',
      });
      score -= 20;
      recommendations.push('Ensure FSSAI license number (14 digits) is prominently displayed on the product listing');
    } else {
      recommendations.push('FSSAI license could not be verified (detail page unavailable) — check product packaging');
    }
  }

  if (ingredients === 'N/A' || !ingredients || String(ingredients).length < 10) {
    if (deepScrapeAvailable) {
      violations.push({
        id: 'AI_ING_001', rule: 'Ingredient Declaration',
        message: 'Ingredient list is missing or incomplete - required under FSSAI regulations',
        severity: 'HIGH', field: 'ingredients',
      });
      score -= 15;
      recommendations.push('Complete ingredient list with allergen information must be provided');
    } else {
      recommendations.push('Ingredients could not be verified (detail page unavailable) — check product label');
    }
  }

  if (manufacturer === 'N/A' || !manufacturer) {
    if (deepScrapeAvailable) {
      violations.push({
        id: 'AI_MFG_001', rule: 'Manufacturer Information',
        message: 'Manufacturer details not available on the product listing',
        severity: 'HIGH', field: 'manufacturer_name',
      });
      score -= 10;
      recommendations.push('Add complete manufacturer/packer name and address');
    } else {
      recommendations.push('Manufacturer info could not be verified (detail page unavailable)');
    }
  }

  if (expiry === 'N/A' || !expiry) {
    if (deepScrapeAvailable) {
      violations.push({
        id: 'AI_EXP_001', rule: 'Expiry Date Declaration',
        message: 'Expiry or best-before date not found on the listing',
        severity: 'MEDIUM', field: 'expiry_date',
      });
      score -= 10;
      recommendations.push('Display clear expiry date or best-before information');
    } else {
      recommendations.push('Expiry date could not be verified (detail page unavailable)');
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Continue maintaining good compliance practices',
      'Regularly verify FSSAI license renewal dates',
      'Ensure allergen warnings are prominently displayed'
    );
  }

  score = Math.max(0, Math.min(100, score));
  const risk = score >= 80 ? 'Low' : score >= 50 ? 'Medium' : 'High';
  const deepNote = deepScrapeAvailable ? '' : ' Based on listing data only (product detail page was not accessible).';

  return {
    ai_score: score,
    ai_risk: risk,
    ai_violations: violations,
    ai_status: 'Fallback Analysis (Gemini Unavailable)',
    summary: `Compliance score: ${score}/100 — ${violations.length} issue(s) found.${deepNote}`,
    detailed_insights: `The product was evaluated against Indian food safety regulations. ${violations.length} potential compliance issues were identified.${deepNote}`,
    recommendations,
  };
}

module.exports = { analyzeWithGemini, fallbackAnalysis };

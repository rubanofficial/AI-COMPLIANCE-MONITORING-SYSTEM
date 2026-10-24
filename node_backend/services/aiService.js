/**
 * AI Service — equivalent to services/gemini_service.py + openai_service.py
 * Uses Google Gemini REST API. Falls back to rule-based analysis if unavailable.
 */
import 'dotenv/config';
import { cleanPrice } from '../utils/dataCleaner.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

export function buildCompliancePrompt(product) {
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

export function parseGeminiResponse(rawText) {
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

export async function analyzeWithGemini(product, deepScrapeAvailable = true) {
  const productName = product.product_name || product.name || 'Unknown';
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (apiKey) {
    try {
      console.log(`    🤖 [Gemini] Sending product for AI analysis: ${productName.slice(0, 50)}`);

      const prompt = buildCompliancePrompt(product);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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
  console.log(`    🤖 [Fallback] Using rule-based AI analysis for: ${productName.slice(0, 50)}`);
  return fallbackAnalysis(product, deepScrapeAvailable);
}

export function fallbackAnalysis(product, deepScrapeAvailable = true) {
  return {
    ai_score: null,
    ai_risk: null,
    ai_violations: [],
    ai_status: 'AI unavailable - rule-based score only',
    summary: 'AI analysis was not available for this product.',
    detailed_insights: '',
    recommendations: [],
  };
}

export default { analyzeWithGemini, fallbackAnalysis, buildCompliancePrompt, parseGeminiResponse };

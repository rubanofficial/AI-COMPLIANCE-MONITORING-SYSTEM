# Deep Scraping Enabled - Full Compliance Data

## ✅ What Changed

Your backend now uses **deep scrapers** that visit each product page individually to extract:

### Extracted Fields:
- ✅ **Product Name**
- ✅ **Price & MRP**
- ✅ **Weight/Quantity** (e.g., "1 kg", "500 g")
- ✅ **FSSAI License Number** (14 digits)
- ✅ **Manufacturer Name**
- ✅ **Manufacturer Address**
- ✅ **Ingredients List**
- ✅ **Expiry/Best Before Date**
- ✅ **Product Images** (multiple high-res images)
- ✅ **Discount**
- ✅ **Product Description**

## 🎯 Compliance Rules Validated

The system now checks these 6 critical rules:

| Rule | Severity | Penalty | Field |
|------|----------|---------|-------|
| FSSAI License | CRITICAL | -35 | `fssai_number` |
| Manufacturer Name | HIGH | -30 | `manufacturer_name` |
| Manufacturer Address | MEDIUM | -25 | `manufacturer_address` |
| Ingredients List | HIGH | -20 | `ingredients` |
| Weight Check | MEDIUM | -15 | `weight` |
| Expiry Date | MEDIUM | -15 | `expiry_date` |

## ⏱️ Important Notes

- **Scraping Time**: 30-60 seconds (visits product pages)
- **Products Returned**: Top 3 from Blinkit + Top 3 from Zepto = 6 total
- **OCR**: Temporarily disabled (was causing timeouts)

## 🧪 How to Test

### 1. Restart Backend Server
The backend MUST be restarted to load the new deep scrapers:

```powershell
# Stop current server (Ctrl+C in the backend terminal)
cd backend
python start_server.py
```

Note which port it shows (e.g., 8006).

### 2. Test with Postman

**URL:**
```
POST http://127.0.0.1:8006/evaluate?product_name=poha
```

**Settings:**
- Method: `POST`
- Timeout: Set to at least **90 seconds** in Postman settings
  - Settings → General → Request timeout in ms → `90000`

**Expected Response:**
```json
{
  "products_analyzed": 6,
  "results": [
    {
      "product": {
        "product_name": "Poha Thick",
        "price": "50",
        "mrp": "60",
        "weight": "500 g",
        "fssai_number": "12345678901234",
        "manufacturer_name": "ABC Foods Pvt Ltd",
        "manufacturer_address": "123 Industrial Area, Mumbai",
        "ingredients": "Rice flakes, salt, turmeric...",
        "expiry_date": "12/2024",
        "platform": "blinkit"
      },
      "compliance": {
        "score": 85,
        "violations": [...],
        "passed_rules": [...]
      }
    }
  ]
}
```

### 3. Test with Frontend

1. Make sure frontend is running:
   ```powershell
   cd frontend
   npm run dev
   ```

2. Open Product Scanner page
3. Enter "poha" or "amul milk"
4. Click **Evaluate**
5. Wait 30-60 seconds
6. You should see compliance score **increase** with detailed violation info

## 🐛 Troubleshooting

**If you see 0/100 score:**
- Check backend terminal logs for scraping errors
- Verify the product exists on Blinkit/Zepto
- Try a different product name (e.g., "maggi", "parle g")

**If timeout occurs:**
- Increase Postman timeout to 90+ seconds
- Wait patiently - deep scraping takes time
- Check if Playwright browsers are installed: `python -m playwright install`

**If "Scraping failed" error:**
- The product might not be available on Blinkit/Zepto
- Try popular products: "amul milk", "maggi", "parle g", "britannia"

## 📊 Backend Logs

You'll see detailed logs like:
```
============================================================
🔍 DEEP SCRAPING REQUEST: poha
   Mode: Visiting individual product pages
   Expected time: 30-60 seconds
============================================================
📍 Starting Blinkit + Zepto scrapers in parallel...
✓ Blinkit: 3 products
✓ Zepto: 3 products

📦 Total scraped: 6 products with detailed compliance data

[1/6] Evaluating: Poha Thick Flakes 500g
    → Running compliance checks...
    ✓ Compliance Score: 85/100
    ✓ Violations: 2
```

## 🚀 Next Steps

If you want to **re-enable OCR** for extracting text from product images:
- Uncomment the OCR code in `backend/main.py` (line ~83)
- This will add 20-30 seconds to evaluation time
- Useful for verifying FSSAI numbers and ingredients from images

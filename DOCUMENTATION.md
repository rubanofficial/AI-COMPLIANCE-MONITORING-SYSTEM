# AI Compliance System (ACS) — Complete Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Backend — Detailed Breakdown](#5-backend--detailed-breakdown)
   - 5.1 [Application Entry Point](#51-application-entry-point--mainpy--runpy)
   - 5.2 [API Endpoints](#52-api-endpoints)
   - 5.3 [Scraping Engine](#53-scraping-engine)
   - 5.4 [OCR Service](#54-ocr-service--ocrservicepy)
   - 5.5 [Rule Engine](#55-rule-engine--ruleenginepy)
   - 5.6 [Scoring Engine](#56-scoring-engine--scoringenginepy)
   - 5.7 [AI Service](#57-ai-service--openaiservicepy)
   - 5.8 [Dashboard Service](#58-dashboard-service--dashboardservicepy)
   - 5.9 [Data Models](#59-data-models)
   - 5.10 [Utilities](#510-utilities)
   - 5.11 [Configuration](#511-configuration)
6. [Frontend — Detailed Breakdown](#6-frontend--detailed-breakdown)
   - 6.1 [App Structure & Routing](#61-app-structure--routing)
   - 6.2 [Layout Components](#62-layout-components)
   - 6.3 [Pages](#63-pages)
   - 6.4 [Widgets & UI Components](#64-widgets--ui-components)
   - 6.5 [API Service Layer](#65-api-service-layer)
   - 6.6 [Type System](#66-type-system)
   - 6.7 [Mock Data](#67-mock-data)
7. [Data Pipeline Flow](#7-data-pipeline-flow)
8. [Compliance Rules Tracked](#8-compliance-rules-tracked)
9. [Regulatory Framework](#9-regulatory-framework)
10. [Installation & Setup](#10-installation--setup)
11. [Project File Structure](#11-project-file-structure)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Future Enhancements](#13-future-enhancements)

---

## 1. Project Overview

The **AI Compliance System (ACS)** is a full-stack web application designed to automatically evaluate whether products sold on Indian quick-commerce platforms (**Blinkit**, **Zepto**) comply with Indian regulatory standards — including **FSSAI (Food Safety and Standards Authority of India)**, **Legal Metrology Act**, and **Consumer Protection Act**.

The system scrapes live product data from these platforms using browser automation, runs OCR on product images to extract hidden compliance data, validates everything against 14+ regulatory rules, and presents the results through a premium dark-themed dashboard.

### What This Project Does (In Simple Terms)

1. **You enter a product name** (e.g., "amul milk") **or a product URL** from Blinkit/Zepto.
2. The system **opens a headless browser**, navigates to the platform, handles location popups, and **scrapes the product page deeply** — extracting price, MRP, weight, FSSAI number, ingredients, manufacturer details, expiry date, images, and more.
3. Product **images are downloaded and processed with OCR** (EasyOCR) to extract text that may contain FSSAI numbers, ingredients, or expiry dates not visible in the HTML.
4. All extracted data is run through a **Rule-Based Validation Engine** that checks 14+ compliance rules and assigns a score out of 100.
5. An **AI Analysis module** (placeholder for Google Gemini integration) provides supplementary scoring.
6. The **combined compliance score** with detailed violations is returned to the frontend dashboard.
7. The **React dashboard** displays everything — score gauge, violation timeline, dual-source comparison, trend charts, and scan history.

---

## 2. Problem Statement

Quick-commerce platforms in India (Blinkit, Zepto, Swiggy Instamart) deliver groceries in 10-30 minutes. However, the product listings on these platforms often **lack mandatory regulatory information** required by Indian law:

- **Missing FSSAI license numbers** (required for all food products)
- **No ingredient lists** or incomplete ones
- **Missing manufacturer details** (name and address)
- **No expiry/best-before dates**
- **Selling price exceeding MRP** (illegal under Legal Metrology Act)
- **Missing net quantity/weight declarations**

This system automates the detection of these compliance gaps at scale.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Dashboard │  │ Scanner  │  │  Rules   │  │    Settings      │    │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └──────────────────┘    │
│       │              │                                               │
│       └──────┬───────┘                                               │
│              │  HTTP API Calls (fetch)                                │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + Python)                        │
│                                                                      │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────────┐    │
│  │  /evaluate   │────▶│ Scraper      │────▶│ Blinkit Deep       │    │
│  │  (POST)      │     │ Manager      │     │ Zepto Deep         │    │
│  └──────┬──────┘     └──────────────┘     └────────────────────┘    │
│         │                                                            │
│         ├─────────▶ OCR Service (EasyOCR + OpenCV)                  │
│         │              ↳ Download images → Preprocess → Extract text │
│         │              ↳ Regex extraction of FSSAI, ingredients, etc.│
│         │                                                            │
│         ├─────────▶ Rule Engine (14+ validation rules)              │
│         │              ↳ VAL001-VAL004: Basic validations            │
│         │              ↳ REG001-REG005: Regulatory compliance        │
│         │                                                            │
│         ├─────────▶ AI Service (Mock / Gemini placeholder)          │
│         │                                                            │
│         └─────────▶ Scoring Engine (combines rule + AI scores)      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Dashboard Service (in-memory scan history & statistics)       │  │
│  │  /dashboard/stats  │  /dashboard/recent-scans  │  /trends     │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Three-Stage Pipeline

| Stage | Component | Purpose |
|-------|-----------|---------|
| **Stage 1** | Multi-Platform Deep Scraping | Searches and crawls Blinkit/Zepto product pages with Playwright |
| **Stage 2** | OCR + Rule-Based Validation | Extracts text from images via EasyOCR; validates 14+ compliance rules |
| **Stage 3** | AI-Powered Analysis | (Placeholder) Cross-verifies data with Google Gemini Pro |

---

## 4. Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.10+ | Core backend language |
| **FastAPI** | Latest | High-performance async REST API framework |
| **Uvicorn** | Latest | ASGI server for FastAPI |
| **Playwright** | Latest | Headless browser automation for scraping |
| **EasyOCR** | Latest | Optical Character Recognition on product images |
| **OpenCV (cv2)** | Latest | Image preprocessing (grayscale, sharpening) |
| **NumPy** | Latest | Array operations for image processing |
| **httpx** | Latest | Async HTTP client for downloading images |
| **Pydantic** | Latest | Data validation and serialization (models) |
| **python-dotenv** | Latest | Environment variable management |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 19.2.0 | UI component framework |
| **TypeScript** | ~5.9.3 | Type-safe JavaScript |
| **Vite** | 7.3.1 | Build tool and dev server |
| **Tailwind CSS** | 4.2.0 | Utility-first CSS (with custom inline styles) |
| **Framer Motion** | 12.34.2 | Animations and transitions |
| **Recharts** | 3.7.0 | Charting library for trend graphs |
| **React Router DOM** | 7.13.0 | Client-side routing |
| **Lucide React** | 0.575.0 | Icon library |
| **Radix UI** | Latest | Accessible UI primitives (progress, switch, tabs) |
| **clsx + tailwind-merge** | Latest | CSS class merging utilities |

---

## 5. Backend — Detailed Breakdown

### 5.1 Application Entry Point — `main.py` & `run.py`

**`run.py`** — The startup script. Configures Windows `ProactorEventLoopPolicy` for Playwright compatibility on Windows + Python 3.12, then starts Uvicorn on `127.0.0.1:8000`.

**`main.py`** — The FastAPI application definition. Contains:
- CORS middleware (allows all origins for development)
- Startup event that initializes sample dashboard data
- All API route definitions

### 5.2 API Endpoints

| Method | Endpoint | Parameters | Description |
|--------|----------|------------|-------------|
| `POST` | `/evaluate` | `product_name: str` (query param) | Main evaluation pipeline — scrapes, OCRs, validates, scores |
| `GET` | `/dashboard/stats` | None | Returns aggregate dashboard statistics |
| `GET` | `/dashboard/recent-scans` | `limit: int = 10` | Returns the most recent scan entries |
| `GET` | `/dashboard/trends` | `days: int = 7` | Returns compliance trend data grouped by day |

#### `/evaluate` — The Main Pipeline

This is the core endpoint. When called, it:

1. Calls `scrape_all(product_name)` → Scrapes Blinkit and Zepto in parallel
2. For each scraped product:
   - Extracts product image URLs
   - Runs OCR on images via `perform_ocr_on_images()`
   - Extracts compliance data from OCR text via `extract_compliance_data_rules()`
   - Merges OCR data into the product dictionary
   - Validates via `validate_product()` (Rule Engine)
   - Runs AI analysis via `analyze_product()` (currently mocked)
   - Combines scores via `combine_scores()`
   - Records in scan history for dashboard
3. Returns all results as JSON

### 5.3 Scraping Engine

The scraping system is the most complex part of the backend. It has **two tiers** of scrapers per platform:

#### `scraper_manager.py` — The Orchestrator

- Parses user input (URL vs. plain text search query)
- Detects platform from URLs (Blinkit, Zepto)
- Supports direct product URLs (e.g., `https://blinkit.com/prn/amul-milk/...`)
- Runs scrapers in parallel using `asyncio.gather()`
- Filters out invalid products (missing name, no price, search headers)
- Caps at top 3 products per platform

**Input Parsing Logic:**
```
Input: "amul milk"           → Search both Blinkit and Zepto
Input: "https://blinkit.com/prn/amul-milk" → Direct scrape on Blinkit only
Input: "https://zeptonow.com/pn/maggi"     → Direct scrape on Zepto only
```

#### `blinkit_deep.py` — Blinkit Deep Scraper (397 lines)

A production-grade Playwright scraper for Blinkit with:

1. **Location Handling**: Navigates to homepage first, searches for location input fields, types "Gurugram", clicks on the first suggestion (or uses keyboard fallback). This is essential because Blinkit requires a delivery location before showing products.

2. **Search Mode**: Navigates to `https://blinkit.com/s/?q={query}`, waits for product listings, collects product page URLs using multiple CSS selector strategies.

3. **Direct URL Mode**: If a product URL is provided, navigates directly and extracts data.

4. **Product Page Extraction** (`_extract_product()`):
   - Product name via `h1`, `[class*="ProductName"]`, etc.
   - Price and MRP via regex on `₹` symbols in HTML
   - Weight from CSS selectors or regex patterns
   - All product images from carousel/gallery selectors (upscaled to 800px)
   - FSSAI number via `FSSAI[^0-9]*(\d{14})` regex
   - Ingredients, manufacturer name/address from HTML regex
   - Expiry date from multiple patterns (Best Before, BB, EXP, date formats)
   - Description from DOM selectors
   - Discount calculated from price vs. MRP

5. **Fallback Extraction** (`_extract_search_cards()`): If product URLs can't be found, extracts basic data directly from search result cards.

6. **Anti-Detection**: Custom user agent, `--disable-blink-features=AutomationControlled`, full viewport (1920x1080).

#### `zepto_deep.py` — Zepto Deep Scraper (323 lines)

Similar to Blinkit but customized for Zepto's architecture:

1. **Location Handling**: Clicks location buttons, fills "Gurugram", submits.

2. **JSON Payload Extraction**: Zepto embeds product data in `self.__next_f.push()` calls (Next.js framework). The scraper:
   - Extracts all push payloads from page HTML
   - Concatenates and unescapes them
   - Parses `sellingPrice`, `mrp`, `formattedPackSize` from the JSON
   - Parses `highlights` array for ingredients and FSSAI
   - Parses `information` array for manufacturer, expiry, disclaimers, country of origin

3. **DOM Fallback**: If JSON extraction fails, falls back to DOM selectors for price, MRP, etc.

4. **Image Extraction**: Similar to Blinkit — multiple selectors, placeholder filtering, URL upscaling.

#### `blinkit_live.py` & `zepto_live.py` — Basic "Live" Scrapers

Simpler versions that only extract search result cards (name, price, MRP, discount, image) without visiting individual product pages. These were the first-generation scrapers before the "deep" variants were built.

### 5.4 OCR Service — `ocr_service.py`

A 243-line OCR pipeline with three stages:

#### Stage 1: Image Download
- Downloads up to 10 product images concurrently via `httpx.AsyncClient`
- Skips placeholder images
- Retries failed downloads with exponential backoff (3 attempts)
- Custom headers to avoid blocking

#### Stage 2: Image Preprocessing
- Converts bytes to NumPy array → OpenCV image
- Converts to **grayscale**
- Applies a **sharpening kernel** (`[[-1,-1,-1], [-1,9,-1], [-1,-1,-1]]`) for better OCR accuracy

#### Stage 3: OCR Text Extraction
- Uses **EasyOCR** (English) with GPU disabled by default
- Returns consolidated text and average confidence score
- Processes each image sequentially after download

#### Stage 4: Compliance Data Extraction via Regex
`extract_compliance_data_rules()` — Applies sophisticated regex patterns on OCR text:

| Field | Extraction Method |
|-------|------------------|
| **FSSAI Number** | OCR character correction (O→0, I→1, l→1), then 3 regex patterns: `FSSAI...14 digits`, `License...14 digits`, standalone 14-digit number starting with 1 |
| **Ingredients** | Looks for "Ingredients:" followed by text until next section header |
| **Manufacturer** | Matches "Manufactured by", "Mfd by", "Marketed by", "Packed by", splits into name + address |
| **Expiry Date** | 7+ patterns including "Best Before: 12 months", "Expiry: DD/MM/YYYY", "BB: Mar 2026", "Shelf Life: X months", loose date patterns |

### 5.5 Rule Engine — `rule_engine.py`

Validates products against **9 specific rules** across two categories:

#### Basic Validations
| Rule ID | Rule Name | Severity | Penalty |
|---------|-----------|----------|---------|
| VAL001 | Product Name Check | CRITICAL | -30 |
| VAL002 | Price Check | HIGH | -25 |
| VAL003 | Weight Check | MEDIUM | -15 |
| VAL004 | MRP Compliance (price > MRP is illegal) | CRITICAL | -40 |

#### Regulatory Compliance Validations
| Rule ID | Rule Name | Severity | Penalty |
|---------|-----------|----------|---------|
| REG001 | FSSAI License (present + 14-digit format) | CRITICAL/HIGH | -35 or -25 |
| REG002 | Manufacturer Name | HIGH | -30 |
| REG003 | Manufacturer Address | MEDIUM | -25 |
| REG004 | Ingredients List | HIGH | -20 |
| REG005 | Expiry/Best Before Date | MEDIUM | -15 |

**Scoring**: Starts at 100, deducts penalties for each violation. Minimum score is 0.

**FSSAI Intelligence**: Uses OCR-extracted FSSAI as primary source; falls back to scraped FSSAI if OCR didn't find one.

### 5.6 Scoring Engine — `scoring_engine.py`

Combines the rule engine score and AI score:

- **Formula**: `final_score = (rule_score × 0.5) + (ai_score × 0.5)`
- **Risk Classification**:
  - Score ≥ 80 → **Low Risk**
  - Score ≥ 50 → **Medium Risk**
  - Score < 50 → **High Risk**
- **Violation Normalization**: All violations (from rules and AI) are normalized to a consistent structure with `id`, `rule`, `message`, `severity`, and `field`.

### 5.7 AI Service — `openai_service.py`

Currently a **mock/placeholder** that returns:
```python
{
    "ai_score": 100,
    "ai_risk": "Low",
    "ai_violations": [],
    "ai_status": "AI Analysis Disabled (Mock Mode)"
}
```

**Designed for**: Integration with Google Gemini Pro to:
- Cross-verify extracted text against regulatory requirements
- Analyze ingredient lists for restricted substances
- Interpret complex manufacturer details
- Generate natural-language compliance insights

### 5.8 Dashboard Service — `dashboard_service.py`

An **in-memory** (non-persistent) service that:

- **`add_scan_to_history()`**: Records each product evaluation (name, platform, score, risk, timestamp). Keeps last 100 entries.
- **`get_recent_scans()`**: Returns the N most recent scans (reversed chronological order).
- **`get_dashboard_stats()`**: Computes aggregate statistics:
  - Average compliance score
  - Total products scanned
  - Total violations (estimated from scores)
  - Critical and high violation counts
  - Rules passing percentage
- **`get_trend_data()`**: Groups scans by date and calculates daily averages.
- **`initialize_sample_data()`**: Seeds 5 sample scans on startup for demo purposes (Amul Taaza Milk, Britannia Bread, Nestle Maggi, Mother Dairy Curd, Parle-G Biscuits).

### 5.9 Data Models

#### `product_model.py` — Pydantic Model
```python
class Product(BaseModel):
    platform: str
    name: Optional[str]
    price: Optional[float]
    mrp: Optional[float]
    discount: Optional[str]
```

#### `response_model.py` — Pydantic Models
```python
class ComplianceResult(BaseModel):
    score: int
    risk: str
    violations: List[str]

class ProductResponse(BaseModel):
    product: dict
    compliance: ComplianceResult
```

### 5.10 Utilities

#### `data_cleaner.py`
- **`clean_price(value)`**: Strips non-numeric characters, returns `float`
- **`clean_discount(value)`**: Extracts first number from discount string, returns `int`

#### `helpers.py`
Empty file — reserved for future utility functions.

### 5.11 Configuration

#### `config/settings.py`
- Loads `.env` file via `python-dotenv`
- `MAX_PRODUCTS = 3` — Maximum products to return per platform
- Placeholder for API keys (OPENAI, GEMINI) — currently commented out

---

## 6. Frontend — Detailed Breakdown

### 6.1 App Structure & Routing

**`App.tsx`** — Root component using React Router v7 with `BrowserRouter`:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Dashboard` | Main analytics dashboard (default) |
| `/scanner` | `Scanner` | Product evaluation input and results |
| `/rules` | `Rules` | Compliance rule explorer and management |
| `/settings` | `Settings` | System configuration panel |
| `*` | Redirects to `/` | Catch-all redirect |

All routes are nested inside `AppShell` (layout wrapper with Sidebar + TopBar).

### 6.2 Layout Components

#### `AppShell.tsx`
The main layout container:
- Fixed 240px sidebar on the left
- Sticky top bar
- Main content area with the `<Outlet />` for nested routes
- Dark theme background (`#020617`)

#### `Sidebar.tsx`
- **Brand header**: "ComplianceAI — QUICK COMMERCE" with green shield icon
- **Navigation**: 4 items (Dashboard, Scanner, Rules, Settings) using `NavLink` with active state highlighting
- **Status footer**: "AI Engine Active — Gemini 1.5 Pro" indicator

#### `TopBar.tsx`
- **Search bar**: "Search products, rules, reports..." input (UI only)
- **Status pills**: Three indicators — API Online (green), AI Engine (green), Rules DB (amber)
- **Notification bell** and **user avatar**

### 6.3 Pages

#### `Dashboard.tsx` — The Main Analytics View

**Live Data Integration:**
- Fetches from 3 backend endpoints on mount: `/dashboard/stats`, `/dashboard/recent-scans`, `/dashboard/trends`
- Auto-refreshes every 30 seconds
- Shows loading and error states

**Components displayed:**

1. **Stats Row** (4 cards):
   - Avg Compliance Score (green)
   - Products Scanned (blue)
   - Total Violations (red)
   - Rules Passing % (green)

2. **Compliance Score Widget** — Circular SVG gauge with animated score
3. **Violation Timeline** — Scrollable list of violations with severity icons
4. **Compliance Trend Chart** — Recharts area chart showing score and violations over time
5. **Dual-Source Comparison** — Side-by-side comparison of Blinkit vs. Zepto data
6. **Recent Scans** — List of last 8 scanned products with scores and risk badges

#### `Scanner.tsx` — Product Evaluation Interface (414 lines)

The primary interaction page:

1. **Input Section**:
   - Text input accepting product names or URLs
   - "Evaluate" button with loading spinner animation
   - Sample URL suggestions (clickable)
   - Enter key support

2. **Loading State**: Animated skeleton cards while evaluation runs

3. **Results Display**:
   - **Product cards**: Shows all found products (up to 3 per platform) with scores, passed/failed counts
   - **Selectable**: Click a product card to view its detailed analysis
   - **Detail View**: For the selected product shows:
     - Product info banner (name, platform, price, weight)
     - Compliance Score Widget
     - Violation Timeline
     - Dual-Source Comparison (E-Commerce Data vs. OCR Analysis)
     - AI Analysis section with summary, risk level, and recommendations

4. **API Integration**: Calls `POST /evaluate?product_name=...` and maps the response to frontend types

#### `Rules.tsx` — Compliance Rule Management

- Displays 14 compliance rules in an interactive table
- Summary pills: Total / Active / Disabled / Critical counts
- Full `RuleExplorer` component with search, filter tabs, and toggles
- Regulatory footer citing FSS Act 2006, Legal Metrology Act 2009, Consumer Protection Act 2019

#### `Settings.tsx` — Configuration Panel

Organized into 4 sections:

1. **API Configuration**: Backend URL, request timeout, mock mode toggle
2. **AI Engine**: Gemini API key input, model selector (gemini-1.5-pro, flash, 2.0-flash), AI insights toggle
3. **Notifications**: Critical violation alerts, score drop alerts, daily summary
4. **Compliance Thresholds**: Compliant score threshold (default 80), at-risk threshold (default 50)

*Note: Settings are UI-only (state not persisted to backend).*

### 6.4 Widgets & UI Components

#### `ComplianceScoreWidget.tsx`
- **Circular SVG gauge** with animated progress ring
- Score animates from 0 to target value over 1.2s with ease-out
- Color-coded: Green (≥80), Amber (50-79), Red (<50)
- Labels: "Compliant", "At Risk", "Non-Compliant"
- Stats row showing Passed / Failed / Total rules
- Glowing shadow effect matching score color
- Skeleton loading state

#### `ViolationTimeline.tsx`
- Vertical timeline with severity-colored icons
- 4 severity levels: CRITICAL (red), HIGH (pink), MEDIUM (amber), LOW (gray)
- Each violation shows: rule name, StatusBadge, field tag (monospace), description
- Staggered animation on entry (0.08s delay between items)
- Empty state: "All Rules Passed" with green checkmark
- Violation count badge in header

#### `DualViewScraperData.tsx`
- Side-by-side comparison grid with two data sources
- 7 fields compared: Name, Price, MRP, Weight, FSSAI, Manufacturer, Expiry
- **Mismatch detection**: Amber dot indicator and highlighted cells when values differ
- Mismatch count badge in header
- Source A styled in green, Source B in purple

#### `ComplianceTrendChart.tsx`
- Built with Recharts `<AreaChart>`
- Two charts stacked:
  - **Main**: Compliance score over time with green gradient fill and 80-point target reference line
  - **Mini**: Violations per period with red gradient fill
- Custom tooltip with dark glassmorphism styling
- Average score badge in header
- Legend showing Score and Violations

#### `RuleExplorer.tsx`
- Interactive rule table with columns: Rule Name, Category, Severity, Reg. Ref, Active toggle
- **Filter tabs**: All / Active / Disabled with counts
- **Search**: Filter by rule name or category
- **Category colors**: Licensing (purple), Pricing (blue), Labeling (orange), Content (green), Metrology (amber), Safety (red), Traceability (gray)
- **Toggle switches**: Enable/disable individual rules with green glow animation
- Disabled rules shown at 55% opacity

#### `StatusBadge.tsx`
Reusable severity badge component displayed throughout the app.

#### `SkeletonCard.tsx`
Reusable loading placeholder with shimmer animation.

### 6.5 API Service Layer

**`services/api.ts`** — Clean API abstraction:

```typescript
const API_BASE_URL = 'http://localhost:8000';

evaluateProduct(query: string)     → POST /evaluate?product_name=...
getDashboardStats()                → GET  /dashboard/stats
getRecentScans(limit: number)      → GET  /dashboard/recent-scans?limit=...
getTrendData(days: number)         → GET  /dashboard/trends?days=...
```

All functions handle errors and return parsed JSON.

### 6.6 Type System

**`types/index.ts`** defines TypeScript interfaces:

- `Product` — 10 fields (name, price, mrp, discount, weight, ingredients, fssai_number, manufacturer_name, manufacturer_address, expiry_date)
- `Violation` — id, rule, message, severity (CRITICAL|HIGH|MEDIUM|LOW), field
- `Compliance` — rule_score, violations, passed_rules, total_rules
- `AIAnalysis` — summary, risk_level, recommendations, detailed_insights
- `EvaluateResponse` — Full response including product, compliance, AI analysis, source comparisons
- `ComplianceRule` — id, name, category, severity, description, enabled, regulatory_ref
- `TrendDataPoint` — date, score, violations, products_scanned

### 6.7 Mock Data

**`data/mockData.ts`** provides realistic demo data:

- **`mockEvaluateResponse`**: Full evaluation for "Amul Taaza Toned Fresh Milk" with 5 violations, Blinkit vs. Zepto source comparison, and AI analysis
- **`mockComplianceRules`**: 14 rules covering Licensing, Pricing, Labeling, Content, Metrology, Safety, and Traceability — with regulatory references
- **`mockTrendData`**: 6 weeks of trend data points
- **`mockRecentScans`**: 5 sample scan entries

---

## 7. Data Pipeline Flow

```
User Input (product name or URL)
    │
    ▼
┌─────────────────────────────────────────┐
│ Scraper Manager (scraper_manager.py)    │
│ • Parses input → URL or search query    │
│ • Determines target platform(s)         │
│ • Runs scrapers in parallel             │
│ • Filters invalid products              │
│ • Caps at 3 per platform                │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┐
    ▼                    ▼
┌──────────┐      ┌──────────┐
│ Blinkit  │      │  Zepto   │
│ Deep     │      │  Deep    │
│ Scraper  │      │  Scraper │
└────┬─────┘      └────┬─────┘
     │                  │
     └────────┬─────────┘
              │ (list of product dicts)
              ▼
    For each product:
    ┌─────────────────────────────────────┐
    │ 1. OCR Pipeline                     │
    │    • Download images (≤10)          │
    │    • Preprocess (grayscale+sharpen) │
    │    • EasyOCR → raw text             │
    │    • Regex → FSSAI, ingredients,    │
    │      manufacturer, expiry           │
    │    • Merge into product dict        │
    └─────────────┬───────────────────────┘
                  │
    ┌─────────────┴───────────────────────┐
    │ 2. Rule Engine (validate_product)   │
    │    • 9 rules, score starts at 100   │
    │    • Deducts penalties per violation │
    │    → rule_score, violations list    │
    └─────────────┬───────────────────────┘
                  │
    ┌─────────────┴───────────────────────┐
    │ 3. AI Service (analyze_product)     │
    │    • Currently returns mock data    │
    │    → ai_score: 100, no violations  │
    └─────────────┬───────────────────────┘
                  │
    ┌─────────────┴───────────────────────┐
    │ 4. Scoring Engine (combine_scores)  │
    │    • final = (rule×0.5)+(ai×0.5)   │
    │    • Classify risk: Low/Medium/High │
    │    • Normalize all violations       │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    JSON Response → Frontend Dashboard
```

---

## 8. Compliance Rules Tracked

| # | Field | Legal Requirement | Validation Method |
|---|-------|------------------|-------------------|
| 1 | Product Name | Consumer identification | Presence check |
| 2 | Price (₹) | Must be displayed | Presence + >0 |
| 3 | MRP (₹) | Legal Metrology Act | Must be ≥ selling price |
| 4 | Net Weight/Quantity | Legal Metrology (Packaged Commodities) Rules | Presence check |
| 5 | FSSAI License Number | FSS Act 2006, Section 31 | 14-digit format validation |
| 6 | Ingredients List | FSS (Labelling) Regulations 2011 | Presence + minimum 5 chars |
| 7 | Manufacturer Name | FSS (Labelling) Regulations 2011 | Presence check |
| 8 | Manufacturer Address | FSS (Labelling) Regulations 2011 | Presence check |
| 9 | Expiry / Best Before Date | FSS (Labelling) Reg 2.3 | Presence check |
| 10 | Country of Origin | FSS (Labelling) Regulations 2011 | Scraped (Zepto JSON) |
| 11 | Allergen Declaration | FSS (Labelling) Reg 2.7 | Defined in rules UI |
| 12 | Nutritional Information | FSS Reg 2.2.2 | Defined in rules UI |
| 13 | Net Quantity Format | Legal Metrology Rules 2011 | Defined in rules UI |
| 14 | Batch / Lot Number | FSS Act 2006, Section 26 | Defined in rules UI |

---

## 9. Regulatory Framework

The system enforces compliance with three key Indian laws:

### Food Safety and Standards Act, 2006 (FSSAI)
- Section 31: All food businesses must have a valid FSSAI license
- Labelling Regulations 2011: Mandatory information on food labels
- Regulation 2.2.1: Ingredient listing requirements
- Regulation 2.2.2: Nutritional information requirements
- Regulation 2.3: Date marking (expiry/best before)
- Regulation 2.7: Allergen declaration

### Legal Metrology Act, 2009
- MRP declaration requirements
- Net weight/volume declaration
- Packaged Commodities Rules 2011

### Consumer Protection Act, 2019
- Accurate pricing and discount representation
- Truthful product information

---

## 10. Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Create .env file (optional for AI)
echo "GEMINI_API_KEY=your_key_here" > .env

# Run the server
python run.py
```

Backend runs on: `http://127.0.0.1:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Usage

1. Start backend: `python run.py` (from backend directory)
2. Start frontend: `npm run dev` (from frontend directory)
3. Open `http://localhost:5173` in browser
4. Navigate to **Scanner** page
5. Enter a product name (e.g., "amul milk") or a direct product URL
6. Click **Evaluate** and wait for results (30-60 seconds for deep scraping)
7. Review compliance score, violations, and dual-source comparison

---

## 11. Project File Structure

```
acs-complete/
│
├── backend/
│   ├── main.py                          # FastAPI app + all endpoints
│   ├── run.py                           # Uvicorn startup script
│   ├── requirements.txt                 # Python dependencies
│   ├── README.md                        # Backend overview
│   │
│   ├── config/
│   │   └── settings.py                  # Environment config, MAX_PRODUCTS
│   │
│   ├── models/
│   │   ├── product_model.py             # Pydantic Product model
│   │   └── response_model.py            # Pydantic response models
│   │
│   ├── services/
│   │   ├── dashboard_service.py         # In-memory scan history & stats
│   │   ├── ocr_service.py              # EasyOCR + OpenCV + regex extraction
│   │   ├── openai_service.py           # AI analysis placeholder (mock)
│   │   ├── rule_engine.py              # 14+ compliance validation rules
│   │   ├── scoring_engine.py           # Score combination & risk classification
│   │   │
│   │   └── scraper/
│   │       ├── scraper_manager.py      # Orchestrator: input parsing, parallel scraping
│   │       ├── blinkit_deep.py         # Blinkit deep scraper (397 lines)
│   │       ├── zepto_deep.py           # Zepto deep scraper (323 lines)
│   │       ├── blinkit_live.py         # Blinkit basic search scraper
│   │       └── zepto_live.py           # Zepto basic search scraper
│   │
│   ├── utils/
│   │   ├── data_cleaner.py             # Price/discount cleaning utilities
│   │   └── helpers.py                  # (Empty — reserved)
│   │
│   └── [debug files]                   # HTML captures, test scripts, logs
│       ├── blinkit_debug*.html
│       ├── zepto_debug*.html
│       ├── test_*.py
│       └── debug_*.py
│
├── frontend/
│   ├── package.json                    # Dependencies & scripts
│   ├── vite.config.ts                  # Vite build configuration
│   ├── tsconfig*.json                  # TypeScript configuration
│   ├── index.html                      # HTML entry point
│   │
│   └── src/
│       ├── main.tsx                    # React DOM render
│       ├── App.tsx                     # Root component + routing
│       ├── App.css                     # Global styles
│       ├── index.css                   # Base CSS
│       │
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── AppShell.tsx        # Main layout (sidebar + topbar + content)
│       │   │   ├── Sidebar.tsx         # Navigation sidebar
│       │   │   └── TopBar.tsx          # Header with search & status pills
│       │   │
│       │   ├── ui/
│       │   │   ├── SkeletonCard.tsx    # Loading placeholder
│       │   │   └── StatusBadge.tsx     # Severity badge component
│       │   │
│       │   └── widgets/
│       │       ├── ComplianceScoreWidget.tsx   # Animated circular gauge
│       │       ├── ComplianceTrendChart.tsx    # Recharts area chart
│       │       ├── DualViewScraperData.tsx     # Side-by-side comparison
│       │       ├── RuleExplorer.tsx            # Interactive rule table
│       │       └── ViolationTimeline.tsx       # Violation list with icons
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx           # Main analytics dashboard
│       │   ├── Scanner.tsx             # Product evaluation interface
│       │   ├── Rules.tsx               # Rule management page
│       │   └── Settings.tsx            # Configuration panel
│       │
│       ├── services/
│       │   └── api.ts                  # Backend API call functions
│       │
│       ├── types/
│       │   └── index.ts               # TypeScript type definitions
│       │
│       └── data/
│           └── mockData.ts            # Demo/fallback mock data
│
└── DOCUMENTATION.md                    # This file
```

---

## 12. Key Design Decisions

### 1. Deep Scraping vs. API
We chose Playwright browser automation instead of APIs because quick-commerce platforms don't offer public APIs for product compliance data. The "deep" scrapers visit individual product pages (not just search results) to extract hidden compliance fields.

### 2. Two-Tier Scraper Architecture
- **Live scrapers** (`blinkit_live.py`, `zepto_live.py`): Fast, basic data from search cards
- **Deep scrapers** (`blinkit_deep.py`, `zepto_deep.py`): Full compliance data from product pages
- The system uses deep scrapers by default for comprehensive analysis.

### 3. OCR as a Compliance Data Source
Product images often contain FSSAI numbers, ingredient lists, and expiry dates that aren't in the HTML. The OCR pipeline extracts this text and merges it with scraped data, using OCR data as a primary source for FSSAI validation.

### 4. Hybrid Scoring (Rule + AI)
The 50/50 split between rule-based and AI scoring ensures reliable baseline scores even when AI is unavailable (mocked). The rule engine provides deterministic, auditable results while AI can add nuanced analysis.

### 5. In-Memory Dashboard Storage
Scan history is stored in a Python list (not a database) for simplicity. This means data resets on server restart — acceptable for a prototype/demo, with database integration as a future enhancement.

### 6. Dark Glassmorphism UI
The frontend uses a premium dark theme with:
- Background: `#020617` (slate-950)
- Glass cards: `rgba(30,41,59,0.6)` with `backdrop-filter: blur(16px)`
- Green accent color: `#10b981` (emerald-500)
- No external UI framework — all inline styles for complete control

### 7. Platform-Specific Scraping Logic
Each platform has unique challenges:
- **Blinkit**: Requires location setting before search; product data in standard HTML
- **Zepto**: Data embedded in Next.js `__next_f.push()` JSON payloads; requires JSON parsing

---

## 13. Future Enhancements

| Priority | Enhancement | Description |
|----------|------------|-------------|
| **HIGH** | Google Gemini Integration | Replace mock AI service with real Gemini Pro API |
| **HIGH** | Database Persistence | Replace in-memory storage with PostgreSQL/MongoDB |
| **HIGH** | Swiggy Instamart Scraper | Add third platform scraper |
| **MEDIUM** | FSSAI Database Verification | Validate FSSAI numbers against the official FSSAI database |
| **MEDIUM** | Scheduled Scanning | Cron-based periodic compliance monitoring |
| **MEDIUM** | Export Reports | PDF/CSV compliance reports |
| **MEDIUM** | User Authentication | Login system with role-based access |
| **LOW** | Webhook Alerts | Slack/email notifications for critical violations |
| **LOW** | Browser Extension | One-click scanning from product pages |
| **LOW** | Mobile App | React Native companion app |

---

*Documentation generated for the AI Compliance System (ACS) project.*
*Last updated: February 2026*

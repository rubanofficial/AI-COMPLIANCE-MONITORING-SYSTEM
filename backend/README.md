# AI Compliance System (ACS) 🛡️

## Overview
The **AI Compliance System (ACS)** is a state-of-the-art solution designed to ensure that products sold on quick-commerce platforms (Blinkit, Zepto, Swiggy Instamart) adhere to Indian regulatory standards (FSSAI, Legal Metrology, etc.). It automates the extraction and validation of mandatory product information, providing real-time compliance scores.

## 🚀 How It Works
The system follows a sophisticated **Three-Stage Architecture**:

### 1. Multi-Stage Intelligent Scraping
- **Discovery Stage**: The system searches for products across platforms in parallel using Playwright.
- **Deep Extraction Stage**: Unlike basic scrapers, ACS visits individual product pages to extract 14+ specific compliance fields that are often hidden in dynamic JS payloads or image descriptions.
- **Platform Handling**: Custom logic for each platform to handle location prompts, dynamic loading, and anti-bot measures.

### 2. Hybrid Validation Engine
- **Rule-Based Validation**: Instant checks for presence of mandatory fields (MRP, Manufacturers Name, Ingredients, etc.).
- **FSSAI Verification**: Specialized regex and logic to validate the 14-digit FSSAI license format.
- **Expiry Analysis**: Checks for "Best Before" and "Expiry Date" compliance.

### 3. AI-Powered Analysis (Google Gemini)
The system leverages **Google Gemini Pro** to:
- Cross-verify extracted text against regulatory requirements.
- Analyze ingredient lists for restricted substances.
- Interpret complex manufacturer details and legal declarations.

## 🛠️ Tech Stack
- **Backend**: Python 3.10+, FastAPI
- **Automation**: Playwright (Browser Orchestration)
- **AI**: Google Generative AI (Gemini Pro)
- **Frontend**: Vite + React with a Premium Design System
- **Styling**: Vanilla CSS with modern Glassmorphism aesthetics

## 📦 Key Mandatory Fields Tracked
- [x] Product Name & Description
- [x] Price & MRP (Net Price Compliance)
- [x] Weight / Net Quantity
- [x] FSSAI License Number
- [x] Ingredients List
- [x] Manufacturer Name & Address
- [x] Country of Origin
- [x] Expiry / Best Before Date
- [x] Legal Declarations & Disclaimers

## 🔧 Installation & Setup
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd ai-compliance-system
   ```
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```
3. **Configure Environment**:
   Create a `.env` file with your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. **Run the Application**:
   ```bash
   python run.py
   ```

---

## 🔌 GitHub Integration Test

This section was added through the connected GitHub integration to verify that repository files can be modified and committed programmatically.

---
**Note**: This project was developed for a high-stakes compliance environment to bridge the gap between e-commerce speed and legal rigor.

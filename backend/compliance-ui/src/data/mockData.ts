import type { ComplianceRule, EvaluateResponse, TrendDataPoint } from '../types';

export const mockEvaluateResponse: EvaluateResponse = {
    product: {
        name: 'Amul Taaza Toned Fresh Milk',
        price: 28,
        mrp: 32,
        discount: 12.5,
        weight: '500ml',
        ingredients: 'Toned Milk, Vitamin D',
        fssai_number: '10013022002253',
        manufacturer_name: 'Gujarat Cooperative Milk Marketing Federation Ltd (GCMMF)',
        manufacturer_address: 'Anand, Gujarat - 388001, India',
        expiry_date: '2026-02-26',
    },
    compliance: {
        rule_score: 72,
        total_rules: 14,
        passed_rules: [
            'FSSAI Number Present',
            'MRP Declared',
            'Manufacturer Name',
            'Manufacturer Address',
            'Product Weight',
            'Expiry Date Present',
            'Discount within legal limit',
            'Price Below MRP',
            'Net Quantity Declared',
        ],
        violations: [
            {
                id: 'v1',
                rule: 'Ingredients Completeness',
                message: 'Ingredient list is incomplete — missing allergen declarations required under Food Safety Standards 2011.',
                severity: 'HIGH',
                field: 'ingredients',
            },
            {
                id: 'v2',
                rule: 'FSSAI Number Validity',
                message: 'FSSAI license number format does not match 14-digit standard. Possible data scrape error.',
                severity: 'CRITICAL',
                field: 'fssai_number',
            },
            {
                id: 'v3',
                rule: 'Expiry Date Format',
                message: 'Expiry date displayed as "Best Before" without specific date — must include month and year.',
                severity: 'MEDIUM',
                field: 'expiry_date',
            },
            {
                id: 'v4',
                rule: 'Country of Origin',
                message: 'Country of origin not declared on product listing.',
                severity: 'MEDIUM',
                field: 'manufacturer_address',
            },
            {
                id: 'v5',
                rule: 'Nutritional Info',
                message: 'Nutritional information per 100ml is missing from product listing.',
                severity: 'HIGH',
                field: 'ingredients',
            },
        ],
    },
    ai_analysis: {
        summary: 'Product shows moderate compliance risk. Critical FSSAI validation failure requires immediate attention.',
        risk_level: 'MEDIUM',
        recommendations: [
            'Verify and correct FSSAI license number with regulatory database',
            'Add complete allergen declarations to ingredient list',
            'Include per-100ml nutritional information',
            'Ensure expiry date format follows DD/MM/YYYY standard',
            'Add country of origin field to product listing',
        ],
        detailed_insights:
            'The product listing for Amul Taaza Toned Fresh Milk on quick-commerce platforms shows a compliance score of 72/100. While fundamental fields like MRP, manufacturer details, and product weight are correctly declared, there are 5 violations across critical and high severity categories. The FSSAI number validation failure is the most pressing concern — this could indicate either a data extraction error from the source platform or an actual non-compliance issue. The missing nutritional information and incomplete allergen declarations create consumer safety risks and potential regulatory penalties under FSSAI regulations.',
    },
    evaluated_at: new Date().toISOString(),
    source_a_label: 'Blinkit',
    source_b_label: 'Zepto',
    source_a_data: {
        name: 'Amul Taaza Toned Fresh Milk',
        price: 28,
        mrp: 32,
        weight: '500ml',
        fssai_number: '10013022002253',
        manufacturer_name: 'GCMMF Ltd',
        expiry_date: 'Best Before 7 Days',
    },
    source_b_data: {
        name: 'Amul Taaza Milk 500ml',
        price: 29,
        mrp: 32,
        weight: '500 ml',
        fssai_number: '1001302200225',
        manufacturer_name: 'Gujarat Cooperative Milk Marketing Federation',
        expiry_date: '26 Feb 2026',
    },
};

export const mockComplianceRules: ComplianceRule[] = [
    { id: 'r1', name: 'FSSAI Number Present', category: 'Licensing', severity: 'CRITICAL', description: 'Product must display a valid 14-digit FSSAI license/registration number.', enabled: true, regulatory_ref: 'FSS Act 2006, Section 31' },
    { id: 'r2', name: 'FSSAI Number Validity', category: 'Licensing', severity: 'CRITICAL', description: 'FSSAI number must be verifiable against the FSSAI licensing database.', enabled: true, regulatory_ref: 'FSS Act 2006, Section 31' },
    { id: 'r3', name: 'MRP Declared', category: 'Pricing', severity: 'HIGH', description: 'Maximum Retail Price must be clearly declared on the listing.', enabled: true, regulatory_ref: 'Legal Metrology Act 2009' },
    { id: 'r4', name: 'Price Below MRP', category: 'Pricing', severity: 'HIGH', description: 'Selling price must not exceed the declared MRP.', enabled: true, regulatory_ref: 'Legal Metrology Act 2009' },
    { id: 'r5', name: 'Discount within Limit', category: 'Pricing', severity: 'MEDIUM', description: 'Discount must be accurately calculated from MRP.', enabled: true, regulatory_ref: 'Consumer Protection Act 2019' },
    { id: 'r6', name: 'Manufacturer Name', category: 'Labeling', severity: 'HIGH', description: 'Manufacturer or packer name must be clearly stated.', enabled: true, regulatory_ref: 'FSS (Labelling) Regulations 2011' },
    { id: 'r7', name: 'Manufacturer Address', category: 'Labeling', severity: 'HIGH', description: 'Complete registered manufacturer address must be provided.', enabled: true, regulatory_ref: 'FSS (Labelling) Regulations 2011' },
    { id: 'r8', name: 'Country of Origin', category: 'Labeling', severity: 'MEDIUM', description: 'Country of origin must be declared for all food products.', enabled: true, regulatory_ref: 'FSS (Labelling) Regulations 2011' },
    { id: 'r9', name: 'Ingredients List', category: 'Content', severity: 'HIGH', description: 'Complete list of ingredients in descending order of weight.', enabled: true, regulatory_ref: 'FSS Reg 2.2.1' },
    { id: 'r10', name: 'Allergen Declaration', category: 'Content', severity: 'HIGH', description: 'All major allergens must be explicitly declared.', enabled: true, regulatory_ref: 'FSS (Labelling) Reg 2.7' },
    { id: 'r11', name: 'Nutritional Information', category: 'Content', severity: 'MEDIUM', description: 'Nutritional info per 100g/ml must be provided.', enabled: true, regulatory_ref: 'FSS Reg 2.2.2' },
    { id: 'r12', name: 'Net Quantity Declared', category: 'Metrology', severity: 'HIGH', description: 'Net weight/volume must be clearly stated.', enabled: true, regulatory_ref: 'Legal Metrology (Packaged Comm.) Rules 2011' },
    { id: 'r13', name: 'Expiry Date Format', category: 'Safety', severity: 'HIGH', description: 'Best Before / Expiry date must follow DD/MM/YYYY format.', enabled: true, regulatory_ref: 'FSS (Labelling) Reg 2.3' },
    { id: 'r14', name: 'Batch / Lot Number', category: 'Traceability', severity: 'LOW', description: 'Batch or lot number must be present for traceability.', enabled: false, regulatory_ref: 'FSS Act 2006, Section 26' },
];

export const mockTrendData: TrendDataPoint[] = [
    { date: 'Jan 21', score: 61, violations: 12, products_scanned: 45 },
    { date: 'Jan 28', score: 58, violations: 18, products_scanned: 62 },
    { date: 'Feb 4', score: 65, violations: 10, products_scanned: 78 },
    { date: 'Feb 11', score: 70, violations: 8, products_scanned: 91 },
    { date: 'Feb 18', score: 72, violations: 7, products_scanned: 103 },
    { date: 'Feb 19', score: 72, violations: 5, products_scanned: 106 },
];

export const mockRecentScans = [
    { name: 'Amul Taaza Milk 500ml', score: 72, platform: 'Blinkit', time: '2 mins ago', risk: 'MEDIUM' },
    { name: 'Maggi 2-Minute Noodles', score: 91, platform: 'Zepto', time: '15 mins ago', risk: 'LOW' },
    { name: 'Lays Classic Salted 52g', score: 48, platform: 'Blinkit', time: '1 hr ago', risk: 'HIGH' },
    { name: 'Britannia Good Day Biscuits', score: 85, platform: 'Zepto', time: '3 hrs ago', risk: 'LOW' },
    { name: 'Dabur Honey 500g', score: 55, platform: 'Blinkit', time: '5 hrs ago', risk: 'MEDIUM' },
];

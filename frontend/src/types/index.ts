// Types for the AI Compliance System

export interface Product {
    name: string;
    price: number;
    mrp: number;
    discount: number;
    weight: string;
    ingredients: string;
    fssai_number: string;
    manufacturer_name: string;
    manufacturer_address: string;
    expiry_date: string;
}

export interface Violation {
    id: string;
    rule: string;
    message: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    field?: string;
}

export interface Compliance {
    rule_score: number;
    violations: Violation[];
    passed_rules: string[];
    total_rules: number;
}

export interface AIAnalysis {
    summary: string;
    risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendations: string[];
    detailed_insights: string;
}

export interface EvaluateResponse {
    product: Product;
    compliance: Compliance;
    ai_analysis: AIAnalysis;
    evaluated_at: string;
    source_a_label: string;
    source_b_label: string;
    source_a_data: Partial<Product>;
    source_b_data: Partial<Product>;
}

export interface ComplianceRule {
    id: string;
    name: string;
    category: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    enabled: boolean;
    regulatory_ref: string;
}

export interface TrendDataPoint {
    date: string;
    score: number;
    violations: number;
    products_scanned: number;
}

export interface ProductDetail {
    platform: string;
    product_url: string;
    product_name: string;
    brand: string;
    price: string;
    mrp: string;
    discount: string;
    weight: string;
    description: string;
    images: string[];
    highlights: Record<string, string>;
    ingredients: string;
    nutritional_info: string;
    fssai_number: string;
    manufacturer_name: string;
    manufacturer_address: string;
    country_of_origin: string;
    expiry_date: string;
    shelf_life: string;
    seller_name: string;
    category: string;
}

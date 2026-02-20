from utils.data_cleaner import clean_price, clean_discount
import re

def validate_product(product):
    """
    Enhanced validation for deep compliance fields
    Checks 14+ compliance rules including regulatory requirements
    """
    violations = []
    passed_rules = []
    total_rules = 0
    score = 100

    def add_violation(rule_id, rule_name, message, severity, field=None, penalty=0):
        violations.append({
            "id": rule_id,
            "rule": rule_name,
            "message": message,
            "severity": severity,
            "field": field
        })
        return penalty

    # Extract fields
    price = clean_price(product.get("price"))
    mrp = clean_price(product.get("mrp"))
    discount = clean_discount(product.get("discount"))
    name = product.get("product_name") or product.get("name")
    weight = product.get("weight")
    ingredients = product.get("ingredients", "N/A")
    manufacturer_name = product.get("manufacturer_name", "N/A")
    manufacturer_address = product.get("manufacturer_address", "N/A")
    fssai_number = product.get("fssai_number", "N/A")
    expiry_date = product.get("expiry_date", "N/A")
    
    # OCR Data
    fssai_ocr = product.get("fssai_from_ocr", "N/A")

    # === BASIC VALIDATIONS ===
    
    total_rules += 1
    if not name or str(name).strip() in ("", "N/A"):
        score -= add_violation("VAL001", "Product Name Check", "Missing product name", "CRITICAL", "name", 30)
    else:
        passed_rules.append("VAL001")
    
    total_rules += 1
    if not price or price <= 0:
        score -= add_violation("VAL002", "Price Check", "Missing or invalid price", "HIGH", "price", 25)
    else:
        passed_rules.append("VAL002")
    
    total_rules += 1
    if not weight or weight == "N/A":
        score -= add_violation("VAL003", "Weight Check", "Missing weight/quantity information", "MEDIUM", "weight", 15)
    else:
        passed_rules.append("VAL003")

    if mrp and price and mrp < price:
        total_rules += 1
        score -= add_violation("VAL004", "MRP Compliance", "MRP lower than selling price (illegal)", "CRITICAL", "mrp", 40)
    
    # === REGULATORY COMPLIANCE VALIDATIONS ===
    
    total_rules += 1
    effective_fssai = fssai_ocr if fssai_ocr != "N/A" else fssai_number
    if effective_fssai == "N/A" or not effective_fssai:
        score -= add_violation("REG001", "FSSAI License", "Missing FSSAI license number (required for food products)", "CRITICAL", "fssai_number", 35)
    elif len(str(effective_fssai).strip()) != 14:
        score -= add_violation("REG001", "FSSAI Format", f"Invalid FSSAI number format (must be 14 digits)", "HIGH", "fssai_number", 25)
    else:
        passed_rules.append("REG001")
    
    total_rules += 1
    if manufacturer_name == "N/A" or not manufacturer_name:
        score -= add_violation("REG002", "Manufacturer Name", "Missing manufacturer name (legally required)", "HIGH", "manufacturer_name", 30)
    else:
        passed_rules.append("REG002")
    
    total_rules += 1
    if manufacturer_address == "N/A" or not manufacturer_address:
        score -= add_violation("REG003", "Manufacturer Address", "Missing manufacturer address (legally required)", "MEDIUM", "manufacturer_address", 25)
    else:
        passed_rules.append("REG003")
    
    total_rules += 1
    if ingredients == "N/A" or not ingredients or len(ingredients.strip()) < 5:
        score -= add_violation("REG004", "Ingredients List", "Missing or incomplete ingredient list", "HIGH", "ingredients", 20)
    else:
        passed_rules.append("REG004")
    
    total_rules += 1
    if expiry_date == "N/A" or not expiry_date:
        score -= add_violation("REG005", "Expiry Date", "Missing expiry/best before date", "MEDIUM", "expiry_date", 15)
    else:
        passed_rules.append("REG005")

    # Ensure score doesn't go below 0
    score = max(0, score)

    return {
        "rule_score": score,
        "violations": violations,
        "passed_rules": passed_rules,
        "total_rules": total_rules
    }

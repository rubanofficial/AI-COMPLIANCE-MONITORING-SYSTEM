import re

def clean_price(value):
    if not value:
        return None
    value = re.sub(r"[^\d.]", "", value)
    return float(value) if value else None

def clean_discount(value):
    if not value:
        return None
    match = re.search(r"\d+", value)
    return int(match.group()) if match else None

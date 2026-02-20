from pydantic import BaseModel
from typing import List

class ComplianceResult(BaseModel):
    score: int
    risk: str
    violations: List[str]

class ProductResponse(BaseModel):
    product: dict
    compliance: ComplianceResult

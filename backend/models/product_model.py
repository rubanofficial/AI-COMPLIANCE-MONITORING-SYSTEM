from pydantic import BaseModel
from typing import Optional

class Product(BaseModel):
    platform: str
    name: Optional[str]
    price: Optional[float]
    mrp: Optional[float]
    discount: Optional[str]

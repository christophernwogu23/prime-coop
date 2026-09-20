from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DividendCreate(BaseModel):
    title: str
    totalAmount: float
    distributionMethod: str  # "equal" or "proportional"
    description: Optional[str] = None

class DividendResponse(BaseModel):
    id: str = Field(..., alias="_id")
    title: str
    totalAmount: float
    distributionMethod: str
    description: Optional[str] = None
    totalRecipients: int
    status: str  # "pending", "distributed", "completed"
    createdBy: str
    createdAt: datetime
    distributedAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True

class DividendPaymentResponse(BaseModel):
    id: str = Field(..., alias="_id")
    dividendId: str
    userId: str
    userName: str
    amount: float
    savingsBalance: float
    status: str  # "pending", "paid"
    paidAt: Optional[datetime] = None
    createdAt: datetime
    
    class Config:
        populate_by_name = True
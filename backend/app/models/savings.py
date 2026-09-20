from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SavingsAccountResponse(BaseModel):
    id: str = Field(..., alias="_id")
    userId: str
    balance: float
    totalDeposits: float
    totalWithdrawals: float
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True

class TransactionCreate(BaseModel):
    amount: float
    transactionType: str  # "deposit" or "withdrawal"
    notes: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str = Field(..., alias="_id")
    userId: str
    savingsAccountId: str
    amount: float
    transactionType: str
    balanceAfter: float
    notes: Optional[str] = None
    recordedBy: str
    createdAt: datetime
    
    class Config:
        populate_by_name = True
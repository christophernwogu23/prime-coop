from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from datetime import datetime

class GuarantorBase(BaseModel):
    userId: str
    status: str = "pending"  # pending, approved, rejected
    approvedAt: Optional[datetime] = None

class LoanBase(BaseModel):
    loanType: str  # "General", "Equipment", "Executive"
    amount: float
    interestRate: float
    repaymentSchedule: int  # Months (or 1 for executive)
    purpose: Optional[str] = None
    applicationDate: Optional[datetime] = None  # For backdating

class LoanCreate(LoanBase):
    guarantor1Id: str
    guarantor2Id: str

class LoanUpdate(BaseModel):
    loanType: Optional[str] = None
    amount: Optional[float] = None
    interestRate: Optional[float] = None
    repaymentSchedule: Optional[int] = None
    purpose: Optional[str] = None
    status: Optional[str] = None
    disbursementDate: Optional[datetime] = None
    approvedBy: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: float
    paymentDate: Optional[datetime] = None
    notes: Optional[str] = None

class LoanResponse(BaseModel):
    id: str = Field(..., alias="_id")
    userId: str
    loanType: str
    amount: float
    interestRate: float
    totalRepaymentAmount: float
    repaymentSchedule: int
    monthlyPayment: float
    status: str  # pending, guarantor_approval, approved, disbursed, active, completed, rejected
    paymentProgress: float = 0.0
    remainingBalance: float
    purpose: Optional[str] = None
    guarantors: List[dict] = []
    disbursementDate: Optional[datetime] = None
    approvedBy: Optional[str] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True

class PaymentResponse(BaseModel):
    id: str = Field(..., alias="_id")
    loanId: str
    amount: float
    paymentDate: datetime
    recordedBy: str
    notes: Optional[str] = None
    createdAt: datetime
    
    class Config:
        populate_by_name = True
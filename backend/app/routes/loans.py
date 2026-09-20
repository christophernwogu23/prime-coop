from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from ..database import get_database
from ..utils.auth import get_current_active_user, require_admin
from ..models.loan import LoanCreate, LoanUpdate, LoanResponse, PaymentCreate, PaymentResponse
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/api/loans", tags=["Loans"])

# ─── New model for admin loan application ────────────────────────────────────
class AdminLoanCreate(BaseModel):
    userId: str                          # borrower
    loanType: str
    amount: float
    interestRate: float
    repaymentSchedule: int
    purpose: Optional[str] = ""
    applicationDate: Optional[datetime] = None
    guarantor1Id: Optional[str] = None  # optional, for record only
    guarantor2Id: Optional[str] = None  # optional, for record only

# ─── Helpers ─────────────────────────────────────────────────────────────────
def serialize_loan(loan):
    if not loan:
        return None
    for key, value in list(loan.items()):
        if isinstance(value, ObjectId):
            loan[key] = str(value)
        elif isinstance(value, datetime):
            loan[key] = value.isoformat()
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    for k, v in list(item.items()):
                        if isinstance(v, ObjectId):
                            item[k] = str(v)
                        elif isinstance(v, datetime):
                            item[k] = v.isoformat()
    return loan

def calculate_loan_details(amount: float, interest_rate: float, months: int):
    total_interest = amount * (interest_rate / 100)
    total_repayment = amount + total_interest
    monthly_payment = total_repayment / months if months > 0 else total_repayment
    return {"totalRepaymentAmount": total_repayment, "monthlyPayment": monthly_payment}


# ─── NEW: Admin applies loan for a member ────────────────────────────────────
@router.post("/admin-apply", status_code=status.HTTP_201_CREATED)
async def admin_apply_loan(
    loan_data: AdminLoanCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Admin applies a loan on behalf of any member.
    - No guarantor approval required
    - Loan is granted immediately
    - Guarantors (if provided) are stored on the record for reference only
    """

    # Validate loan type
    if loan_data.loanType not in ["General", "Equipment", "Executive"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan type")

    # Validate borrower
    try:
        borrower = await db.users.find_one({"_id": ObjectId(loan_data.userId)})
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid borrower ID")

    if not borrower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower not found")

    # Resolve guarantors (optional — for record only, no approval needed)
    guarantors = []
    for g_id in [loan_data.guarantor1Id, loan_data.guarantor2Id]:
        if g_id:
            try:
                g_user = await db.users.find_one({"_id": ObjectId(g_id)})
            except:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid guarantor ID: {g_id}")
            if not g_user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Guarantor not found: {g_id}")
            guarantors.append({
                "userId": ObjectId(g_id),
                "name": g_user.get("name", "Unknown"),
                "status": "approved",       # pre-approved — no action needed
                "approvedAt": datetime.utcnow()
            })

    # Calculate repayment
    loan_calc = calculate_loan_details(loan_data.amount, loan_data.interestRate, loan_data.repaymentSchedule)

    application_date = loan_data.applicationDate if loan_data.applicationDate else datetime.utcnow()

    loan_dict = {
        "userId":               ObjectId(loan_data.userId),
        "loanType":             loan_data.loanType,
        "amount":               loan_data.amount,
        "interestRate":         loan_data.interestRate,
        "repaymentSchedule":    loan_data.repaymentSchedule,
        "purpose":              loan_data.purpose or "",
        "totalRepaymentAmount": loan_calc["totalRepaymentAmount"],
        "monthlyPayment":       loan_calc["monthlyPayment"],
        "remainingBalance":     loan_calc["totalRepaymentAmount"],
        "status":               "granted",          # ✅ immediately granted
        "paymentProgress":      0.0,
        "guarantors":           guarantors,          # stored for reference
        "disbursementDate":     datetime.utcnow(),
        "approvalDate":         datetime.utcnow(),
        "approvedBy":           ObjectId(current_user["_id"]),
        "appliedByAdmin":       True,               # flag so UI can distinguish
        "createdAt":            application_date,
        "updatedAt":            datetime.utcnow(),
    }

    result = await db.loans.insert_one(loan_dict)
    created_loan = await db.loans.find_one({"_id": result.inserted_id})
    serialize_loan(created_loan)

    return created_loan


# ─── Existing routes (unchanged) ─────────────────────────────────────────────

@router.post("/", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_loan(
    loan_data: LoanCreate,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    valid_loan_types = ["General", "Equipment", "Executive"]
    if loan_data.loanType not in valid_loan_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan type")

    if loan_data.loanType == "Executive" and current_user["role"] not in ["executive", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Executive loans are only available for executive members")

    try:
        guarantor1 = await db.users.find_one({"_id": ObjectId(loan_data.guarantor1Id)})
        guarantor2 = await db.users.find_one({"_id": ObjectId(loan_data.guarantor2Id)})
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid guarantor ID")

    if not guarantor1 or not guarantor2:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both guarantors not found")

    if loan_data.guarantor1Id == current_user["_id"] or loan_data.guarantor2Id == current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot be your own guarantor")

    if loan_data.guarantor1Id == loan_data.guarantor2Id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Guarantors must be different people")

    # ✅ Block application if user already has an active loan
    # Active = any loan not yet completed or rejected
    active_loan = await db.loans.find_one({
        "userId": ObjectId(current_user["_id"]),
        "status": {"$in": ["guarantor_approval", "pending", "approved", "granted"]}
    })
    if active_loan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active loan. Please complete your current loan before applying for a new one."
        )

    loan_calc = calculate_loan_details(loan_data.amount, loan_data.interestRate, loan_data.repaymentSchedule)
    loan_dict = loan_data.model_dump(exclude={"guarantor1Id", "guarantor2Id"})
    application_date = loan_data.applicationDate if loan_data.applicationDate else datetime.utcnow()

    loan_dict.update({
        "userId": ObjectId(current_user["_id"]),
        "totalRepaymentAmount": loan_calc["totalRepaymentAmount"],
        "monthlyPayment": loan_calc["monthlyPayment"],
        "remainingBalance": loan_calc["totalRepaymentAmount"],
        "status": "guarantor_approval",
        "paymentProgress": 0.0,
        "guarantors": [
            {"userId": ObjectId(loan_data.guarantor1Id), "name": guarantor1["name"], "status": "pending", "approvedAt": None},
            {"userId": ObjectId(loan_data.guarantor2Id), "name": guarantor2["name"], "status": "pending", "approvedAt": None}
        ],
        "disbursementDate": None,
        "approvedBy": None,
        "createdAt": application_date,
        "updatedAt": datetime.utcnow()
    })

    result = await db.loans.insert_one(loan_dict)
    created_loan = await db.loans.find_one({"_id": result.inserted_id})
    serialize_loan(created_loan)
    return created_loan


@router.get("/")
async def get_loans(
    status: Optional[str] = Query(None),
    loanType: Optional[str] = Query(None),
    userId: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    query = {}
    if current_user["role"] != "admin":
        query["userId"] = ObjectId(current_user["_id"])
    else:
        if userId:
            try:
                query["userId"] = ObjectId(userId)
            except:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    if status:
        query["status"] = status
    if loanType:
        query["loanType"] = loanType

    total = await db.loans.count_documents(query)
    loans = await db.loans.find(query).skip(skip).limit(limit).sort("createdAt", -1).to_list(limit)

    for loan in loans:
        user = await db.users.find_one({"_id": loan.get("userId")})
        loan["userName"] = user.get("name", "Unknown") if user else "Unknown"
        serialize_loan(loan)

    return {"loans": loans, "total": total, "skip": skip, "limit": limit}


@router.get("/my-guarantees")
async def get_my_guarantees(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    user_id = ObjectId(current_user["_id"])
    loans = await db.loans.find({"guarantors.userId": user_id}).to_list(100)

    result = []
    for loan in loans:
        user = await db.users.find_one({"_id": loan.get("userId")})
        loan["userName"] = user.get("name", "Unknown") if user else "Unknown"
        for g in loan.get("guarantors", []):
            if isinstance(g.get("userId"), ObjectId) and str(g["userId"]) == current_user["_id"]:
                loan["myGuarantorStatus"] = g.get("status", "pending")
            elif isinstance(g.get("userId"), str) and g["userId"] == current_user["_id"]:
                loan["myGuarantorStatus"] = g.get("status", "pending")
        serialize_loan(loan)
        result.append(loan)

    return result


@router.get("/{loan_id}")
async def get_loan(
    loan_id: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    try:
        loan = await db.loans.find_one({"_id": ObjectId(loan_id)})
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    if current_user["role"] != "admin" and str(loan.get("userId")) != current_user["_id"]:
        is_guarantor = False
        for g in loan.get("guarantors", []):
            guarantor_id = str(g.get("userId")) if isinstance(g.get("userId"), ObjectId) else g.get("userId")
            if guarantor_id == current_user["_id"]:
                is_guarantor = True
                break
        if not is_guarantor:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this loan")

    user = await db.users.find_one({"_id": loan.get("userId")})
    loan["userName"] = user.get("name", "Unknown") if user else "Unknown"

    guarantor_doc = await db.guarantors.find_one({"loanId": loan["_id"]})
    guarantors_list = []
    if guarantor_doc and "guarantor" in guarantor_doc:
        for g in guarantor_doc["guarantor"]:
            g_user_id = g.get("userId")
            if isinstance(g_user_id, str):
                try:
                    g_user_id = ObjectId(g_user_id)
                except:
                    continue
            guarantor_user = await db.users.find_one({"_id": g_user_id})
            if guarantor_user:
                guarantors_list.append({
                    "userId": str(g_user_id),
                    "name": guarantor_user.get("name", "Unknown"),
                    "email": guarantor_user.get("email", ""),
                    "phoneNumber": str(guarantor_user.get("phoneNumber", "")),
                    "status": g.get("status", "pending"),
                    "approvedAt": g.get("approvalDate"),
                    "message": g.get("message", "")
                })

    # Also pull guarantors stored directly on the loan (admin-applied loans)
    if not guarantors_list and loan.get("guarantors"):
        for g in loan.get("guarantors", []):
            g_user_id = g.get("userId")
            if isinstance(g_user_id, ObjectId):
                g_user_id_obj = g_user_id
            else:
                try:
                    g_user_id_obj = ObjectId(str(g_user_id))
                except:
                    continue
            guarantor_user = await db.users.find_one({"_id": g_user_id_obj})
            if guarantor_user:
                guarantors_list.append({
                    "userId": str(g_user_id_obj),
                    "name": guarantor_user.get("name", "Unknown"),
                    "email": guarantor_user.get("email", ""),
                    "phoneNumber": str(guarantor_user.get("phoneNumber", "")),
                    "status": g.get("status", "approved"),
                    "approvedAt": g.get("approvedAt"),
                    "message": ""
                })

    loan["guarantorsList"] = guarantors_list

    payment_history = await db.loanhistories.find({"loanId": loan["_id"]}).sort("paymentDate", -1).to_list(100)
    payments_list = []
    for payment in payment_history:
        payments_list.append({
            "_id": str(payment["_id"]) if payment.get("_id") else None,
            "amountPaid": payment.get("amountPaid", 0),
            "paymentDate": payment.get("paymentDate").isoformat() if isinstance(payment.get("paymentDate"), datetime) else str(payment.get("paymentDate")),
            "remainingBalance": payment.get("remainingBalance", 0),
            "notes": payment.get("notes", "")
        })

    loan["paymentHistory"] = payments_list
    serialize_loan(loan)
    return loan


@router.put("/{loan_id}/guarantor-response")
async def respond_to_guarantee(
    loan_id: str,
    response: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    if response not in ["approve", "reject"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Response must be 'approve' or 'reject'")

    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    loan = await db.loans.find_one({"_id": loan_obj_id})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    guarantor_index = None
    for i, g in enumerate(loan.get("guarantors", [])):
        if str(g["userId"]) == current_user["_id"]:
            guarantor_index = i
            break

    if guarantor_index is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a guarantor for this loan")

    new_status = "approved" if response == "approve" else "rejected"
    await db.loans.update_one(
        {"_id": loan_obj_id},
        {"$set": {
            f"guarantors.{guarantor_index}.status": new_status,
            f"guarantors.{guarantor_index}.approvedAt": datetime.utcnow() if response == "approve" else None,
            "updatedAt": datetime.utcnow()
        }}
    )

    updated_loan = await db.loans.find_one({"_id": loan_obj_id})
    all_approved = all(g["status"] == "approved" for g in updated_loan.get("guarantors", []))
    any_rejected = any(g["status"] == "rejected" for g in updated_loan.get("guarantors", []))

    if any_rejected:
        await db.loans.update_one({"_id": loan_obj_id}, {"$set": {"status": "rejected", "updatedAt": datetime.utcnow()}})
    elif all_approved:
        await db.loans.update_one({"_id": loan_obj_id}, {"$set": {"status": "pending", "updatedAt": datetime.utcnow()}})

    final_loan = await db.loans.find_one({"_id": loan_obj_id})
    serialize_loan(final_loan)
    return final_loan


@router.put("/{loan_id}/approve")
async def approve_loan(
    loan_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    loan = await db.loans.find_one({"_id": loan_obj_id})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    if loan.get("status") != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Loan must be approved by guarantors first")

    await db.loans.update_one(
        {"_id": loan_obj_id},
        {"$set": {"status": "granted", "approvalDate": datetime.utcnow(), "updatedAt": datetime.utcnow()}}
    )

    updated_loan = await db.loans.find_one({"_id": loan_obj_id})
    serialize_loan(updated_loan)
    return updated_loan


@router.put("/{loan_id}/reject")
async def reject_loan(
    loan_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    await db.loans.update_one({"_id": loan_obj_id}, {"$set": {"status": "rejected", "updatedAt": datetime.utcnow()}})
    updated_loan = await db.loans.find_one({"_id": loan_obj_id})
    serialize_loan(updated_loan)
    return updated_loan


@router.delete("/{loan_id}")
async def delete_loan(
    loan_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    loan = await db.loans.find_one({"_id": loan_obj_id})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    await db.loans.delete_one({"_id": loan_obj_id})
    await db.loanhistories.delete_many({"loanId": loan_obj_id})
    return {"message": "Loan deleted successfully", "deleted_loan_id": loan_id}


@router.put("/{loan_id}/edit")
async def edit_loan(
    loan_id: str,
    loan_update: LoanUpdate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    loan = await db.loans.find_one({"_id": loan_obj_id})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    update_data = loan_update.model_dump(exclude_unset=True)

    if any(key in update_data for key in ["amount", "interestRate", "repaymentSchedule"]):
        new_amount = update_data.get("amount", loan["amount"])
        new_rate = update_data.get("interestRate", loan["interestRate"])
        new_schedule = update_data.get("repaymentSchedule", loan["repaymentSchedule"])
        loan_calc = calculate_loan_details(new_amount, new_rate, new_schedule)
        update_data["totalRepaymentAmount"] = loan_calc["totalRepaymentAmount"]
        update_data["monthlyPayment"] = loan_calc["monthlyPayment"]
        total_paid = loan["totalRepaymentAmount"] - loan["remainingBalance"]
        update_data["remainingBalance"] = loan_calc["totalRepaymentAmount"] - total_paid
        if loan_calc["totalRepaymentAmount"] > 0:
            update_data["paymentProgress"] = (total_paid / loan_calc["totalRepaymentAmount"]) * 100

    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.loans.update_one({"_id": loan_obj_id}, {"$set": update_data})

    updated_loan = await db.loans.find_one({"_id": loan_obj_id})
    serialize_loan(updated_loan)
    return updated_loan


@router.post("/{loan_id}/payment")
async def record_payment(
    loan_id: str,
    payment_data: PaymentCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    loan = await db.loans.find_one({"_id": loan_obj_id})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    if loan["status"] not in ["granted", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot record payment for this loan status. Loan must be granted first."
        )

    # ✅ Calculate new_balance FIRST
    new_balance = loan["remainingBalance"] - payment_data.amount
    payment_progress = ((loan["totalRepaymentAmount"] - new_balance) / loan["totalRepaymentAmount"]) * 100

    payment_dict = {
        "loanId": loan_obj_id,
        "userId": loan["userId"],
        "amountPaid": payment_data.amount,
        "paymentDate": payment_data.paymentDate or datetime.utcnow(),
        "totalRepaymentAmount": loan["totalRepaymentAmount"],
        "remainingBalance": max(0, new_balance),
        "notes": payment_data.notes,
        "recordedBy": current_user["_id"]
    }

    await db.loanhistories.insert_one(payment_dict)

    update_data = {
        "remainingBalance": max(0, new_balance),
        "paymentProgress": min(100, payment_progress),
        "updatedAt": datetime.utcnow()
    }

    if new_balance <= 0:
        update_data["status"] = "completed"

    await db.loans.update_one({"_id": loan_obj_id}, {"$set": update_data})
    return {"message": "Payment recorded successfully"}


@router.put("/payment/{payment_id}")
async def edit_payment(
    payment_id: str,
    amount: float,
    payment_date: Optional[datetime] = None,
    notes: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        payment_obj_id = ObjectId(payment_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment ID")

    payment = await db.loanhistories.find_one({"_id": payment_obj_id})
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    loan = await db.loans.find_one({"_id": payment["loanId"]})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated loan not found")

    old_amount = payment["amountPaid"]
    amount_difference = amount - old_amount
    update_data = {"amountPaid": amount, "updatedAt": datetime.utcnow()}

    if payment_date:
        update_data["paymentDate"] = payment_date
    if notes is not None:
        update_data["notes"] = notes

    await db.loanhistories.update_one({"_id": payment_obj_id}, {"$set": update_data})

    new_remaining = loan["remainingBalance"] - amount_difference
    new_progress = ((loan["totalRepaymentAmount"] - new_remaining) / loan["totalRepaymentAmount"]) * 100 if loan["totalRepaymentAmount"] > 0 else 0

    loan_update = {
        "remainingBalance": max(0, new_remaining),
        "paymentProgress": min(100, new_progress),
        "updatedAt": datetime.utcnow()
    }
    if new_remaining <= 0:
        loan_update["status"] = "completed"

    await db.loans.update_one({"_id": loan["_id"]}, {"$set": loan_update})
    return {"message": "Payment updated successfully"}


@router.delete("/payment/{payment_id}")
async def delete_payment(
    payment_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    try:
        payment_obj_id = ObjectId(payment_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment ID")

    payment = await db.loanhistories.find_one({"_id": payment_obj_id})
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    loan = await db.loans.find_one({"_id": payment["loanId"]})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated loan not found")

    await db.loanhistories.delete_one({"_id": payment_obj_id})

    new_remaining = loan["remainingBalance"] + payment["amountPaid"]
    new_progress = ((loan["totalRepaymentAmount"] - new_remaining) / loan["totalRepaymentAmount"]) * 100 if loan["totalRepaymentAmount"] > 0 else 0

    loan_update = {
        "remainingBalance": new_remaining,
        "paymentProgress": max(0, new_progress),
        "status": "granted",
        "updatedAt": datetime.utcnow()
    }
    await db.loans.update_one({"_id": loan["_id"]}, {"$set": loan_update})
    return {"message": "Payment deleted successfully"}


@router.get("/{loan_id}/payments")
async def get_loan_payments(
    loan_id: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    try:
        loan_obj_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid loan ID")

    loan = await db.loans.find_one({"_id": loan_obj_id})
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    if current_user["role"] != "admin" and str(loan["userId"]) != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    payments = await db.loanhistories.find({"loanId": loan_obj_id}).sort("paymentDate", -1).to_list(100)

    for payment in payments:
        for key, value in list(payment.items()):
            if isinstance(value, ObjectId):
                payment[key] = str(value)
            elif isinstance(value, datetime):
                payment[key] = value.isoformat()

    return payments
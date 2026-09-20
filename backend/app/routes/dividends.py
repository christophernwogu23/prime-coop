from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from ..database import get_database
from ..utils.auth import get_current_active_user, require_admin
from ..models.dividend import DividendCreate, DividendResponse, DividendPaymentResponse
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/dividends", tags=["Dividends"])

@router.post("/", response_model=DividendResponse, status_code=status.HTTP_201_CREATED)
async def create_dividend(
    dividend_data: DividendCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Create a new dividend distribution (admin only)"""
    
    if dividend_data.totalAmount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total amount must be greater than 0"
        )
    
    if dividend_data.distributionMethod not in ["equal", "proportional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Distribution method must be 'equal' or 'proportional'"
        )
    
    # Get all active users with savings accounts
    savings_accounts = await db.savings.find({"balance": {"$gt": 0}}).to_list(None)
    
    if len(savings_accounts) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No members with savings found"
        )
    
    # Calculate dividends
    dividend_payments = []
    
    if dividend_data.distributionMethod == "equal":
        # Equal distribution
        amount_per_person = dividend_data.totalAmount / len(savings_accounts)
        
        for account in savings_accounts:
            user = await db.users.find_one({"_id": account["userId"]})
            if user:
                dividend_payments.append({
                    "userId": account["userId"],
                    "userName": user["name"],
                    "amount": amount_per_person,
                    "savingsBalance": account["balance"]
                })
    
    else:  # proportional
        # Proportional to savings balance
        total_savings = sum(acc["balance"] for acc in savings_accounts)
        
        for account in savings_accounts:
            user = await db.users.find_one({"_id": account["userId"]})
            if user:
                proportion = account["balance"] / total_savings
                amount = dividend_data.totalAmount * proportion
                dividend_payments.append({
                    "userId": account["userId"],
                    "userName": user["name"],
                    "amount": amount,
                    "savingsBalance": account["balance"]
                })
    
    # Create dividend record
    dividend_dict = dividend_data.model_dump()
    dividend_dict.update({
        "totalRecipients": len(dividend_payments),
        "status": "pending",
        "createdBy": current_user["_id"],
        "createdAt": datetime.utcnow(),
        "distributedAt": None
    })
    
    result = await db.dividends.insert_one(dividend_dict)
    dividend_id = result.inserted_id
    
    # Create payment records
    for payment in dividend_payments:
        payment_dict = {
            "dividendId": dividend_id,
            "userId": payment["userId"],
            "userName": payment["userName"],
            "amount": payment["amount"],
            "savingsBalance": payment["savingsBalance"],
            "status": "pending",
            "paidAt": None,
            "createdAt": datetime.utcnow()
        }
        await db.dividend_payments.insert_one(payment_dict)
    
    # Get created dividend
    created_dividend = await db.dividends.find_one({"_id": dividend_id})
    created_dividend["_id"] = str(created_dividend["_id"])
    created_dividend["createdBy"] = str(created_dividend["createdBy"])
    
    return created_dividend

@router.get("/")
async def get_dividends(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get all dividends (admin only)"""
    
    # Get total count
    total = await db.dividends.count_documents({})
    
    # Get dividends
    dividends = await db.dividends.find().sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    # Format response
    for dividend in dividends:
        dividend["_id"] = str(dividend["_id"])
        dividend["createdBy"] = str(dividend["createdBy"])
        
        # Get creator name
        creator = await db.users.find_one({"_id": ObjectId(dividend["createdBy"])})
        dividend["createdByName"] = creator["name"] if creator else "Unknown"
    
    return {
        "dividends": dividends,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/my-dividends")
async def get_my_dividends(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get current user's dividend payments"""
    
    user_id = ObjectId(current_user["_id"])
    
    # Get total count
    total = await db.dividend_payments.count_documents({"userId": user_id})
    
    # Get payments
    payments = await db.dividend_payments.find(
        {"userId": user_id}
    ).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    # Format response and get dividend details
    for payment in payments:
        payment["_id"] = str(payment["_id"])
        payment["dividendId"] = str(payment["dividendId"])
        payment["userId"] = str(payment["userId"])
        
        # Get dividend title
        dividend = await db.dividends.find_one({"_id": ObjectId(payment["dividendId"])})
        if dividend:
            payment["dividendTitle"] = dividend["title"]
            payment["distributionMethod"] = dividend["distributionMethod"]
    
    return {
        "payments": payments,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{dividend_id}")
async def get_dividend_details(
    dividend_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get dividend details with all payments (admin only)"""
    
    try:
        dividend_obj_id = ObjectId(dividend_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dividend ID"
        )
    
    # Get dividend
    dividend = await db.dividends.find_one({"_id": dividend_obj_id})
    if not dividend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dividend not found"
        )
    
    dividend["_id"] = str(dividend["_id"])
    dividend["createdBy"] = str(dividend["createdBy"])
    
    # Get creator name
    creator = await db.users.find_one({"_id": ObjectId(dividend["createdBy"])})
    dividend["createdByName"] = creator["name"] if creator else "Unknown"
    
    # Get all payments for this dividend
    payments = await db.dividend_payments.find({"dividendId": dividend_obj_id}).to_list(None)
    
    for payment in payments:
        payment["_id"] = str(payment["_id"])
        payment["dividendId"] = str(payment["dividendId"])
        payment["userId"] = str(payment["userId"])
    
    dividend["payments"] = payments
    
    # Calculate statistics
    total_paid = sum(p["amount"] for p in payments if p["status"] == "paid")
    total_pending = sum(p["amount"] for p in payments if p["status"] == "pending")
    paid_count = sum(1 for p in payments if p["status"] == "paid")
    
    dividend["statistics"] = {
        "totalPaid": total_paid,
        "totalPending": total_pending,
        "paidCount": paid_count,
        "pendingCount": len(payments) - paid_count
    }
    
    return dividend

@router.put("/{dividend_id}/distribute")
async def distribute_dividend(
    dividend_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Mark dividend as distributed and add to members' savings (admin only)"""
    
    try:
        dividend_obj_id = ObjectId(dividend_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dividend ID"
        )
    
    # Get dividend
    dividend = await db.dividends.find_one({"_id": dividend_obj_id})
    if not dividend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dividend not found"
        )
    
    if dividend["status"] == "distributed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dividend already distributed"
        )
    
    # Get all payments for this dividend
    payments = await db.dividend_payments.find({"dividendId": dividend_obj_id}).to_list(None)
    
    # Add dividend amount to each member's savings
    for payment in payments:
        # Update savings balance
        await db.savings.update_one(
            {"userId": payment["userId"]},
            {
                "$inc": {
                    "balance": payment["amount"],
                    "totalDeposits": payment["amount"]
                },
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        
        # Get updated account
        account = await db.savings.find_one({"userId": payment["userId"]})
        
        # Create transaction record
        transaction_data = {
            "userId": payment["userId"],
            "savingsAccountId": account["_id"],
            "amount": payment["amount"],
            "transactionType": "deposit",
            "balanceAfter": account["balance"],
            "notes": f"Dividend: {dividend['title']}",
            "recordedBy": current_user["_id"],
            "createdAt": datetime.utcnow()
        }
        await db.savings_transactions.insert_one(transaction_data)
        
        # Mark payment as paid
        await db.dividend_payments.update_one(
            {"_id": payment["_id"]},
            {
                "$set": {
                    "status": "paid",
                    "paidAt": datetime.utcnow()
                }
            }
        )
    
    # Update dividend status
    await db.dividends.update_one(
        {"_id": dividend_obj_id},
        {
            "$set": {
                "status": "distributed",
                "distributedAt": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Dividend distributed successfully"}

@router.get("/statistics/overview")
async def get_dividend_statistics(
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get overall dividend statistics (admin only)"""
    
    # Total dividends
    total_dividends = await db.dividends.count_documents({})
    distributed_dividends = await db.dividends.count_documents({"status": "distributed"})
    pending_dividends = await db.dividends.count_documents({"status": "pending"})
    
    # Total amounts
    all_dividends = await db.dividends.find().to_list(None)
    total_amount_all = sum(d["totalAmount"] for d in all_dividends)
    total_amount_distributed = sum(d["totalAmount"] for d in all_dividends if d["status"] == "distributed")
    total_amount_pending = sum(d["totalAmount"] for d in all_dividends if d["status"] == "pending")
    
    # Recent dividends
    recent = await db.dividends.find().sort("createdAt", -1).limit(5).to_list(5)
    for div in recent:
        div["_id"] = str(div["_id"])
        div["createdBy"] = str(div["createdBy"])
    
    return {
        "totalDividends": total_dividends,
        "distributedDividends": distributed_dividends,
        "pendingDividends": pending_dividends,
        "totalAmountAll": total_amount_all,
        "totalAmountDistributed": total_amount_distributed,
        "totalAmountPending": total_amount_pending,
        "recentDividends": recent
    }
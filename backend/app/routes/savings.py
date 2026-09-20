from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from ..database import get_database
from ..utils.auth import get_current_active_user, require_admin
from ..models.savings import SavingsAccountResponse, TransactionCreate, TransactionResponse
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/savings", tags=["Savings"])

@router.get("/my-account")
async def get_my_savings_account(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get current user's savings account"""
    
    user_id = ObjectId(current_user["_id"])
    
    account = await db.accountbalances.find_one({"userId": user_id})
    
    if not account:
        return {
            "_id": None,
            "userId": str(user_id),
            "balance": 0.0,
            "totalDeposits": 0.0,
            "totalWithdrawals": 0.0,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat()
        }
    
    response = {
        "_id": str(account["_id"]),
        "userId": str(account["userId"]),
        "balance": float(account.get("balanceAmount", 0)),
        "totalDeposits": 0.0,
        "totalWithdrawals": 0.0,
        "createdAt": account.get("updatedAt", datetime.utcnow()).isoformat() if isinstance(account.get("updatedAt"), datetime) else str(account.get("updatedAt")),
        "updatedAt": account.get("updatedAt", datetime.utcnow()).isoformat() if isinstance(account.get("updatedAt"), datetime) else str(account.get("updatedAt"))
    }
    
    return response

@router.get("/accounts")
async def get_all_savings_accounts(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get all savings accounts (admin only)"""
    
    user_query = {"active": True}
    if search:
        user_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.users.count_documents(user_query)
    users_list = await db.users.find(user_query).skip(skip).limit(limit).sort("name", 1).to_list(limit)
    
    accounts = []
    for user in users_list:
        account_balance = await db.accountbalances.find_one({"userId": user["_id"]})
        
        balance_amount = account_balance.get("balanceAmount", 0) if account_balance else 0
        
        account = {
            "_id": str(account_balance["_id"]) if account_balance and account_balance.get("_id") else None,
            "userId": str(user["_id"]),
            "userName": user.get("name", "Unknown"),
            "userEmail": user.get("email", ""),
            "balance": float(balance_amount) if balance_amount else 0.0,
            "totalDeposits": 0.0,
            "totalWithdrawals": 0.0
        }
        
        accounts.append(account)
    
    return {
        "accounts": accounts,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/account/{user_id}")
async def get_user_savings_account(
    user_id: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get specific user's savings account"""
    
    if current_user["role"] != "admin" and user_id != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this account"
        )
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    account = await db.accountbalances.find_one({"userId": user_obj_id})
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings account not found"
        )
    
    response = {
        "_id": str(account["_id"]),
        "userId": str(account["userId"]),
        "balance": account.get("balanceAmount", 0),
        "totalDeposits": 0,
        "totalWithdrawals": 0,
        "updatedAt": account.get("updatedAt")
    }
    
    return response

@router.post("/deposit/{user_id}")
async def make_deposit_for_user(
    user_id: str,
    transaction: TransactionCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Make a deposit for a specific user (admin only)"""
    
    if transaction.transactionType != "deposit":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction type must be 'deposit'"
        )
    
    if transaction.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than 0"
        )
    
    return await _process_transaction(
        user_id,
        transaction.amount,
        "deposit",
        transaction.notes,
        current_user["_id"],
        db
    )

@router.post("/withdrawal/{user_id}")
async def make_withdrawal_for_user(
    user_id: str,
    transaction: TransactionCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Make a withdrawal for a specific user (admin only)"""
    
    if transaction.transactionType != "withdrawal":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction type must be 'withdrawal'"
        )
    
    if transaction.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than 0"
        )
    
    return await _process_transaction(
        user_id,
        transaction.amount,
        "withdrawal",
        transaction.notes,
        current_user["_id"],
        db
    )

async def _process_transaction(
    user_id: str,
    amount: float,
    transaction_type: str,
    notes: Optional[str],
    recorded_by: str,
    db
):
    """Helper function to process deposit/withdrawal"""
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    account = await db.accountbalances.find_one({"userId": user_obj_id})
    
    if not account:
        account_data = {
            "userId": user_obj_id,
            "balanceAmount": 0.0,
            "updatedAt": datetime.utcnow()
        }
        result = await db.accountbalances.insert_one(account_data)
        account = await db.accountbalances.find_one({"_id": result.inserted_id})
    
    current_balance = account.get("balanceAmount", 0)
    
    if transaction_type == "deposit":
        new_balance = current_balance + amount
    else:
        if current_balance < amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient balance"
            )
        new_balance = current_balance - amount
    
    await db.accountbalances.update_one(
        {"_id": account["_id"]},
        {"$set": {"balanceAmount": new_balance, "updatedAt": datetime.utcnow()}}
    )
    
    transaction_data = {
        "userId": user_obj_id,
        "amount": amount,
        "transactionType": transaction_type,
        "balanceAfter": new_balance,
        "notes": notes,
        "recordedBy": recorded_by,
        "createdAt": datetime.utcnow()
    }
    
    await db.accounthistories.insert_one(transaction_data)
    
    return {
        "message": f"{transaction_type.capitalize()} recorded successfully",
        "newBalance": new_balance,
        "amount": amount
    }

@router.get("/transactions")
async def get_my_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get current user's transaction history"""
    
    user_id = ObjectId(current_user["_id"])
    
    total = await db.accounthistories.count_documents({"userId": user_id})
    transactions = await db.accounthistories.find(
        {"userId": user_id}
    ).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    for transaction in transactions:
        for key, value in list(transaction.items()):
            if isinstance(value, ObjectId):
                transaction[key] = str(value)
            elif isinstance(value, datetime):
                transaction[key] = value.isoformat()
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/transactions/{user_id}")
async def get_user_transactions(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get specific user's transaction history"""
    
    if current_user["role"] != "admin" and user_id != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these transactions"
        )
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    total = await db.accounthistories.count_documents({"userId": user_obj_id})
    transactions = await db.accounthistories.find(
        {"userId": user_obj_id}
    ).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    for transaction in transactions:
        for key, value in list(transaction.items()):
            if isinstance(value, ObjectId):
                transaction[key] = str(value)
            elif isinstance(value, datetime):
                transaction[key] = value.isoformat()
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/statistics")
async def get_savings_statistics(
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get overall savings statistics (admin only)"""
    
    pipeline = [
        {
            "$group": {
                "_id": None,
                "totalBalance": {"$sum": "$balanceAmount"},
                "accountCount": {"$sum": 1}
            }
        }
    ]
    
    result = await db.accountbalances.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        del stats["_id"]
    else:
        stats = {
            "totalBalance": 0,
            "accountCount": 0
        }
    
    stats["totalDeposits"] = 0
    stats["totalWithdrawals"] = 0
    
    top_savers = await db.accountbalances.find().sort("balanceAmount", -1).limit(5).to_list(5)
    
    top_savers_list = []
    for saver in top_savers:
        user = await db.users.find_one({"_id": saver["userId"]})
        if user:
            top_savers_list.append({
                "_id": str(saver["_id"]),
                "userId": str(saver["userId"]),
                "userName": user.get("name", "Unknown"),
                "balance": float(saver.get("balanceAmount", 0))
            })
    
    stats["topSavers"] = top_savers_list
    
    return stats
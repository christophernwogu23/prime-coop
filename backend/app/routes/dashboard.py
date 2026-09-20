from fastapi import APIRouter, Depends
from ..database import get_database
from ..utils.auth import get_current_active_user
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get dashboard statistics"""
    
    # Total users
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"active": True})
    pending_approvals = await db.users.count_documents({"isApproved": False})
    
    # Total loans
    total_loans = await db.loans.count_documents({})
    active_loans = await db.loans.count_documents({"status": "granted"})
    pending_loans = await db.loans.count_documents({"status": {"$in": ["approved", "pending", "guarantor_approval"]}})
    completed_loans = await db.loans.count_documents({"status": "completed"})
    
    # Loan amounts
    active_loans_pipeline = [
        {"$match": {"status": "granted"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    active_loans_result = await db.loans.aggregate(active_loans_pipeline).to_list(1)
    total_active_loan_amount = active_loans_result[0]["total"] if active_loans_result else 0
    
    # Total remaining balance
    remaining_balance_pipeline = [
        {"$match": {"status": "granted"}},
        {"$group": {"_id": None, "total": {"$sum": "$remainingBalance"}}}
    ]
    remaining_balance_result = await db.loans.aggregate(remaining_balance_pipeline).to_list(1)
    total_remaining_balance = remaining_balance_result[0]["total"] if remaining_balance_result else 0
    
    # Total disbursed (granted + completed loans)
    disbursed_loans_pipeline = [
        {"$match": {"status": {"$in": ["granted", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    disbursed_loans_result = await db.loans.aggregate(disbursed_loans_pipeline).to_list(1)
    total_disbursed = disbursed_loans_result[0]["total"] if disbursed_loans_result else 0
    
    # Total repaid
    repaid_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amountPaid"}}}
    ]
    repaid_result = await db.loanhistories.aggregate(repaid_pipeline).to_list(1)
    total_repaid = repaid_result[0]["total"] if repaid_result else 0
    
    # Total savings from accountbalances collection
    savings_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$balanceAmount"}}}
    ]
    savings_result = await db.accountbalances.aggregate(savings_pipeline).to_list(1)
    total_savings = savings_result[0]["total"] if savings_result else 0
    
    # Total deposits and withdrawals - set to 0 for now (would need to calculate from accounthistories)
    total_deposits = 0
    total_withdrawals = 0
    
    # Total dividends
    dividends_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$totalAmount"}}}
    ]
    dividends_result = await db.dividends.aggregate(dividends_pipeline).to_list(1)
    total_dividends = dividends_result[0]["total"] if dividends_result else 0
    
    # User-specific stats (if not admin)
    user_stats = None
    if current_user.get("role") != "admin":
        user_id = ObjectId(current_user["_id"])
        
        # User's loans
        user_loans = await db.loans.count_documents({"userId": user_id})
        user_active_loans = await db.loans.count_documents({
            "userId": user_id, 
            "status": "granted"
        })
        
        # User's loan balance
        user_loans_pipeline = [
            {"$match": {"userId": user_id, "status": "granted"}},
            {"$group": {"_id": None, "total": {"$sum": "$remainingBalance"}}}
        ]
        user_loans_result = await db.loans.aggregate(user_loans_pipeline).to_list(1)
        user_loan_balance = user_loans_result[0]["total"] if user_loans_result else 0
        
        # User's savings from accountbalances
        user_account = await db.accountbalances.find_one({"userId": user_id})
        user_savings_balance = user_account.get("balanceAmount", 0) if user_account else 0
        
        user_stats = {
            "totalLoans": user_loans,
            "activeLoans": user_active_loans,
            "loanBalance": user_loan_balance,
            "savingsBalance": user_savings_balance
        }
    
    return {
        "overview": {
            "totalUsers": total_users,
            "activeUsers": active_users,
            "pendingApprovals": pending_approvals,
            "totalLoans": total_loans,
            "activeLoans": active_loans,
            "pendingLoans": pending_loans,
            "completedLoans": completed_loans,
            "totalActiveLoanAmount": total_active_loan_amount,
            "totalDisbursed": total_disbursed,
            "totalRemainingBalance": total_remaining_balance,
            "totalRepaid": total_repaid,
            "totalSavings": total_savings,
            "totalDeposits": total_deposits,
            "totalWithdrawals": total_withdrawals,
            "totalDividends": total_dividends
        },
        "userStats": user_stats
    }

@router.get("/recent-activities")
async def get_recent_activities(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get recent activities"""
    
    activities = []
    is_admin = current_user.get("role") == "admin"
    user_id = ObjectId(current_user["_id"])
    
    try:
        # Get recent loans
        if is_admin:
            recent_loans = await db.loans.find().sort("createdAt", -1).limit(10).to_list(10)
        else:
            # Users only see their own loans
            recent_loans = await db.loans.find({"userId": user_id}).sort("createdAt", -1).limit(10).to_list(10)
        
        for loan in recent_loans:
            try:
                user = await db.users.find_one({"_id": loan.get("userId")})
                timestamp = loan.get("createdAt")
                if timestamp:
                    if isinstance(timestamp, datetime):
                        timestamp = timestamp.isoformat()
                    else:
                        timestamp = str(timestamp)
                else:
                    timestamp = datetime.utcnow().isoformat()
                
                # For regular users, use "You" instead of their name
                if is_admin:
                    description = f"{user.get('name', 'Unknown') if user else 'Unknown'} applied for ₦{loan.get('amount', 0):,.2f} loan"
                else:
                    description = f"You applied for ₦{loan.get('amount', 0):,.2f} {loan.get('loanType', 'loan')}"
                
                activities.append({
                    "type": "loan",
                    "description": description,
                    "timestamp": timestamp,
                    "status": loan.get("status", "unknown")
                })
            except Exception as e:
                print(f"Error processing loan: {e}")
                continue
    except Exception as e:
        print(f"Error fetching loans: {e}")
    
    # Admin sees user registrations, regular users don't
    if is_admin:
        try:
            recent_users = await db.users.find().sort("createdAt", -1).limit(10).to_list(10)
            
            for user_doc in recent_users:
                try:
                    timestamp = user_doc.get("createdAt")
                    if timestamp:
                        if isinstance(timestamp, datetime):
                            timestamp = timestamp.isoformat()
                        else:
                            timestamp = str(timestamp)
                    else:
                        timestamp = datetime.utcnow().isoformat()
                    
                    activities.append({
                        "type": "user",
                        "description": f"{user_doc.get('name', 'Unknown')} registered",
                        "timestamp": timestamp,
                        "status": "approved" if user_doc.get("isApproved", True) else "pending"
                    })
                except Exception as e:
                    print(f"Error processing user: {e}")
                    continue
        except Exception as e:
            print(f"Error fetching users: {e}")
    
    try:
        # Get recent payments
        if is_admin:
            recent_payments = await db.loanhistories.find().sort("paymentDate", -1).limit(10).to_list(10)
        else:
            # Users only see their own payments
            recent_payments = await db.loanhistories.find({"userId": user_id}).sort("paymentDate", -1).limit(10).to_list(10)
        
        for payment in recent_payments:
            try:
                user = await db.users.find_one({"_id": payment.get("userId")})
                timestamp = payment.get("paymentDate")
                if timestamp:
                    if isinstance(timestamp, datetime):
                        timestamp = timestamp.isoformat()
                    else:
                        timestamp = str(timestamp)
                else:
                    timestamp = datetime.utcnow().isoformat()
                
                # For regular users, use "You" instead of their name
                if is_admin:
                    description = f"{user.get('name', 'Unknown') if user else 'Unknown'} paid ₦{payment.get('amountPaid', 0):,.2f}"
                else:
                    description = f"You paid ₦{payment.get('amountPaid', 0):,.2f} on your loan"
                
                activities.append({
                    "type": "payment",
                    "description": description,
                    "timestamp": timestamp,
                    "status": "completed"
                })
            except Exception as e:
                print(f"Error processing payment: {e}")
                continue
    except Exception as e:
        print(f"Error fetching payments: {e}")
    
    # Sort by timestamp
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return activities[:15]
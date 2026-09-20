from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from ..database import get_database
from ..utils.auth import get_current_active_user, require_admin
from ..models.user import UserUpdate
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/users", tags=["Users"])

def serialize_user(user):
    """Convert ObjectIds and datetimes to JSON-serializable types"""
    if not user:
        return None
    
    for key, value in list(user.items()):
        if isinstance(value, ObjectId):
            user[key] = str(value)
        elif isinstance(value, datetime):
            user[key] = value.isoformat()
        elif key in ["phoneNumber", "nextOfKinNumber"] and isinstance(value, (int, float)):
            user[key] = str(int(value))
    
    # Add defaults for missing fields
    if "isApproved" not in user:
        user["isApproved"] = True
    if "updatedAt" not in user:
        user["updatedAt"] = user.get("createdAt")
    
    return user


# ✅ MUST be defined BEFORE /{user_id} routes so FastAPI doesn't
#    treat "guarantor-list" as a user_id path parameter
@router.get("/guarantor-list")
async def get_guarantor_list(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get list of users for guarantor selection (all authenticated users can access)"""
    
    users = await db.users.find({
        "active": True,
        "$or": [
            {"isApproved": True},
            {"isApproved": {"$exists": False}}
        ]
    }).sort("name", 1).to_list(1000)
    
    # Return only essential info needed for guarantor dropdowns
    guarantor_list = []
    for user in users:
        guarantor_list.append({
            "_id": str(user["_id"]),
            "name": user.get("name", "Unknown")
        })
    
    return guarantor_list


@router.get("/")
async def get_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get all users with optional filtering (admin only)"""
    
    query = {}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    
    if role:
        query["role"] = role
    
    if status == "pending":
        query["isApproved"] = False
    elif status == "active":
        query["active"] = True
        query["$or"] = [
            {"isApproved": True},
            {"isApproved": {"$exists": False}}
        ]
    elif status == "inactive":
        query["active"] = False
    
    total = await db.users.count_documents(query)
    users = await db.users.find(query).skip(skip).limit(limit).sort("createdAt", -1).to_list(limit)
    
    users = [serialize_user(user) for user in users]
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Get a specific user by ID (admin only)"""
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return serialize_user(user)


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Update a user (admin only)"""
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    existing_user = await db.users.find_one({"_id": user_obj_id})
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    update_data = user_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        
        result = await db.users.update_one(
            {"_id": user_obj_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No changes made"
            )
    
    updated_user = await db.users.find_one({"_id": user_obj_id})
    return serialize_user(updated_user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Delete a user (admin only)"""
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    if str(user_obj_id) == current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
    
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.users.delete_one({"_id": user_obj_id})
    
    return {"message": "User deleted successfully", "deleted_user_id": user_id}


@router.put("/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Approve a pending user (admin only)"""
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    result = await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"isApproved": True, "role": "member", "updatedAt": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or already approved"
        )
    
    updated_user = await db.users.find_one({"_id": user_obj_id})
    return serialize_user(updated_user)


@router.put("/{user_id}/reject")
async def reject_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Reject and delete a pending user (admin only)"""
    
    try:
        user_obj_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    result = await db.users.delete_one({"_id": user_obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User rejected and deleted successfully"}
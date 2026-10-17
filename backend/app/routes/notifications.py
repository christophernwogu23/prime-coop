from fastapi import APIRouter, Depends, HTTPException, status
from ..database import get_database
from ..utils.auth import get_current_active_user, require_admin
from bson import ObjectId
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

# ─── Helper: call this from other routes to create a notification ─────────────
async def create_notification(db, user_id: str, type: str, title: str, message: str, related_id: str = None):
    """
    Create a notification for a user.
    Call this from loans/savings routes when key events happen.
    
    Types:
    - loan_applied         → sent to guarantors
    - guarantor_approved   → sent to loan applicant
    - guarantor_rejected   → sent to loan applicant
    - loan_granted         → sent to member
    - loan_rejected        → sent to member
    - payment_recorded     → sent to member
    - savings_confirmed    → sent to member
    """
    notification = {
        "userId":    ObjectId(user_id),
        "type":      type,
        "title":     title,
        "message":   message,
        "isRead":    False,
        "createdAt": datetime.utcnow(),
        "relatedId": ObjectId(related_id) if related_id else None,
    }
    await db.notifications.insert_one(notification)


def serialize_notification(n):
    if not n:
        return None
    return {
        "_id":       str(n["_id"]),
        "userId":    str(n["userId"]),
        "type":      n.get("type", ""),
        "title":     n.get("title", ""),
        "message":   n.get("message", ""),
        "isRead":    n.get("isRead", False),
        "createdAt": n["createdAt"].isoformat() if isinstance(n.get("createdAt"), datetime) else str(n.get("createdAt")),
        "relatedId": str(n["relatedId"]) if n.get("relatedId") else None,
    }


# ─── GET /notifications ───────────────────────────────────────────────────────
@router.get("/")
async def get_notifications(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get notifications. Admin sees all; members see their own."""
    query = {} if current_user["role"] == "admin" else {"userId": ObjectId(current_user["_id"])}
    
    notifications = await db.notifications.find(query).sort("createdAt", -1).to_list(200)
    
    result = []
    for n in notifications:
        serialized = serialize_notification(n)
        # For admin, attach the user's name
        if current_user["role"] == "admin":
            user = await db.users.find_one({"_id": n["userId"]})
            serialized["userName"] = user.get("name", "Unknown") if user else "Unknown"
        result.append(serialized)
    
    unread_count = sum(1 for n in result if not n["isRead"])
    
    return {"notifications": result, "unreadCount": unread_count}


# ─── GET /notifications/unread-count ─────────────────────────────────────────
@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Quick endpoint for the nav badge."""
    query = {"isRead": False}
    if current_user["role"] != "admin":
        query["userId"] = ObjectId(current_user["_id"])
    
    count = await db.notifications.count_documents(query)
    return {"unreadCount": count}


# ─── PUT /notifications/:id/read ─────────────────────────────────────────────
@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    try:
        obj_id = ObjectId(notification_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    query = {"_id": obj_id}
    if current_user["role"] != "admin":
        query["userId"] = ObjectId(current_user["_id"])
    
    result = await db.notifications.update_one(query, {"$set": {"isRead": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as read"}


# ─── PUT /notifications/:id/unread ───────────────────────────────────────────
@router.put("/{notification_id}/unread")
async def mark_as_unread(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    try:
        obj_id = ObjectId(notification_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    query = {"_id": obj_id}
    if current_user["role"] != "admin":
        query["userId"] = ObjectId(current_user["_id"])
    
    result = await db.notifications.update_one(query, {"$set": {"isRead": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as unread"}


# ─── DELETE /notifications/:id ───────────────────────────────────────────────
@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    try:
        obj_id = ObjectId(notification_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    query = {"_id": obj_id}
    if current_user["role"] != "admin":
        query["userId"] = ObjectId(current_user["_id"])
    
    result = await db.notifications.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Deleted"}


# ─── DELETE /notifications/clear-all ─────────────────────────────────────────
@router.delete("/clear-all/all")
async def clear_all_notifications(
    current_user: dict = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Clear all notifications for the current user (or all if admin)."""
    query = {} if current_user["role"] == "admin" else {"userId": ObjectId(current_user["_id"])}
    await db.notifications.delete_many(query)
    return {"message": "All notifications cleared"}
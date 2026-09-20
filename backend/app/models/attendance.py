from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class AttendanceRecordCreate(BaseModel):
    title: str
    meetingDate: datetime
    location: Optional[str] = None
    description: Optional[str] = None

class AttendanceMarkCreate(BaseModel):
    userId: str
    status: str  # "present", "online", or "absent"

class AttendanceRecordResponse(BaseModel):
    id: str = Field(..., alias="_id")
    title: str
    meetingDate: datetime
    location: Optional[str] = None
    description: Optional[str] = None
    totalMembers: int
    presentCount: int
    onlineCount: int
    absentCount: int
    totalPoints: int
    maxPoints: int
    attendanceRate: float
    createdBy: str
    createdAt: datetime
    
    class Config:
        populate_by_name = True

class AttendanceMarkResponse(BaseModel):
    id: str = Field(..., alias="_id")
    attendanceId: str
    userId: str
    userName: str
    status: str  # "present", "online", "absent"
    points: int  # 2, 1, or 0
    markedAt: datetime
    
    class Config:
        populate_by_name = True
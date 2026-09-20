from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Union
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    phoneNumber: str
    address: str
    homeState: str
    lga: str
    nextOfKinName: str
    nextOfKinNumber: str
    nextOfKinAddress: str

class UserCreate(UserBase):
    password: str
    role: str = "user"  # Default role

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    homeState: Optional[str] = None
    lga: Optional[str] = None
    nextOfKinName: Optional[str] = None
    nextOfKinNumber: Optional[str] = None
    nextOfKinAddress: Optional[str] = None
    photo: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    isApproved: Optional[bool] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

class UserResponse(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    email: EmailStr
    phoneNumber: Union[str, int, float]
    address: str
    homeState: str
    lga: str
    nextOfKinName: str
    nextOfKinNumber: Union[str, int, float]
    nextOfKinAddress: str
    photo: str = "default.jpg"
    role: str
    active: bool = True
    isApproved: bool = True  # Default to True for existing users
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    
    @field_validator('phoneNumber', 'nextOfKinNumber', mode='before')
    @classmethod
    def convert_phone_to_string(cls, v):
        """Convert phone numbers from int/float to string"""
        if isinstance(v, (int, float)):
            return str(int(v))
        return v
    
    class Config:
        populate_by_name = True
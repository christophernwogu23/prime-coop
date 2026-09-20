from fastapi import APIRouter, Depends, HTTPException, status
from datetime import timedelta
from ..models.user import UserCreate, UserLogin, Token, UserResponse
from ..utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_active_user
)
from ..config import settings
from ..database import get_database
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db = Depends(get_database)):
    """Register a new user"""

    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password
    hashed_password = get_password_hash(user.password)

    # Create user document
    user_dict = user.model_dump(exclude={"password"})
    user_dict["password"] = hashed_password
    user_dict["photo"] = "default.jpg"
    user_dict["active"] = True
    user_dict["isApproved"] = False     # Requires admin approval before login
    user_dict["role"] = "member"        # ✅ Always force role to member on registration
                                        #    prevents UserCreate model defaults (e.g. "guest")
                                        #    from leaking through via model_dump()
    user_dict["createdAt"] = datetime.utcnow()
    user_dict["updatedAt"] = datetime.utcnow()

    # Insert into database
    result = await db.users.insert_one(user_dict)

    # Get the created user
    created_user = await db.users.find_one({"_id": result.inserted_id})
    created_user["_id"] = str(created_user["_id"])

    return created_user


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db = Depends(get_database)):
    """Login user and return JWT token"""

    # Find user by email
    user = await db.users.find_one({"email": credentials.email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.get("active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive"
        )

    # For existing users without isApproved field, treat them as approved.
    # New registrations will have isApproved=False by default.
    is_approved = user.get("isApproved", True)

    if not is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is pending approval"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["_id"])},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user
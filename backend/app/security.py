import os
from datetime import datetime, timedelta

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from . import models

# Default to a demo secret so the app is runnable without extra env setup.
# In production, set a strong JWT secret and keep it out of version control.
SECRET_KEY = os.environ.get("JWT_SECRET", "ezfinanz-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h, fine for a demo/assignment build

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    user_id = payload.get("sub")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.Role.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_customer(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.Role.CUSTOMER:
        raise HTTPException(status_code=403, detail="Customer access required")
    return user


def require_verified_identity(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.email_verified or not user.phone_verified:
        raise HTTPException(
            status_code=403,
            detail="Complete both email and phone verification before continuing with the loan application.",
        )
    return user

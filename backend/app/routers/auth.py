import os

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


def _token_for(user: models.User) -> schemas.TokenResponse:
    token = security.create_access_token({"sub": user.id, "role": user.role.value})
    return schemas.TokenResponse(
        access_token=token,
        role=user.role.value,
        user_id=user.id,
        email_verified=user.email_verified,
        phone_verified=user.phone_verified,
    )


@router.post("/signup", response_model=schemas.TokenResponse)
def signup(payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    if not payload.email and not payload.phone:
        raise HTTPException(400, "Provide an email or phone number to sign up.")

    if payload.email and db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(409, "An account with this email already exists.")
    if payload.phone and db.query(models.User).filter(models.User.phone == payload.phone).first():
        raise HTTPException(409, "An account with this phone number already exists.")

    if payload.email and not payload.password:
        raise HTTPException(400, "Password is required for email sign-up.")

    provider = models.AuthProvider.EMAIL if payload.email else models.AuthProvider.PHONE

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=security.hash_password(payload.password) if payload.password else None,
        auth_provider=provider,
        role=models.Role.CUSTOMER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .filter((models.User.email == payload.identifier) | (models.User.phone == payload.identifier))
        .first()
    )
    if not user:
        raise HTTPException(401, "No account found with those credentials.")

    if user.auth_provider == models.AuthProvider.EMAIL:
        if not payload.password or not security.verify_password(payload.password, user.password_hash):
            raise HTTPException(401, "Incorrect email or password.")
    # Phone-based accounts log in purely via OTP (see /verification/request-otp + verify-otp),
    # so a plain password login isn't applicable there.
    elif user.auth_provider == models.AuthProvider.PHONE:
        raise HTTPException(400, "This account uses phone OTP login. Request an OTP instead.")

    return _token_for(user)


def _login_or_create_google_user(db: Session, email: str, full_name: str) -> models.User:
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            full_name=full_name,
            email=email,
            auth_provider=models.AuthProvider.GOOGLE,
            role=models.Role.CUSTOMER,
            email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.email_verified:
        user.email_verified = True
        db.commit()
    return user


@router.post("/oauth/google", response_model=schemas.TokenResponse)
def oauth_google(payload: schemas.OAuthLoginRequest, db: Session = Depends(get_db)):
    user = _login_or_create_google_user(db, payload.email, payload.full_name)
    return _token_for(user)


@router.post("/google", response_model=schemas.TokenResponse)
def google_sign_in(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google Sign-In is not configured on the server.")

    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        raise HTTPException(401, "Invalid Google credential.") from exc

    email = idinfo.get("email")
    if not email:
        raise HTTPException(400, "Google account did not provide an email address.")

    full_name = idinfo.get("name") or email.split("@")[0]
    user = _login_or_create_google_user(db, email, full_name)
    return _token_for(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(security.get_current_user)):
    return user

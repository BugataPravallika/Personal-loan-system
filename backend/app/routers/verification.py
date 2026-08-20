import hashlib
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db
from ..utils.otp import (
    generate_code,
    dispatch_otp,
    mask_destination,
    build_otp_message,
    DEV_MODE,
    hash_otp,
)

router = APIRouter(prefix="/api/verification", tags=["verification"])
OTP_TTL_MINUTES = 10
COOLDOWN_SECONDS = 60
MAX_REQUESTS_PER_HOUR = 5


@router.post("/request-otp")
def request_otp(
    payload: schemas.OTPRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.get_current_user),
):
    destination = (payload.destination or "").strip() if payload.destination else ""
    channel = payload.channel

    # Determine destination and persist if provided
    if channel == "email":
        destination = destination or (user.email or "")
        if not destination:
            raise HTTPException(400, "No email is registered for this account. Please enter an email first.")
        existing = db.query(models.User).filter(models.User.email == destination, models.User.id != user.id).first()
        if existing:
            raise HTTPException(409, "This email is already associated with another account.")
        user.email = destination
        db.commit()
    else:
        destination = destination or (user.phone or "")
        if not destination:
            raise HTTPException(400, "No phone number is registered for this account. Please enter a phone number first.")
        existing = db.query(models.User).filter(models.User.phone == destination, models.User.id != user.id).first()
        if existing:
            raise HTTPException(409, "This phone number is already associated with another account.")
        user.phone = destination
        db.commit()

    # Throttle: cooldown between requests for same user+channel
    last = (
        db.query(models.OTPCode)
        .filter(models.OTPCode.user_id == user.id, models.OTPCode.channel == channel)
        .order_by(models.OTPCode.created_at.desc())
        .first()
    )
    now = datetime.utcnow()
    if last:
        delta = (now - last.created_at).total_seconds()
        if delta < COOLDOWN_SECONDS:
            retry = int(COOLDOWN_SECONDS - delta)
            raise HTTPException(status_code=429, detail=f"Please wait {retry} seconds before requesting another OTP.", headers={"Retry-After": str(retry)})

    # Hourly limit: count requests in the past hour
    window_start = now - timedelta(hours=1)
    recent_count = (
        db.query(models.OTPCode)
        .filter(models.OTPCode.user_id == user.id, models.OTPCode.channel == channel, models.OTPCode.created_at >= window_start)
        .count()
    )
    if recent_count >= MAX_REQUESTS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Please try again later.")

    code = generate_code()
    message_body = build_otp_message(channel, code)
    otp = models.OTPCode(
        user_id=user.id,
        channel=channel,
        code=(code if DEV_MODE else None),
        code_hash=hash_otp(code),
        failed_attempts=0,
        purpose="verification",
        destination=destination,
        message_body=message_body,
        expires_at=now + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    sent_externally = dispatch_otp(channel, destination, code)

    response = {
        "message": f"Verification code sent to your {channel}.",
        "expires_in_minutes": OTP_TTL_MINUTES,
        "masked_destination": mask_destination(channel, destination),
        "delivery_method": "external" if sent_externally else ("development" if DEV_MODE else "inbox"),
        "otp_id": otp.id,
    }
    if DEV_MODE:
        response["dev_otp"] = code
    return response


@router.get("/inbox")
def otp_inbox(
    db: Session = Depends(get_db),
    user: models.User = Depends(security.get_current_user),
):
    """Authenticated inbox for OTP messages (simulates email/SMS app)."""
    rows = (
        db.query(models.OTPCode)
        .filter(
            models.OTPCode.user_id == user.id,
            models.OTPCode.consumed == False,  # noqa: E712
            models.OTPCode.expires_at >= datetime.utcnow(),
        )
        .order_by(models.OTPCode.created_at.desc())
        .limit(5)
        .all()
    )
    return [
        {
            "id": row.id,
            "channel": row.channel,
            "masked_destination": mask_destination(row.channel, row.destination or ""),
            "subject": "Your EzFinanz verification code",
            "body": (row.message_body if DEV_MODE else None),
            "sent_at": row.created_at,
            "expires_at": row.expires_at,
        }
        for row in rows
    ]


@router.post("/verify-otp")
def verify_otp(
    payload: schemas.OTPVerifyRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.get_current_user),
):
    otp = (
        db.query(models.OTPCode)
        .filter(
            models.OTPCode.user_id == user.id,
            models.OTPCode.channel == payload.channel,
            models.OTPCode.consumed == False,  # noqa: E712
        )
        .order_by(models.OTPCode.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(400, "No pending OTP found. Please request a new one.")

    now = datetime.utcnow()
    if otp.expires_at < now:
        otp.consumed = True
        db.commit()
        raise HTTPException(400, "OTP has expired. Please request a new one.")

    submitted_code = (payload.code or "").strip()
    submitted_hash = hashlib.sha256(submitted_code.encode("utf-8")).hexdigest()
    expected_hash = otp.code_hash or hash_otp(otp.code or "")
    if expected_hash != submitted_hash:
        # increment failed attempts
        otp.failed_attempts = (otp.failed_attempts or 0) + 1
        remaining = max(0, 5 - otp.failed_attempts)
        if otp.failed_attempts >= 5:
            otp.consumed = True
            db.commit()
            raise HTTPException(400, "Too many incorrect attempts. Please request a new OTP.")
        db.commit()
        raise HTTPException(400, f"Incorrect OTP. {remaining} attempts remaining.")

    # Success
    otp.consumed = True
    if payload.channel == "email":
        if payload.destination:
            user.email = payload.destination.strip()
        user.email_verified = True
    else:
        if payload.destination:
            user.phone = payload.destination.strip()
        user.phone_verified = True

    # Reset failed attempts is implicit because this otp is consumed; future OTPs start with 0
    db.commit()

    return {
        "message": f"{payload.channel.capitalize()} verified successfully.",
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "email": user.email,
        "phone": user.phone,
    }

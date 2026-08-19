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
)

router = APIRouter(prefix="/api/verification", tags=["verification"])
OTP_TTL_MINUTES = 10


@router.post("/request-otp")
def request_otp(
    payload: schemas.OTPRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.get_current_user),
):
    destination = user.email if payload.channel == "email" else user.phone
    if not destination:
        raise HTTPException(400, f"No {payload.channel} on file for this account.")

    code = generate_code()
    message_body = build_otp_message(payload.channel, code)
    otp = models.OTPCode(
        user_id=user.id,
        channel=payload.channel,
        code=code,
        purpose="verification",
        destination=destination,
        message_body=message_body,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    sent_externally = dispatch_otp(payload.channel, destination, code)

    response = {
        "message": f"Verification code sent to your {payload.channel}.",
        "expires_in_minutes": OTP_TTL_MINUTES,
        "masked_destination": mask_destination(payload.channel, destination),
        "delivery_method": "external" if sent_externally else "inbox",
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
            "body": row.message_body,
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
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(400, "OTP has expired. Please request a new one.")
    if otp.code != payload.code:
        raise HTTPException(400, "Incorrect OTP.")

    otp.consumed = True
    if payload.channel == "email":
        user.email_verified = True
    else:
        user.phone_verified = True
    db.commit()

    return {
        "message": f"{payload.channel.capitalize()} verified successfully.",
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
    }

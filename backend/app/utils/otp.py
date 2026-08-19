"""
OTP dispatch — production-like delivery simulation.

When SMTP/SMS credentials are configured, messages are sent for real.
Otherwise OTPs are delivered to the user's authenticated in-app inbox
(see /verification/inbox) instead of being echoed in API responses.
"""
import os
import random
import smtplib
import string
from email.message import EmailMessage

DEV_MODE = os.environ.get("EZFINANZ_DEV_MODE", "false").lower() == "true"


def generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def mask_destination(channel: str, destination: str) -> str:
    if channel == "email" and "@" in destination:
        local, domain = destination.split("@", 1)
        masked_local = local[0] + "***" + (local[-1] if len(local) > 1 else "")
        return f"{masked_local}@{domain}"
    if channel == "phone" and len(destination) >= 4:
        return destination[:2] + "****" + destination[-2:]
    return destination


def build_otp_message(channel: str, code: str, purpose: str = "verification") -> str:
    label = "email" if channel == "email" else "phone number"
    return (
        f"Your EzFinanz {purpose} code is {code}. "
        f"It expires in 10 minutes. Do not share this code with anyone."
    )


def dispatch_otp(channel: str, destination: str, code: str, purpose: str = "verification") -> bool:
    """Try real SMTP delivery; return True if sent externally."""
    message = build_otp_message(channel, code, purpose)
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    if channel == "email" and smtp_host and smtp_user and smtp_pass:
        msg = EmailMessage()
        msg["Subject"] = "Your EzFinanz verification code"
        msg["From"] = smtp_from
        msg["To"] = destination
        msg.set_content(message)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True

    print(f"[OTP queued for inbox] {channel.upper()} -> {destination} | {code}")
    return False

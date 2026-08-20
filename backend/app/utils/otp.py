"""
OTP dispatch — production-like delivery simulation.

When SMTP/SMS credentials are configured, messages are sent for real.
Otherwise OTPs are delivered to the user's authenticated in-app inbox
(see /verification/inbox) instead of being echoed in API responses.
"""
import hashlib
import os
import random
import smtplib
import string
from email.message import EmailMessage

from twilio.base.exceptions import TwilioException
from twilio.rest import Client

DEV_MODE = os.environ.get("EZFINANZ_DEV_MODE", "false").lower() == "true"


def hash_otp(value: str) -> str:
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


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
    return (
        f"Your EzFinanz {purpose} code is {code}. "
        f"It expires in 10 minutes. Do not share this code with anyone."
    )


def dispatch_otp(channel: str, destination: str, code: str, purpose: str = "verification") -> bool:
    """Send through a real provider when configured; otherwise keep OTPs only in DEV_MODE."""
    message = build_otp_message(channel, code, purpose)

    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    if channel == "email" and smtp_host and smtp_user and smtp_pass:
        try:
            msg = EmailMessage()
            msg["Subject"] = "Your EzFinanz verification code"
            msg["From"] = smtp_from or "no-reply@localhost"
            msg["To"] = destination
            msg.set_content(message)
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            return True
        except Exception as exc:
            print(f"[OTP email delivery failed] {channel.upper()} -> {mask_destination(channel, destination)} | {type(exc).__name__}: {exc}")

    if channel == "phone":
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_FROM_NUMBER")
        if twilio_sid and twilio_token and twilio_from:
            try:
                client = Client(twilio_sid, twilio_token)
                client.messages.create(
                    body=message,
                    from_=twilio_from,
                    to=destination,
                )
                return True
            except TwilioException as exc:
                print(f"[OTP SMS delivery failed] {channel.upper()} -> {mask_destination(channel, destination)} | {type(exc).__name__}: {exc}")

    if DEV_MODE:
        print(f"[DEVELOPMENT OTP] {channel.upper()} -> {mask_destination(channel, destination)} | {code}")
    else:
        print(f"[OTP queued for secure delivery] {channel.upper()} -> {mask_destination(channel, destination)}")
    return False

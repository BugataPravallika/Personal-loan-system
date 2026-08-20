import os
import time
from fastapi.testclient import TestClient
from app.main import app

os.environ.setdefault("EZFINANZ_DEV_MODE", "true")

client = TestClient(app)


def signup_email_user(email: str = "tester@example.com", password: str = "password123"):
    res = client.post("/api/auth/signup", json={
        "full_name": "Test User",
        "email": email,
        "password": password,
    })
    assert res.status_code == 200
    return res.json()


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_email_and_phone_verification_and_kyc_flow():
    # Sign up with email
    tok = signup_email_user("verifytest@example.com")
    access_token = tok["access_token"]

    # Initially both flags should be false
    res = client.get("/api/application/me", headers=auth_header(access_token))
    assert res.status_code == 200
    body = res.json()
    assert body["email_verified"] is False
    assert body["phone_verified"] is False

    # Trying to submit KYC should be blocked (require_verified_identity)
    kyc_payload = {
        "full_name": "Test User",
        "dob": "1990-01-01",
        "gender": "Other",
        "address": "123 Test St",
        "id_type": "passport",
        "id_number": "P1234567",
    }
    res = client.post("/api/application/kyc", headers=auth_header(access_token), json=kyc_payload)
    assert res.status_code == 403

    # Request email OTP
    res = client.post("/api/verification/request-otp", headers=auth_header(access_token), json={"channel": "email"})
    assert res.status_code == 200
    res = client.get("/api/verification/inbox", headers=auth_header(access_token))
    assert res.status_code == 200
    messages = res.json()
    assert len(messages) == 1
    email_code = messages[0]["body"].split(" code is ", 1)[1].split(".", 1)[0]

    # Verify with correct email OTP
    res = client.post("/api/verification/verify-otp", headers=auth_header(access_token), json={
        "channel": "email", "code": email_code
    })
    assert res.status_code == 200
    v = res.json()
    assert v["email_verified"] is True
    assert v["phone_verified"] is False

    # Still cannot submit KYC
    res = client.post("/api/application/kyc", headers=auth_header(access_token), json=kyc_payload)
    assert res.status_code == 403

    # Request phone OTP (provide a phone number during request)
    res = client.post("/api/verification/request-otp", headers=auth_header(access_token), json={"channel": "phone", "destination": "+919960000104"})
    assert res.status_code == 200
    res = client.get("/api/verification/inbox", headers=auth_header(access_token))
    assert res.status_code == 200
    messages = res.json()
    phone_messages = [message for message in messages if message["channel"] == "phone"]
    assert len(phone_messages) == 1
    phone_code = phone_messages[0]["body"].split(" code is ", 1)[1].split(".", 1)[0]

    # Verify phone
    res = client.post("/api/verification/verify-otp", headers=auth_header(access_token), json={
        "channel": "phone", "code": phone_code, "destination": "+919960000104"
    })
    assert res.status_code == 200
    v = res.json()
    assert v["phone_verified"] is True
    assert v["email_verified"] is True

    # Now KYC submission should succeed
    res = client.post("/api/application/kyc", headers=auth_header(access_token), json=kyc_payload)
    assert res.status_code == 200
    k = res.json()
    assert k["full_name"] == "Test User"


def test_otp_incorrect_attempts_consumes_after_limit():
    tok = signup_email_user("attemptstest@example.com")
    access_token = tok["access_token"]

    # Request phone OTP
    res = client.post("/api/verification/request-otp", headers=auth_header(access_token), json={"channel": "phone", "destination": "+919960000105"})
    assert res.status_code == 200
    res = client.get("/api/verification/inbox", headers=auth_header(access_token))
    assert res.status_code == 200
    messages = res.json()
    phone_messages = [message for message in messages if message["channel"] == "phone"]
    assert len(phone_messages) == 1
    correct_code = phone_messages[0]["body"].split(" code is ", 1)[1].split(".", 1)[0]

    # Submit wrong OTP 5 times
    for i in range(5):
        res = client.post("/api/verification/verify-otp", headers=auth_header(access_token), json={"channel": "phone", "code": "000000"})
        if i < 4:
            assert res.status_code == 400
            # message should indicate remaining attempts
        else:
            # 5th attempt consumes the OTP
            assert res.status_code == 400
            assert b"Too many incorrect attempts" in res.content

    # Attempt to verify with correct code should now fail because OTP consumed
    res = client.post("/api/verification/verify-otp", headers=auth_header(access_token), json={"channel": "phone", "code": correct_code})
    assert res.status_code == 400
    assert b"No pending OTP" in res.content

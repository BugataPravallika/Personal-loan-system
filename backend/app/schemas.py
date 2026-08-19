from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class SignupRequest(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None


class LoginRequest(BaseModel):
    identifier: str  # email or phone
    password: Optional[str] = None


class OAuthLoginRequest(BaseModel):
    full_name: str
    email: EmailStr
    provider: str = "google"


class GoogleAuthRequest(BaseModel):
    credential: str


class OTPRequest(BaseModel):
    channel: str  # "email" | "phone"


class OTPVerifyRequest(BaseModel):
    channel: str
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    email_verified: bool
    phone_verified: bool


class UserOut(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    role: str
    email_verified: bool
    phone_verified: bool

    class Config:
        from_attributes = True


# ---------- KYC ----------
class KYCRequest(BaseModel):
    full_name: str
    dob: str
    gender: str
    address: str
    id_type: str
    id_number: str


class KYCOut(KYCRequest):
    id_document_path: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Eligibility ----------
class EligibilityRequest(BaseModel):
    annual_income: float = Field(gt=0)
    requested_amount: float = Field(gt=0)
    credit_score: int = Field(ge=300, le=900)
    existing_monthly_debts: float = Field(ge=0)
    employer_name: str
    designation: str


class EligibilityOut(BaseModel):
    result: str
    reason: str
    dti_ratio: float
    max_eligible_amount: float
    rate_label: str
    reference_rate: float

    class Config:
        from_attributes = True


# ---------- EMI ----------
class EMIQuoteRequest(BaseModel):
    loan_amount: float = Field(gt=0)
    tenure_months: int = Field(gt=0)


class EMIQuoteOut(BaseModel):
    loan_amount: float
    tenure_months: int
    interest_rate_annual: float
    processing_fee: float
    gst_on_fee: float
    other_charges: float
    net_disbursement: float
    emi_amount: float
    total_interest: float
    total_repayment: float
    total_charges: float
    irr_annual_pct: float


# ---------- Bank ----------
class BankAccountRequest(BaseModel):
    account_holder_name: str
    account_number: str
    ifsc_code: str
    bank_name: str


class BankAccountOut(BankAccountRequest):
    class Config:
        from_attributes = True


# ---------- Declaration ----------
class DeclarationRequest(BaseModel):
    accepted: bool


# ---------- Selfie / Admin ----------
class SelfieReviewRequest(BaseModel):
    approve: bool
    reason: Optional[str] = None


class ApplicationSummaryOut(BaseModel):
    id: str
    applicant_name: Optional[str]
    loan_amount: Optional[float]
    tenure_months: Optional[int]
    stage: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

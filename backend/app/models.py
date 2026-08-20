import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"


class AuthProvider(str, enum.Enum):
    EMAIL = "email"
    PHONE = "phone"
    GOOGLE = "google"


class ApplicationStage(str, enum.Enum):
    ACCOUNT_VERIFICATION = "Account Verification"
    KYC = "KYC"
    ELIGIBILITY = "Eligibility"
    EMI_SELECTION = "EMI Selection"
    BANK_DETAILS = "Bank Details"
    DECLARATION = "Declaration"
    SELFIE_PENDING = "Selfie Pending"
    ADMIN_REVIEW = "Waiting for Admin Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    DISBURSED = "Disbursed"


class EligibilityResult(str, enum.Enum):
    ELIGIBLE = "Eligible"
    PARTIALLY_ELIGIBLE = "Partially Eligible"
    NOT_ELIGIBLE = "Not Eligible"


class SelfieStatus(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=True)
    auth_provider = Column(Enum(AuthProvider), default=AuthProvider.EMAIL)
    role = Column(Enum(Role), default=Role.CUSTOMER)

    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    applications = relationship("LoanApplication", back_populates="user")


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    channel = Column(String)  # "email" | "phone"
    code = Column(String, nullable=True)
    code_hash = Column(String, nullable=True)
    failed_attempts = Column(Integer, default=0)
    purpose = Column(String, default="verification")
    destination = Column(String, nullable=True)
    message_body = Column(Text, nullable=True)
    expires_at = Column(DateTime)
    consumed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewStatus(str, enum.Enum):
    UNDER_REVIEW = "Under Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    MORE_INFO_REQUIRED = "More Information Required"


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    stage = Column(Enum(ApplicationStage), default=ApplicationStage.ACCOUNT_VERIFICATION)
    status = Column(String, default="In Progress")  # In Progress / Approved / Rejected / Disbursed

    # Admin review fields
    review_status = Column(Enum(ReviewStatus), nullable=True)
    review_remarks = Column(Text, nullable=True)
    review_date = Column(DateTime, nullable=True)
    reviewed_by = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="applications")
    kyc = relationship("KYCDetail", back_populates="application", uselist=False)
    eligibility = relationship("EligibilityCheck", back_populates="application", uselist=False)
    emi = relationship("EMISelection", back_populates="application", uselist=False)
    bank_account = relationship("BankAccount", back_populates="application", uselist=False)
    declaration = relationship("Declaration", back_populates="application", uselist=False)
    selfie = relationship("Selfie", back_populates="application", uselist=False)


class KYCDetail(Base):
    __tablename__ = "kyc_details"

    id = Column(String, primary_key=True, default=gen_uuid)
    application_id = Column(String, ForeignKey("loan_applications.id"))

    full_name = Column(String)
    dob = Column(String)
    gender = Column(String)
    address = Column(Text)
    id_type = Column(String)
    id_number = Column(String)
    id_document_path = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("LoanApplication", back_populates="kyc")


class EligibilityCheck(Base):
    __tablename__ = "eligibility_checks"

    id = Column(String, primary_key=True, default=gen_uuid)
    application_id = Column(String, ForeignKey("loan_applications.id"))

    annual_income = Column(Float)
    requested_amount = Column(Float)
    credit_score = Column(Integer)
    existing_debts = Column(Float)
    employer_name = Column(String)
    designation = Column(String)

    dti_ratio = Column(Float)
    result = Column(Enum(EligibilityResult))
    reason = Column(Text)
    max_eligible_amount = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("LoanApplication", back_populates="eligibility")


class EMISelection(Base):
    __tablename__ = "emi_selections"

    id = Column(String, primary_key=True, default=gen_uuid)
    application_id = Column(String, ForeignKey("loan_applications.id"))

    loan_amount = Column(Float)
    tenure_months = Column(Integer)
    interest_rate_annual = Column(Float)
    processing_fee = Column(Float)
    gst_on_fee = Column(Float)
    other_charges = Column(Float)

    net_disbursement = Column(Float)
    emi_amount = Column(Float)
    total_interest = Column(Float)
    total_repayment = Column(Float)
    total_charges = Column(Float)
    irr_annual_pct = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("LoanApplication", back_populates="emi")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(String, primary_key=True, default=gen_uuid)
    application_id = Column(String, ForeignKey("loan_applications.id"))

    account_holder_name = Column(String)
    account_number = Column(String)
    ifsc_code = Column(String)
    bank_name = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("LoanApplication", back_populates="bank_account")


class Declaration(Base):
    __tablename__ = "declarations"

    id = Column(String, primary_key=True, default=gen_uuid)
    application_id = Column(String, ForeignKey("loan_applications.id"))

    accepted = Column(Boolean, default=False)
    accepted_at = Column(DateTime, nullable=True)

    application = relationship("LoanApplication", back_populates="declaration")


class Selfie(Base):
    __tablename__ = "selfies"

    id = Column(String, primary_key=True, default=gen_uuid)
    application_id = Column(String, ForeignKey("loan_applications.id"))

    file_path = Column(String)
    status = Column(Enum(SelfieStatus), default=SelfieStatus.PENDING)
    reject_reason = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("LoanApplication", back_populates="selfie")

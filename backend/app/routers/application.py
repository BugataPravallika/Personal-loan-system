import os
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db
from ..utils.calculations import assess_eligibility, compute_loan_terms

router = APIRouter(prefix="/api/application", tags=["application"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")


def get_or_create_application(user: models.User, db: Session) -> models.LoanApplication:
    app_ = (
        db.query(models.LoanApplication)
        .filter(
            models.LoanApplication.user_id == user.id,
            models.LoanApplication.status == "In Progress",
        )
        .order_by(models.LoanApplication.created_at.desc())
        .first()
    )
    if not app_:
        app_ = models.LoanApplication(user_id=user.id, stage=models.ApplicationStage.ACCOUNT_VERIFICATION)
        db.add(app_)
        db.commit()
        db.refresh(app_)
    return app_


def _advance_stage(app_: models.LoanApplication, stage: models.ApplicationStage, db: Session):
    app_.stage = stage
    app_.updated_at = datetime.utcnow()
    db.commit()


def _serialize_kyc(kyc: models.KYCDetail | None):
    if not kyc:
        return None
    return {
        "full_name": kyc.full_name,
        "dob": kyc.dob,
        "gender": kyc.gender,
        "address": kyc.address,
        "id_type": kyc.id_type,
        "id_number": kyc.id_number,
        "id_document_path": kyc.id_document_path,
    }


def _serialize_eligibility(record: models.EligibilityCheck | None):
    if not record:
        return None
    from ..utils.calculations import get_rate_for_score

    rate_label, reference_rate = get_rate_for_score(record.credit_score)
    return {
        "annual_income": record.annual_income,
        "requested_amount": record.requested_amount,
        "credit_score": record.credit_score,
        "existing_monthly_debts": record.existing_debts,
        "employer_name": record.employer_name,
        "designation": record.designation,
        "result": record.result.value,
        "reason": record.reason,
        "dti_ratio": record.dti_ratio,
        "max_eligible_amount": record.max_eligible_amount,
        "rate_label": rate_label,
        "reference_rate": reference_rate,
    }


def _serialize_emi(emi: models.EMISelection | None):
    if not emi:
        return None
    return {
        "loan_amount": emi.loan_amount,
        "tenure_months": emi.tenure_months,
        "interest_rate_annual": emi.interest_rate_annual,
        "processing_fee": emi.processing_fee,
        "gst_on_fee": emi.gst_on_fee,
        "other_charges": emi.other_charges,
        "net_disbursement": emi.net_disbursement,
        "emi_amount": emi.emi_amount,
        "total_interest": emi.total_interest,
        "total_repayment": emi.total_repayment,
        "total_charges": emi.total_charges,
        "irr_annual_pct": emi.irr_annual_pct,
    }


def _serialize_bank(account: models.BankAccount | None):
    if not account:
        return None
    return {
        "account_holder_name": account.account_holder_name,
        "account_number": account.account_number,
        "ifsc_code": account.ifsc_code,
        "bank_name": account.bank_name,
    }


@router.get("/me")
def my_application(
    db: Session = Depends(get_db), user: models.User = Depends(security.require_customer)
):
    app_ = get_or_create_application(user, db)
    return {
        "id": app_.id,
        "stage": app_.stage.value,
        "status": app_.status,
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "has_kyc": app_.kyc is not None,
        "has_eligibility": app_.eligibility is not None,
        "eligibility_result": app_.eligibility.result.value if app_.eligibility else None,
        "has_emi": app_.emi is not None,
        "has_bank": app_.bank_account is not None,
        "has_declaration": app_.declaration is not None and app_.declaration.accepted,
        "selfie_status": app_.selfie.status.value if app_.selfie else None,
        "kyc": _serialize_kyc(app_.kyc),
        "eligibility": _serialize_eligibility(app_.eligibility),
        "emi": _serialize_emi(app_.emi),
        "bank_account": _serialize_bank(app_.bank_account),
        "declaration_accepted": bool(app_.declaration and app_.declaration.accepted),
    }


# ---------------- KYC ----------------
@router.post("/kyc", response_model=schemas.KYCOut)
def submit_kyc(
    payload: schemas.KYCRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    if not (user.email_verified or user.phone_verified):
        raise HTTPException(400, "Please verify your email or phone before continuing to KYC.")

    app_ = get_or_create_application(user, db)
    kyc = app_.kyc or models.KYCDetail(application_id=app_.id)
    for field, value in payload.dict().items():
        setattr(kyc, field, value)
    db.add(kyc)
    _advance_stage(app_, models.ApplicationStage.ELIGIBILITY, db)
    db.commit()
    db.refresh(kyc)
    return kyc


@router.post("/kyc/id-document")
def upload_id_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    app_ = get_or_create_application(user, db)
    if not app_.kyc:
        raise HTTPException(400, "Submit KYC details before uploading a document.")

    folder = os.path.join(UPLOAD_DIR, "kyc_docs")
    os.makedirs(folder, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    path = os.path.join(folder, f"{app_.id}{ext}")
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    app_.kyc.id_document_path = path
    db.commit()
    return {"message": "ID document uploaded."}


# ---------------- Eligibility ----------------
@router.post("/eligibility", response_model=schemas.EligibilityOut)
def check_eligibility(
    payload: schemas.EligibilityRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    app_ = get_or_create_application(user, db)
    if not app_.kyc:
        raise HTTPException(400, "Complete KYC before checking eligibility.")

    outcome = assess_eligibility(
        annual_income=payload.annual_income,
        requested_amount=payload.requested_amount,
        credit_score=payload.credit_score,
        existing_monthly_debts=payload.existing_monthly_debts,
    )

    record = app_.eligibility or models.EligibilityCheck(application_id=app_.id)
    record.annual_income = payload.annual_income
    record.requested_amount = payload.requested_amount
    record.credit_score = payload.credit_score
    record.existing_debts = payload.existing_monthly_debts
    record.employer_name = payload.employer_name
    record.designation = payload.designation
    record.dti_ratio = outcome.dti_ratio
    record.result = models.EligibilityResult(outcome.result)
    record.reason = outcome.reason
    record.max_eligible_amount = outcome.max_eligible_amount
    db.add(record)

    if outcome.result != "Not Eligible":
        _advance_stage(app_, models.ApplicationStage.EMI_SELECTION, db)
    db.commit()

    return schemas.EligibilityOut(
        result=outcome.result,
        reason=outcome.reason,
        dti_ratio=outcome.dti_ratio,
        max_eligible_amount=outcome.max_eligible_amount,
        rate_label=outcome.rate_label,
        reference_rate=outcome.reference_rate,
    )


# ---------------- EMI ----------------
@router.post("/emi/quote", response_model=schemas.EMIQuoteOut)
def emi_quote(
    payload: schemas.EMIQuoteRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    """Live-recalculating quote — does NOT persist. Lets the customer try
    different amount/tenure combinations before confirming (see /emi/confirm)."""
    app_ = get_or_create_application(user, db)
    if not app_.eligibility or app_.eligibility.result == models.EligibilityResult.NOT_ELIGIBLE:
        raise HTTPException(400, "An eligible application is required before selecting EMI terms.")

    rate = _rate_from_eligibility(app_)
    terms = compute_loan_terms(
        loan_amount=payload.loan_amount,
        tenure_months=payload.tenure_months,
        annual_rate_pct=rate,
    )
    return terms.__dict__


def _rate_from_eligibility(app_: models.LoanApplication) -> float:
    from ..utils.calculations import get_rate_for_score
    _, rate = get_rate_for_score(app_.eligibility.credit_score)
    return rate


@router.post("/emi/confirm", response_model=schemas.EMIQuoteOut)
def emi_confirm(
    payload: schemas.EMIQuoteRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    app_ = get_or_create_application(user, db)
    if not app_.eligibility or app_.eligibility.result == models.EligibilityResult.NOT_ELIGIBLE:
        raise HTTPException(400, "An eligible application is required before selecting EMI terms.")

    if payload.loan_amount > app_.eligibility.max_eligible_amount and app_.eligibility.result == models.EligibilityResult.PARTIALLY_ELIGIBLE:
        raise HTTPException(400, f"Selected amount exceeds the approved eligible amount of {app_.eligibility.max_eligible_amount:,.0f}.")

    rate = _rate_from_eligibility(app_)
    terms = compute_loan_terms(loan_amount=payload.loan_amount, tenure_months=payload.tenure_months, annual_rate_pct=rate)

    emi = app_.emi or models.EMISelection(application_id=app_.id)
    emi.loan_amount = terms.loan_amount
    emi.tenure_months = terms.tenure_months
    emi.interest_rate_annual = terms.interest_rate_annual
    emi.processing_fee = terms.processing_fee
    emi.gst_on_fee = terms.gst_on_fee
    emi.other_charges = terms.other_charges
    emi.net_disbursement = terms.net_disbursement
    emi.emi_amount = terms.emi_amount
    emi.total_interest = terms.total_interest
    emi.total_repayment = terms.total_repayment
    emi.total_charges = terms.total_charges
    emi.irr_annual_pct = terms.irr_annual_pct
    db.add(emi)

    _advance_stage(app_, models.ApplicationStage.BANK_DETAILS, db)
    db.commit()
    return terms.__dict__


# ---------------- Bank account ----------------
@router.post("/bank-account", response_model=schemas.BankAccountOut)
def add_bank_account(
    payload: schemas.BankAccountRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    app_ = get_or_create_application(user, db)
    if not app_.emi:
        raise HTTPException(400, "Select your EMI tenure before adding a bank account.")

    account = app_.bank_account or models.BankAccount(application_id=app_.id)
    for field, value in payload.dict().items():
        setattr(account, field, value)
    db.add(account)
    _advance_stage(app_, models.ApplicationStage.DECLARATION, db)
    db.commit()
    db.refresh(account)
    return account


# ---------------- Declaration ----------------
@router.post("/declaration")
def submit_declaration(
    payload: schemas.DeclarationRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    app_ = get_or_create_application(user, db)
    if not app_.bank_account:
        raise HTTPException(400, "Add your bank account before confirming the declaration.")
    if not payload.accepted:
        raise HTTPException(400, "You must accept the declaration to proceed.")

    decl = app_.declaration or models.Declaration(application_id=app_.id)
    decl.accepted = True
    decl.accepted_at = datetime.utcnow()
    db.add(decl)
    _advance_stage(app_, models.ApplicationStage.SELFIE_PENDING, db)
    db.commit()
    return {"message": "Declaration accepted."}


# ---------------- Selfie ----------------
@router.post("/selfie")
def submit_selfie(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(security.require_customer),
):
    app_ = get_or_create_application(user, db)
    if not app_.declaration or not app_.declaration.accepted:
        raise HTTPException(400, "Accept the declaration before submitting your selfie.")

    folder = os.path.join(UPLOAD_DIR, "selfies")
    os.makedirs(folder, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    path = os.path.join(folder, f"{app_.id}{ext}")
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    selfie = app_.selfie or models.Selfie(application_id=app_.id)
    selfie.file_path = path
    selfie.status = models.SelfieStatus.PENDING
    selfie.submitted_at = datetime.utcnow()
    db.add(selfie)

    _advance_stage(app_, models.ApplicationStage.ADMIN_REVIEW, db)
    db.commit()
    return {"message": "Selfie submitted. Your application is now waiting for admin review."}

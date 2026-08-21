import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/applications")
def list_applications(
    db: Session = Depends(get_db), admin: models.User = Depends(security.require_admin)
):
    apps = db.query(models.LoanApplication).order_by(models.LoanApplication.created_at.desc()).all()
    out = []
    for a in apps:
        out.append({
            "id": a.id,
            "applicant_name": a.user.full_name if a.user else "—",
            "email": a.user.email if a.user else None,
            "phone": a.user.phone if a.user else None,
            "loan_amount": a.emi.loan_amount if a.emi else (a.eligibility.requested_amount if a.eligibility else None),
            "tenure_months": a.emi.tenure_months if a.emi else None,
            "stage": a.stage.value,
            "status": a.status,
            "review_status": (a.review_status.value if a.review_status else None),
            "selfie_status": a.selfie.status.value if a.selfie else None,
            "created_at": a.created_at,
        })
    return out


@router.get("/applications/{application_id}")
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(security.require_admin),
):
    a = db.query(models.LoanApplication).filter(models.LoanApplication.id == application_id).first()
    if not a:
        raise HTTPException(404, "Application not found.")

    return {
        "id": a.id,
        "stage": a.stage.value,
        "status": a.status,
        "review_status": (a.review_status.value if a.review_status else None),
        "review_remarks": a.review_remarks,
        "review_date": a.review_date,
        "reviewed_by": a.reviewed_by,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "user": {
            "full_name": a.user.full_name,
            "email": a.user.email,
            "phone": a.user.phone,
            "email_verified": a.user.email_verified,
            "phone_verified": a.user.phone_verified,
            "auth_provider": a.user.auth_provider.value,
        },
        "kyc": {
            "full_name": a.kyc.full_name,
            "dob": a.kyc.dob,
            "gender": a.kyc.gender,
            "address": a.kyc.address,
            "id_type": a.kyc.id_type,
            "id_number": a.kyc.id_number,
            "id_document_uploaded": bool(a.kyc.id_document_path),
        } if a.kyc else None,
        "eligibility": {
            "annual_income": a.eligibility.annual_income,
            "requested_amount": a.eligibility.requested_amount,
            "credit_score": a.eligibility.credit_score,
            "existing_debts": a.eligibility.existing_debts,
            "employer_name": a.eligibility.employer_name,
            "designation": a.eligibility.designation,
            "dti_ratio": a.eligibility.dti_ratio,
            "result": a.eligibility.result.value,
            "reason": a.eligibility.reason,
            "max_eligible_amount": a.eligibility.max_eligible_amount,
        } if a.eligibility else None,
        "emi": {
            "loan_amount": a.emi.loan_amount,
            "tenure_months": a.emi.tenure_months,
            "interest_rate_annual": a.emi.interest_rate_annual,
            "processing_fee": a.emi.processing_fee,
            "gst_on_fee": a.emi.gst_on_fee,
            "other_charges": a.emi.other_charges,
            "net_disbursement": a.emi.net_disbursement,
            "emi_amount": a.emi.emi_amount,
            "total_interest": a.emi.total_interest,
            "total_repayment": a.emi.total_repayment,
            "total_charges": a.emi.total_charges,
            "irr_annual_pct": a.emi.irr_annual_pct,
        } if a.emi else None,
        "bank_account": {
            "account_holder_name": a.bank_account.account_holder_name,
            "account_number": a.bank_account.account_number,
            "ifsc_code": a.bank_account.ifsc_code,
            "bank_name": a.bank_account.bank_name,
        } if a.bank_account else None,
        "declaration": {
            "accepted": a.declaration.accepted,
            "accepted_at": a.declaration.accepted_at,
        } if a.declaration else None,
        "selfie": {
            "status": a.selfie.status.value,
            "submitted_at": a.selfie.submitted_at,
            "reject_reason": a.selfie.reject_reason,
            "file_available": bool(a.selfie.file_path),
        } if a.selfie else None,
    }


@router.get("/applications/{application_id}/selfie-image")
def get_selfie_image(
    application_id: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(security.require_admin),
):
    from fastapi.responses import FileResponse, Response
    from ..storage import download_private_file, storage_enabled
    a = db.query(models.LoanApplication).filter(models.LoanApplication.id == application_id).first()
    if not a or not a.selfie or not a.selfie.file_path:
        raise HTTPException(404, "No selfie found for this application.")
    if storage_enabled() and not os.path.isabs(a.selfie.file_path):
        try:
            content, content_type = download_private_file(a.selfie.file_path)
        except RuntimeError as exc:
            raise HTTPException(502, str(exc)) from exc
        return Response(content=content, media_type=content_type or "image/jpeg")
    return FileResponse(a.selfie.file_path)


@router.post("/applications/{application_id}/review")
def review_application(
    application_id: str,
    payload: schemas.AdminReviewRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(security.require_admin),
):
    a = db.query(models.LoanApplication).filter(models.LoanApplication.id == application_id).first()
    if not a:
        raise HTTPException(404, "Application not found.")

    # Map incoming status to enum if possible
    status_map = {
        "Under Review": models.ReviewStatus.UNDER_REVIEW,
        "Approved": models.ReviewStatus.APPROVED,
        "Rejected": models.ReviewStatus.REJECTED,
        "More Information Required": models.ReviewStatus.MORE_INFO_REQUIRED,
    }
    chosen = payload.review_status
    if chosen not in status_map:
        raise HTTPException(400, "Invalid review status.")

    a.review_status = status_map[chosen]
    a.review_remarks = payload.remarks
    a.review_date = datetime.utcnow()
    a.reviewed_by = admin.id

    # Update application overall stage/status for Approved/Rejected
    if a.review_status == models.ReviewStatus.APPROVED:
        a.stage = models.ApplicationStage.APPROVED
        a.status = "Approved"
    elif a.review_status == models.ReviewStatus.REJECTED:
        a.stage = models.ApplicationStage.REJECTED
        a.status = "Rejected"
    elif a.review_status == models.ReviewStatus.MORE_INFO_REQUIRED:
        a.status = "More Information Required"
        # Keep stage at admin review so user can act
    else:
        a.status = "Under Review"

    db.commit()
    return {"message": "Application review updated.", "review_status": a.review_status.value, "review_remarks": a.review_remarks, "review_date": a.review_date}


@router.post("/applications/{application_id}/selfie/review")
def review_selfie(
    application_id: str,
    payload: schemas.SelfieReviewRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(security.require_admin),
):
    a = db.query(models.LoanApplication).filter(models.LoanApplication.id == application_id).first()
    if not a or not a.selfie:
        raise HTTPException(404, "Application or selfie not found.")

    a.selfie.status = models.SelfieStatus.APPROVED if payload.approve else models.SelfieStatus.REJECTED
    a.selfie.reject_reason = None if payload.approve else (payload.reason or "Selfie did not pass verification.")
    a.selfie.reviewed_by = admin.id
    a.selfie.reviewed_at = datetime.utcnow()

    if payload.approve:
        a.stage = models.ApplicationStage.APPROVED
        a.status = "Approved"
    else:
        a.stage = models.ApplicationStage.REJECTED
        a.status = "Rejected"

    db.commit()
    return {"message": f"Selfie {'approved' if payload.approve else 'rejected'}.", "stage": a.stage.value}


@router.post("/applications/{application_id}/disburse")
def confirm_disbursement(
    application_id: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(security.require_admin),
):
    a = db.query(models.LoanApplication).filter(models.LoanApplication.id == application_id).first()
    if not a:
        raise HTTPException(404, "Application not found.")
    if a.stage != models.ApplicationStage.APPROVED:
        raise HTTPException(400, "Application must be approved before disbursement.")

    a.stage = models.ApplicationStage.DISBURSED
    a.status = "Disbursed"
    db.commit()
    return {"message": "Loan disbursed.", "stage": a.stage.value}

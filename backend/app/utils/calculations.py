"""
Core financial calculations for the loan system:
- Credit-tier based interest rate lookup
- Eligibility / Debt-to-Income (DTI) decisioning
- EMI (Equated Monthly Instalment) calculation
- IRR (effective annualised rate the lender actually earns, after fees)

Kept dependency-free (no numpy) so the backend stays lightweight.
"""
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Interest rate tiers (simulated pricing policy, since this is a mocked
# credit-bureau / pricing-engine integration per the assignment notes)
# ---------------------------------------------------------------------------
RATE_TIERS = [
    # (min_score, label, annual_rate_pct)
    (750, "Excellent", 10.5),
    (700, "Very Good", 12.0),
    (650, "Good", 14.5),
    (600, "Fair", 17.5),
    (550, "Below Average", 21.0),
]
POOR_CREDIT_CUTOFF = 550  # below this, loan is declined outright
DEFAULT_PROCESSING_FEE_PCT = 2.0   # % of loan amount
GST_ON_FEE_PCT = 18.0              # standard Indian GST slab on financial fees
DEFAULT_OTHER_CHARGES = 236.0      # flat stamp-duty / doc charges (simulated)
MAX_DTI_RATIO = 0.55               # existing obligations vs income cutoff
MAX_EMI_TO_INCOME = 0.50           # EMI (incl. new loan) must stay under 50% of income


def get_rate_for_score(score: int) -> tuple[str, float]:
    for min_score, label, rate in RATE_TIERS:
        if score >= min_score:
            return label, rate
    return "Poor", 24.0


def calc_emi(principal: float, annual_rate_pct: float, months: int) -> float:
    if months <= 0:
        return 0.0
    r = (annual_rate_pct / 12) / 100
    if r == 0:
        return round(principal / months, 2)
    factor = (1 + r) ** months
    emi = principal * r * factor / (factor - 1)
    return round(emi, 2)


def principal_for_target_emi(target_emi: float, annual_rate_pct: float, months: int) -> float:
    """Inverse of calc_emi: max principal affordable at a given EMI budget."""
    if months <= 0 or target_emi <= 0:
        return 0.0
    r = (annual_rate_pct / 12) / 100
    if r == 0:
        return round(target_emi * months, 2)
    factor = (1 + r) ** months
    principal = target_emi * (factor - 1) / (r * factor)
    return round(principal, 2)


@dataclass
class EligibilityOutcome:
    result: str
    reason: str
    dti_ratio: float
    max_eligible_amount: float
    rate_label: str
    reference_rate: float


def assess_eligibility(
    annual_income: float,
    requested_amount: float,
    credit_score: int,
    existing_monthly_debts: float,
) -> EligibilityOutcome:
    monthly_income = annual_income / 12 if annual_income else 0
    rate_label, rate = get_rate_for_score(credit_score)

    dti_ratio = round((existing_monthly_debts / monthly_income), 4) if monthly_income else 1.0

    if monthly_income <= 0:
        return EligibilityOutcome("Not Eligible", "Income details are insufficient to assess eligibility.",
                                   dti_ratio, 0.0, rate_label, rate)

    if credit_score < POOR_CREDIT_CUTOFF:
        return EligibilityOutcome(
            "Not Eligible",
            f"Credit score {credit_score} is below the minimum threshold of {POOR_CREDIT_CUTOFF}.",
            dti_ratio, 0.0, rate_label, rate,
        )

    if dti_ratio > MAX_DTI_RATIO:
        return EligibilityOutcome(
            "Not Eligible",
            f"Existing debt obligations already consume {dti_ratio*100:.0f}% of monthly income "
            f"(limit {MAX_DTI_RATIO*100:.0f}%).",
            dti_ratio, 0.0, rate_label, rate,
        )

    max_affordable_emi = max((MAX_EMI_TO_INCOME * monthly_income) - existing_monthly_debts, 0)
    # Reference tenure used purely to size the capacity check; actual tenure is chosen later
    reference_tenure = 24
    max_eligible_amount = principal_for_target_emi(max_affordable_emi, rate, reference_tenure)

    if max_eligible_amount <= 0:
        return EligibilityOutcome(
            "Not Eligible",
            "Monthly income does not leave sufficient room for a new EMI after existing obligations.",
            dti_ratio, 0.0, rate_label, rate,
        )

    if requested_amount <= max_eligible_amount:
        return EligibilityOutcome(
            "Eligible",
            f"Income, credit score ({credit_score}, {rate_label}) and existing obligations support the "
            f"requested amount of {requested_amount:,.0f}.",
            dti_ratio, round(max_eligible_amount, 2), rate_label, rate,
        )

    return EligibilityOutcome(
        "Partially Eligible",
        f"Requested amount exceeds what current income supports. Based on affordability, up to "
        f"{max_eligible_amount:,.0f} can be approved at a {reference_tenure}-month tenure.",
        dti_ratio, round(max_eligible_amount, 2), rate_label, rate,
    )


@dataclass
class LoanTerms:
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


def compute_irr_monthly(net_disbursement: float, emi: float, months: int) -> float:
    """Bisection solver for the monthly rate r that equates the PV of `months`
    EMIs to the amount actually disbursed (net of fees). Returns annualised %
    (effective, compounded). This is the *lender's* real yield, always a bit
    higher than the nominal rate once upfront fees are netted out."""
    if net_disbursement <= 0 or emi <= 0 or months <= 0:
        return 0.0

    def pv_of_emis(rate):
        if rate == 0:
            return emi * months
        return emi * (1 - (1 + rate) ** (-months)) / rate

    lo, hi = 0.0, 1.0  # 0% to 100% monthly, comfortably wide bracket
    for _ in range(100):
        mid = (lo + hi) / 2
        pv = pv_of_emis(mid)
        if pv > net_disbursement:
            lo = mid
        else:
            hi = mid
    monthly_rate = (lo + hi) / 2
    annual_effective = ((1 + monthly_rate) ** 12 - 1) * 100
    return round(annual_effective, 3)


def compute_loan_terms(
    loan_amount: float,
    tenure_months: int,
    annual_rate_pct: float,
    processing_fee_pct: float = DEFAULT_PROCESSING_FEE_PCT,
    other_charges: float = DEFAULT_OTHER_CHARGES,
) -> LoanTerms:
    processing_fee = round(loan_amount * processing_fee_pct / 100, 2)
    gst_on_fee = round(processing_fee * GST_ON_FEE_PCT / 100, 2)
    total_charges = round(processing_fee + gst_on_fee + other_charges, 2)
    net_disbursement = round(loan_amount - total_charges, 2)

    emi = calc_emi(loan_amount, annual_rate_pct, tenure_months)
    total_repayment = round(emi * tenure_months, 2)
    total_interest = round(total_repayment - loan_amount, 2)

    irr = compute_irr_monthly(net_disbursement, emi, tenure_months)

    return LoanTerms(
        loan_amount=loan_amount,
        tenure_months=tenure_months,
        interest_rate_annual=annual_rate_pct,
        processing_fee=processing_fee,
        gst_on_fee=gst_on_fee,
        other_charges=other_charges,
        net_disbursement=net_disbursement,
        emi_amount=emi,
        total_interest=total_interest,
        total_repayment=total_repayment,
        total_charges=total_charges,
        irr_annual_pct=irr,
    )

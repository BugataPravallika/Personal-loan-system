export function parsePositiveNumber(value, label) {
  if (value === "" || value === null || value === undefined) {
    return { ok: false, error: `${label} is required.` };
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { ok: false, error: `${label} must be a valid number.` };
  }
  if (num < 0) {
    return { ok: false, error: `${label} cannot be negative.` };
  }
  return { ok: true, value: num };
}

export function validateEligibilityForm(form) {
  const annualIncome = parsePositiveNumber(form.annual_income, "Annual income");
  if (!annualIncome.ok) return annualIncome;

  const requestedAmount = parsePositiveNumber(form.requested_amount, "Requested loan amount");
  if (!requestedAmount.ok) return requestedAmount;

  const creditScore = parsePositiveNumber(form.credit_score, "Credit score");
  if (!creditScore.ok) return creditScore;
  if (creditScore.value < 300 || creditScore.value > 900) {
    return { ok: false, error: "Credit score must be between 300 and 900." };
  }

  const existingDebts = parsePositiveNumber(
    form.existing_monthly_debts === "" ? "0" : form.existing_monthly_debts,
    "Existing monthly debt payments"
  );
  if (!existingDebts.ok) return existingDebts;

  if (!form.employer_name.trim()) {
    return { ok: false, error: "Employer name is required." };
  }
  if (!form.designation.trim()) {
    return { ok: false, error: "Designation is required." };
  }

  return {
    ok: true,
    payload: {
      annual_income: annualIncome.value,
      requested_amount: requestedAmount.value,
      credit_score: Math.round(creditScore.value),
      existing_monthly_debts: existingDebts.value,
      employer_name: form.employer_name.trim(),
      designation: form.designation.trim(),
    },
  };
}

export function blockNegativeNumberInput(e) {
  if (["-", "e", "E", "+"].includes(e.key)) {
    e.preventDefault();
  }
}

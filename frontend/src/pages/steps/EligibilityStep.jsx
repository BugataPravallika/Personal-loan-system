import { useState } from "react";
import client from "../../api/client";
import { Card, Field, Input, Button, Banner, Money } from "../../components/ui";
import { validateEligibilityForm, blockNegativeNumberInput } from "../../utils/validation";

const EMPTY_FORM = {
  annual_income: "",
  requested_amount: "",
  credit_score: "",
  existing_monthly_debts: "",
  employer_name: "",
  designation: "",
};

export default function EligibilityStep({ onNext, initialData }) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          annual_income: String(initialData.annual_income ?? ""),
          requested_amount: String(initialData.requested_amount ?? ""),
          credit_score: String(initialData.credit_score ?? ""),
          existing_monthly_debts: String(initialData.existing_monthly_debts ?? ""),
          employer_name: initialData.employer_name ?? "",
          designation: initialData.designation ?? "",
        }
      : EMPTY_FORM
  );
  const [result, setResult] = useState(
    initialData?.result
      ? {
          result: initialData.result,
          reason: initialData.reason,
          dti_ratio: initialData.dti_ratio,
          max_eligible_amount: initialData.max_eligible_amount,
          rate_label: initialData.rate_label,
          reference_rate: initialData.reference_rate,
        }
      : null
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    const validation = validateEligibilityForm(form);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    try {
      const { data } = await client.post("/application/eligibility", validation.payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resultColor =
    result?.result === "Eligible"
      ? "text-teal-dark bg-teal-light"
      : result?.result === "Partially Eligible"
      ? "text-ink900 bg-gold-light"
      : "text-danger bg-danger-light";

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Loan Eligibility</h2>
      <p className="text-sm text-ink500 mb-6">
        We'll check your income, credit score and existing obligations against the requested amount.
      </p>

      <Banner type="error">{error}</Banner>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Annual income (₹)">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.annual_income}
              onChange={set("annual_income")}
              onKeyDown={blockNegativeNumberInput}
              required
            />
          </Field>
          <Field label="Requested loan amount (₹)">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.requested_amount}
              onChange={set("requested_amount")}
              onKeyDown={blockNegativeNumberInput}
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CIBIL / credit score" hint="300–900">
            <Input
              type="number"
              min="300"
              max="900"
              step="1"
              value={form.credit_score}
              onChange={set("credit_score")}
              onKeyDown={blockNegativeNumberInput}
              required
            />
          </Field>
          <Field label="Existing monthly debt payments (₹)">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.existing_monthly_debts}
              onChange={set("existing_monthly_debts")}
              onKeyDown={blockNegativeNumberInput}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employer name">
            <Input value={form.employer_name} onChange={set("employer_name")} required />
          </Field>
          <Field label="Designation">
            <Input value={form.designation} onChange={set("designation")} required />
          </Field>
        </div>

        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Checking…" : result ? "Recheck Eligibility" : "Check Eligibility"}
        </Button>
      </form>

      {result && (
        <div className="mt-6 border-t border-hairline pt-6">
          <div className={`rounded-lg px-4 py-3 font-display text-lg mb-3 ${resultColor}`}>
            {result.result}
          </div>
          <p className="text-sm text-ink500 mb-4">{result.reason}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-ink500">Credit tier</p>
              <p className="font-mono font-medium">
                {result.rate_label} ({result.reference_rate}% p.a.)
              </p>
            </div>
            <div>
              <p className="text-ink500">Debt-to-income ratio</p>
              <p className="font-mono font-medium">{(result.dti_ratio * 100).toFixed(1)}%</p>
            </div>
            {result.max_eligible_amount > 0 && (
              <div className="col-span-2">
                <p className="text-ink500">Maximum eligible amount</p>
                <p className="font-mono font-medium text-lg">
                  <Money value={result.max_eligible_amount} />
                </p>
              </div>
            )}
          </div>

          {result.result !== "Not Eligible" ? (
            <Button onClick={onNext} className="mt-6">
              Continue to EMI Terms
            </Button>
          ) : (
            <p className="text-sm text-danger mt-6">
              Try adjusting the requested amount or check back once your credit profile improves.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

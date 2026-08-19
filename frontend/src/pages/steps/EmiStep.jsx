import { useEffect, useState, useRef } from "react";
import client from "../../api/client";
import { Card, Field, Input, Select, Button, Banner, Money } from "../../components/ui";
import { blockNegativeNumberInput } from "../../utils/validation";

const TENURES = [6, 12, 18, 24, 36];

export default function EmiStep({ onNext, initialData }) {
  const [amount, setAmount] = useState(initialData?.loan_amount ?? 300000);
  const [tenure, setTenure] = useState(initialData?.tenure_months ?? 24);
  const [quote, setQuote] = useState(initialData ?? null);
  const [error, setError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const debounceRef = useRef(null);

  const fetchQuote = async (loan_amount, tenure_months) => {
    if (!loan_amount || Number(loan_amount) <= 0) return;
    setLoadingQuote(true);
    setError("");
    try {
      const { data } = await client.post("/application/emi/quote", {
        loan_amount: Number(loan_amount),
        tenure_months: Number(tenure_months),
      });
      setQuote(data);
    } catch (err) {
      setError(err.message);
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  useEffect(() => {
    if (!amount || Number(amount) <= 0) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchQuote(amount, tenure), 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, tenure]);

  const handleConfirm = async () => {
    setConfirming(true);
    setError("");
    try {
      await client.post("/application/emi/confirm", {
        loan_amount: Number(amount),
        tenure_months: Number(tenure),
      });
      onNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Choose Your EMI Terms</h2>
      <p className="text-sm text-ink500 mb-6">
        Adjust the amount or tenure below — the ledger updates instantly.
      </p>

      <Banner type="error">{error}</Banner>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Field label="Loan amount (₹)">
          <Input
            type="number"
            min="10000"
            step="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={blockNegativeNumberInput}
          />
        </Field>
        <Field label="Tenure">
          <Select value={tenure} onChange={(e) => setTenure(Number(e.target.value))}>
            {TENURES.map((t) => (
              <option key={t} value={t}>
                {t} months
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-ink text-paper px-6 py-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display text-lg">Loan Ledger</span>
          <span className="font-mono text-xs text-paper/60">
            {loadingQuote ? "recalculating…" : `${quote?.interest_rate_annual ?? "—"}% p.a.`}
          </span>
        </div>

        {quote ? (
          <div className="font-mono text-sm divide-y divide-paper/15">
            <div className="flex justify-between py-2">
              <span className="text-paper/70">Loan amount</span>
              <Money value={quote.loan_amount} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">Processing fee</span>
              <Money value={quote.processing_fee} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">GST on fee (18%)</span>
              <Money value={quote.gst_on_fee} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">Other charges</span>
              <Money value={quote.other_charges} />
            </div>
            <div className="flex justify-between py-2.5 text-gold font-semibold text-base">
              <span>Net disbursement</span>
              <Money value={quote.net_disbursement} />
            </div>
            <div className="flex justify-between py-2 pt-3">
              <span className="text-paper/70">Monthly EMI</span>
              <Money value={quote.emi_amount} className="text-base" />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">Total interest</span>
              <Money value={quote.total_interest} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">Total repayment</span>
              <Money value={quote.total_repayment} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">Total charges</span>
              <Money value={quote.total_charges} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-paper/70">IRR (annualised)</span>
              <span>{quote.irr_annual_pct}%</span>
            </div>
          </div>
        ) : (
          <p className="text-paper/60 text-sm py-6 text-center">Enter an amount to see your terms.</p>
        )}
      </div>

      <Button onClick={handleConfirm} disabled={!quote || confirming} className="w-full">
        {confirming ? "Confirming…" : initialData ? "Update & Continue" : "Confirm & Continue to Bank Details"}
      </Button>
    </Card>
  );
}

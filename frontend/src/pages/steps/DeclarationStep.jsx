import { useState } from "react";
import client from "../../api/client";
import { Card, Button, Banner } from "../../components/ui";

export default function DeclarationStep({ onNext, initialAccepted }) {
  const [accepted, setAccepted] = useState(Boolean(initialAccepted));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await client.post("/application/declaration", { accepted });
      onNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Declaration & Consent</h2>
      <p className="text-sm text-ink500 mb-6">Please review before submitting your final identity check.</p>

      <Banner type="error">{error}</Banner>

      <div className="rounded-lg border border-hairline bg-paper px-5 py-4 text-sm text-ink900 space-y-2 mb-6">
        <p>By continuing, I confirm that:</p>
        <ul className="list-disc pl-5 space-y-1 text-ink500">
          <li>All information provided in this application is true and accurate to the best of my knowledge.</li>
          <li>I consent to EzFinanz verifying my KYC, income, and credit information for this loan.</li>
          <li>I understand the EMI, interest rate, and charges shown, and agree to repay as scheduled.</li>
          <li>I authorise EzFinanz to disburse the approved amount to the bank account provided.</li>
        </ul>
      </div>

      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-hairline accent-teal"
        />
        <span className="text-sm text-ink900">I have read and agree to the declaration above.</span>
      </label>

      <Button onClick={handleSubmit} disabled={!accepted || loading}>
        {loading ? "Confirming…" : initialAccepted ? "Continue to Selfie" : "Confirm & Continue to Selfie"}
      </Button>
    </Card>
  );
}

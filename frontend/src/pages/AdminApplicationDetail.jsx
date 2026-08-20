import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import Logo from "../components/Logo";
import { Card, Button, StageBadge, Money, Banner } from "../components/ui";

function Section({ title, children }) {
  return (
    <Card className="mb-5">
      <h3 className="font-display text-lg text-ink mb-4">{title}</h3>
      {children}
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div className="ledger-row text-sm">
      <span className="text-ink500">{label}</span>
      <span className="font-mono text-ink900">{value ?? "—"}</span>
    </div>
  );
}

export default function AdminApplicationDetail() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState(null);
  const [reviewStatus, setReviewStatus] = useState(app?.review_status || "Under Review");
  const [remarks, setRemarks] = useState(app?.review_remarks || "");

  const load = () => client.get(`/admin/applications/${id}`).then(({ data }) => setApp(data));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!app?.selfie) return;
    let objectUrl;
    client
      .get(`/admin/applications/${id}/selfie-image`, { responseType: "blob" })
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data);
        setSelfieUrl(objectUrl);
      })
      .catch(() => setSelfieUrl(null));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.selfie, id]);

  useEffect(() => {
    if (!app) return;
    setReviewStatus(app.review_status || "Under Review");
    setRemarks(app.review_remarks || "");
  }, [app]);

  const reviewSelfie = async (approve) => {
    setError("");
    setBusy(true);
    try {
      await client.post(`/admin/applications/${id}/selfie/review`, {
        approve,
        reason: approve ? undefined : rejectReason,
      });
      setShowReject(false);
      setRejectReason("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disburse = async () => {
    setError("");
    setBusy(true);
    try {
      await client.post(`/admin/applications/${id}/disburse`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    setError("");
    setBusy(true);
    try {
      await client.post(`/admin/applications/${id}/review`, { review_status: reviewStatus, remarks });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to save review.");
    } finally {
      setBusy(false);
    }
  };

  if (!app) {
    return <div className="min-h-screen flex items-center justify-center text-ink500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Link to="/admin" className="text-sm text-teal hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl text-ink">{app.user.full_name}</h1>
            <p className="text-sm text-ink500">{app.user.email || app.user.phone}</p>
          </div>
          <StageBadge stage={app.stage} />
        </div>

        <Banner type="error">{error}</Banner>

        <Section title="Login & Verification">
          <Row label="Auth method" value={app.user.auth_provider} />
          <Row label="Email verified" value={app.user.email_verified ? "Yes" : "No"} />
          <Row label="Phone verified" value={app.user.phone_verified ? "Yes" : "No"} />
        </Section>

        {app.kyc && (
          <Section title="KYC Details">
            <Row label="Full name" value={app.kyc.full_name} />
            <Row label="Date of birth" value={app.kyc.dob} />
            <Row label="Gender" value={app.kyc.gender} />
            <Row label="Address" value={app.kyc.address} />
            <Row label="ID type / number" value={`${app.kyc.id_type} · ${app.kyc.id_number}`} />
            <Row label="ID document" value={app.kyc.id_document_uploaded ? "Uploaded" : "Not provided"} />
          </Section>
        )}

        {app.eligibility && (
          <Section title="Eligibility & Scores">
            <Row label="Annual income" value={<Money value={app.eligibility.annual_income} />} />
            <Row label="Requested amount" value={<Money value={app.eligibility.requested_amount} />} />
            <Row label="Credit score" value={app.eligibility.credit_score} />
            <Row label="Existing monthly debts" value={<Money value={app.eligibility.existing_debts} />} />
            <Row label="Employer / designation" value={`${app.eligibility.employer_name} · ${app.eligibility.designation}`} />
            <Row label="DTI ratio" value={`${(app.eligibility.dti_ratio * 100).toFixed(1)}%`} />
            <Row label="Result" value={app.eligibility.result} />
            <Row label="Max eligible amount" value={<Money value={app.eligibility.max_eligible_amount} />} />
          </Section>
        )}

        {app.emi && (
          <Section title="Selected EMI Tenure">
            <Row label="Loan amount" value={<Money value={app.emi.loan_amount} />} />
            <Row label="Tenure" value={`${app.emi.tenure_months} months`} />
            <Row label="Interest rate" value={`${app.emi.interest_rate_annual}% p.a.`} />
            <Row label="Processing fee" value={<Money value={app.emi.processing_fee} />} />
            <Row label="GST on fee" value={<Money value={app.emi.gst_on_fee} />} />
            <Row label="Net disbursement" value={<Money value={app.emi.net_disbursement} />} />
            <Row label="Monthly EMI" value={<Money value={app.emi.emi_amount} />} />
            <Row label="Total interest" value={<Money value={app.emi.total_interest} />} />
            <Row label="Total repayment" value={<Money value={app.emi.total_repayment} />} />
            <Row label="IRR (annualised)" value={`${app.emi.irr_annual_pct}%`} />
          </Section>
        )}

        {app.bank_account && (
          <Section title="Bank Account">
            <Row label="Account holder" value={app.bank_account.account_holder_name} />
            <Row label="Account number" value={app.bank_account.account_number} />
            <Row label="IFSC code" value={app.bank_account.ifsc_code} />
            <Row label="Bank name" value={app.bank_account.bank_name} />
          </Section>
        )}

        {app.declaration && (
          <Section title="Declaration">
            <Row label="Accepted" value={app.declaration.accepted ? "Yes" : "No"} />
            <Row label="Accepted at" value={app.declaration.accepted_at && new Date(app.declaration.accepted_at).toLocaleString()} />
          </Section>
        )}

        {app.selfie && (
          <Section title="Selfie / Photo Verification">
            <div className="mb-4">
              {selfieUrl ? (
                <img
                  src={selfieUrl}
                  alt="Customer selfie"
                  className="w-48 h-48 object-cover rounded-xl border border-hairline"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl border border-hairline bg-paper flex items-center justify-center text-xs text-ink500">
                  Loading photo…
                </div>
              )}
            </div>
            <Row label="Status" value={app.selfie.status} />
            <Row label="Submitted at" value={new Date(app.selfie.submitted_at).toLocaleString()} />
            {app.selfie.reject_reason && <Row label="Reject reason" value={app.selfie.reject_reason} />}

            {app.selfie.status === "Pending" && (
              <div className="mt-5 flex flex-col gap-3">
                {showReject ? (
                  <div className="flex gap-2">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      className="flex-1 rounded-lg border border-hairline px-3 py-2 text-sm"
                    />
                    <Button variant="danger" onClick={() => reviewSelfie(false)} disabled={busy}>
                      Confirm Reject
                    </Button>
                    <Button variant="secondary" onClick={() => setShowReject(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={() => reviewSelfie(true)} disabled={busy}>
                      Approve Selfie
                    </Button>
                    <Button variant="danger" onClick={() => setShowReject(true)} disabled={busy}>
                      Reject Selfie
                    </Button>
                  </div>
                )}
              </div>
            )}

            {app.stage === "Approved" && (
              <div className="mt-5">
                <Button onClick={disburse} disabled={busy}>
                  {busy ? "Processing…" : "Confirm Disbursement"}
                </Button>
              </div>
            )}
          </Section>
        )}

        <Section title="Admin Review">
          <div className="space-y-3">
            <Row label="Current status" value={app.review_status || app.status} />
            <Row label="Reviewed at" value={app.review_date ? new Date(app.review_date).toLocaleString() : "—"} />
            {app.review_remarks && <Row label="Remarks" value={app.review_remarks} />}

            <div className="mt-4">
              <label className="text-sm font-medium text-ink900">Update review</label>
              <div className="mt-2 flex gap-2">
                <select id="review_status" className="rounded-lg border border-hairline px-3 py-2 text-sm" onChange={(e) => setReviewStatus(e.target.value)} value={reviewStatus}>
                  <option>Under Review</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                  <option>More Information Required</option>
                </select>
              </div>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks (optional)" className="w-full mt-2 rounded-lg border border-hairline p-3 text-sm" />
              <div className="mt-3 flex gap-3">
                <Button onClick={submitReview} disabled={busy}>{busy ? "Saving…" : "Save Review"}</Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

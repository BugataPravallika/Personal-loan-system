import { useEffect, useMemo, useState } from "react";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Card, Field, Input, Button, Banner } from "../../components/ui";

const RESEND_SECONDS = 60;

function OtpInbox({ messages, loading }) {
  if (loading) {
    return <p className="text-xs text-ink500">Checking your messages…</p>;
  }
  if (!messages.length) {
    return <p className="text-xs text-ink500">Your verification message will appear here once sent.</p>;
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div key={msg.id} className="rounded-lg border border-hairline bg-paper px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-ink900">{msg.subject}</p>
            <span className="text-[10px] uppercase tracking-wide text-ink500">{msg.channel}</span>
          </div>
          <p className="text-xs text-ink500 mb-2">To: {msg.masked_destination}</p>
          <p className="text-sm text-ink900 font-mono">{msg.body}</p>
        </div>
      ))}
    </div>
  );
}

function Channel({ channel, verified, onVerified, profile }) {
  const [otpSent, setOtpSent] = useState(false);
  const [maskedDestination, setMaskedDestination] = useState("");
  const [destination, setDestination] = useState(channel === "email" ? (profile?.email || "") : (profile?.phone || ""));
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState("development");

  const displayLabel = channel === "email" ? "Email" : "Phone Number";
  const actionLabel = channel === "email" ? "Send Verification Code" : "Send OTP";
  const fieldLabel = channel === "email" ? "Enter 6-digit code" : "Enter 6-digit OTP";

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const { data } = await client.get("/verification/inbox");
      setInbox(data.filter((msg) => msg.channel === channel));
    } catch {
      setInbox([]);
    } finally {
      setInboxLoading(false);
    }
  };

  useEffect(() => {
    if (!otpSent || resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpSent, resendIn]);

  const requestOtp = async () => {
    setError("");
    const target = destination.trim();
    if (!target) {
      setError(channel === "email" ? "Enter your email address before sending a verification code." : "Enter your phone number before sending an OTP.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await client.post("/verification/request-otp", { channel, destination: target });
      setOtpSent(true);
      setDeliveryMethod(data.delivery_method || "development");
      setMaskedDestination(data.masked_destination || target);
      setResendIn((data && data.retry_after_seconds) || RESEND_SECONDS);
      if (data.delivery_method === "development") {
        await loadInbox();
      }
    } catch (err) {
      // axios-style error handling
      const resp = err?.response?.data || err?.response;
      if (err?.response?.status === 429) {
        const retryHeader = err?.response?.headers?.["retry-after"];
        const retry = retryHeader ? parseInt(retryHeader, 10) : (resp?.retry_after_seconds || RESEND_SECONDS);
        setError(resp?.detail || "Please wait before requesting another OTP.");
        setOtpSent(true);
        setResendIn(retry);
      } else {
        setError(resp?.detail || err.message || "Unable to send the verification code right now.");
      }
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await client.post("/verification/verify-otp", { channel, code, destination });
      onVerified(channel, data);
    } catch (err) {
      const resp = err?.response?.data || err?.response;
      // If server returned attempts remaining info, show it
      if (resp && typeof resp === "object" && resp.attempts_remaining !== undefined) {
        setError(resp.detail || `Incorrect OTP. ${resp.attempts_remaining} attempts remaining.`);
      } else {
        setError(resp?.detail || err.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-teal-light px-4 py-3 text-sm text-teal-dark font-medium">
        <span>✓</span> {displayLabel} verified
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline p-4 space-y-4">
      <Banner type="error">{error}</Banner>

      <div className="space-y-3">
        <p className="text-sm font-medium text-ink900">{displayLabel}</p>
        <p className="text-sm text-ink500">
          {channel === "email"
            ? (destination ? destination.replace(/(.{1}).*(@.*)/, "$1***$2") : "No email on file")
            : (destination ? destination.replace(/(\+\d{2})\d{4,}(\d{2})$/, "$1 ******$2") : "No phone number on file")}
        </p>

        {!otpSent ? (
          <>
            <Field label={channel === "email" ? "Registered email" : "Phone number"}>
              <Input
                type={channel === "email" ? "email" : "tel"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={channel === "email" ? "you@example.com" : "+91 9XXXXXXXXX"}
              />
            </Field>
            <Button variant="secondary" onClick={requestOtp} disabled={loading || !destination.trim()}>
              {loading ? "Sending…" : actionLabel}
            </Button>
          </>
        ) : (
          <>
            <Banner type="success">
              {deliveryMethod === "development"
                ? <>Verification code sent to <span className="font-mono">{maskedDestination}</span>.</>
                : <>A secure verification code has been sent to <span className="font-mono">{maskedDestination}</span>.</>}
            </Banner>

            {deliveryMethod === "development" && (
              <div>
                <p className="text-xs font-medium text-ink900 mb-2 uppercase tracking-wide">
                  {channel === "email" ? "Email Inbox" : "Development OTP"}
                </p>
                <OtpInbox messages={inbox} loading={inboxLoading} />
                <button type="button" onClick={loadInbox} className="mt-2 text-xs text-teal hover:underline">
                  Refresh messages
                </button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <Field label={fieldLabel} className="flex-1">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                />
              </Field>
              <Button onClick={verify} disabled={loading || code.length !== 6} className="mb-4">
                {loading ? "Verifying…" : "Verify"}
              </Button>
            </div>

            <Button variant="ghost" onClick={requestOtp} disabled={loading || resendIn > 0} className="text-xs">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyStep({ onNext, app }) {
  const { verification, markVerified, profile } = useAuth();

  const emailVerified = Boolean(verification.email_verified || app?.email_verified);
  const phoneVerified = Boolean(verification.phone_verified || app?.phone_verified);
  const canContinue = emailVerified && phoneVerified;

  const handleVerified = (channel, data) => {
    markVerified(channel, data);
  };

  const statusText = useMemo(() => {
    if (emailVerified && phoneVerified) return "Both email and phone are verified.";
    if (emailVerified) return "Email verified. Phone still needs verification.";
    if (phoneVerified) return "Phone verified. Email still needs verification.";
    return "Email and phone verification are both required before continuing.";
  }, [emailVerified, phoneVerified]);

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Verify your identity</h2>
      <p className="text-sm text-ink500 mb-6">
        Confirm your email and phone number so we can securely reach you about your application.
      </p>

      <div className="mb-5 rounded-xl border border-hairline bg-paper px-4 py-3 text-xs text-ink500">
        <span className="font-medium text-ink900">Status:</span> {statusText}
      </div>

      <div className="space-y-4">
        <Channel channel="email" verified={emailVerified} onVerified={handleVerified} profile={profile} />
        <Channel channel="phone" verified={phoneVerified} onVerified={handleVerified} profile={profile} />
      </div>

      <Button onClick={onNext} disabled={!canContinue} className="mt-6">
        Continue to Loan Application
      </Button>
      {!canContinue && (
        <p className="text-xs text-ink500 mt-2">Email and phone verification must both be complete before continuing.</p>
      )}
    </Card>
  );
}

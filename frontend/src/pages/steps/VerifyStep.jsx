import { useEffect, useState } from "react";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Card, Field, Input, Button, Banner } from "../../components/ui";

const RESEND_SECONDS = 60;

function OtpInbox({ messages, loading }) {
  if (loading) {
    return <p className="text-xs text-ink500">Checking your messages…</p>;
  }
  if (!messages.length) {
    return (
      <p className="text-xs text-ink500">
        Your verification message will appear here once sent.
      </p>
    );
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

function Channel({ channel, verified, onVerified }) {
  const [otpSent, setOtpSent] = useState(false);
  const [maskedDestination, setMaskedDestination] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

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
    setLoading(true);
    try {
      const { data } = await client.post("/verification/request-otp", { channel });
      setOtpSent(true);
      setMaskedDestination(data.masked_destination || "");
      setResendIn(RESEND_SECONDS);
      await loadInbox();
    } catch (err) {
      setError(err.message);
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
      const { data } = await client.post("/verification/verify-otp", { channel, code });
      onVerified(channel, data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-teal-light px-4 py-3 text-sm text-teal-dark font-medium">
        <span>✓</span> {channel === "email" ? "Email" : "Phone number"} verified
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline p-4 space-y-4">
      <Banner type="error">{error}</Banner>

      {!otpSent ? (
        <Button variant="secondary" onClick={requestOtp} disabled={loading}>
          {loading ? "Sending…" : `Send verification code to ${channel}`}
        </Button>
      ) : (
        <>
          <Banner type="success">
            Verification code sent to <span className="font-mono">{maskedDestination}</span>.
            Open your {channel === "email" ? "email inbox" : "messages"} below to find the code.
          </Banner>

          <div>
            <p className="text-xs font-medium text-ink900 mb-2 uppercase tracking-wide">
              {channel === "email" ? "Email Inbox" : "SMS Messages"}
            </p>
            <OtpInbox messages={inbox} loading={inboxLoading} />
            <button
              type="button"
              onClick={loadInbox}
              className="mt-2 text-xs text-teal hover:underline"
            >
              Refresh messages
            </button>
          </div>

          <div className="flex gap-2 items-end">
            <Field label="Enter 6-digit code" className="flex-1">
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

          <Button
            variant="ghost"
            onClick={requestOtp}
            disabled={loading || resendIn > 0}
            className="text-xs"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerifyStep({ onNext, app }) {
  const { verification, markVerified } = useAuth();

  const emailVerified = verification.email_verified || app?.email_verified;
  const phoneVerified = verification.phone_verified || app?.phone_verified;
  const canContinue = emailVerified || phoneVerified;

  const handleVerified = (channel, data) => {
    markVerified(channel, data);
  };

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Verify your identity</h2>
      <p className="text-sm text-ink500 mb-6">
        Confirm your email and phone number so we can securely reach you about your application.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-ink900 mb-2">Email</p>
          <Channel channel="email" verified={emailVerified} onVerified={handleVerified} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink900 mb-2">Phone</p>
          <Channel channel="phone" verified={phoneVerified} onVerified={handleVerified} />
        </div>
      </div>

      <Button onClick={onNext} disabled={!canContinue} className="mt-6">
        Continue to KYC
      </Button>
      {!canContinue && (
        <p className="text-xs text-ink500 mt-2">Verify at least one channel to continue.</p>
      )}
    </Card>
  );
}

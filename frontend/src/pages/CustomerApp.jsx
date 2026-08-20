import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import Stepper from "../components/Stepper";
import Logo from "../components/Logo";
import { Button } from "../components/ui";

import VerifyStep from "./steps/VerifyStep";
import KycStep from "./steps/KycStep";
import EligibilityStep from "./steps/EligibilityStep";
import EmiStep from "./steps/EmiStep";
import BankStep from "./steps/BankStep";
import DeclarationStep from "./steps/DeclarationStep";
import SelfieStep from "./steps/SelfieStep";
import StatusStep from "./steps/StatusStep";

const VIEW_STEP_KEY = "ezfinanz_view_step";

function computeStep(app) {
  if (!app) return "verify";
  if (!(app.email_verified && app.phone_verified)) return "verify";
  if (!app.has_kyc) return "kyc";
  if (!app.has_eligibility || app.eligibility_result === "Not Eligible") return "eligibility";
  if (!app.has_emi) return "emi";
  if (!app.has_bank) return "bank";
  if (!app.has_declaration) return "declaration";
  if (!app.selfie_status) return "selfie";
  return "status";
}

export default function CustomerApp() {
  const [app, setApp] = useState(null);
  const [viewStep, setViewStep] = useState(() => sessionStorage.getItem(VIEW_STEP_KEY));
  const [loading, setLoading] = useState(true);
  const { logout, syncVerification } = useAuth();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/application/me");
      setApp(data);
      syncVerification({
        email_verified: data.email_verified,
        phone_verified: data.phone_verified,
      });
      setViewStep((prev) => {
        if (prev) return prev;
        const saved = sessionStorage.getItem(VIEW_STEP_KEY);
        if (saved) return saved;
        return computeStep(data);
      });
    } finally {
      setLoading(false);
    }
  }, [syncVerification]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleNavigate = (stepKey) => {
    if (!app || !(app.email_verified && app.phone_verified)) {
      sessionStorage.setItem(VIEW_STEP_KEY, "verify");
      setViewStep("verify");
      return;
    }
    sessionStorage.setItem(VIEW_STEP_KEY, stepKey);
    setViewStep(stepKey);
  };

  const handleNext = async () => {
    await refresh();
    sessionStorage.removeItem(VIEW_STEP_KEY);
    setViewStep(null);
  };

  useEffect(() => {
    if (app && viewStep === null) {
      const next = computeStep(app);
      sessionStorage.setItem(VIEW_STEP_KEY, next);
      setViewStep(next);
    }
  }, [app, viewStep]);

  const handleLogout = () => {
    sessionStorage.removeItem(VIEW_STEP_KEY);
    logout();
    navigate("/login");
  };

  if (loading && !app) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink500">
        Loading your application…
      </div>
    );
  }

  const currentComputed = computeStep(app);
  const stepToRender = viewStep || currentComputed;

  const renderStep = () => {
    switch (stepToRender) {
      case "verify":
        return <VerifyStep onNext={handleNext} app={app} />;
      case "kyc":
        return <KycStep onNext={handleNext} initialData={app?.kyc} />;
      case "eligibility":
        return <EligibilityStep onNext={handleNext} initialData={app?.eligibility} />;
      case "emi":
        return <EmiStep onNext={handleNext} initialData={app?.emi} />;
      case "bank":
        return <BankStep onNext={handleNext} initialData={app?.bank_account} />;
      case "declaration":
        return <DeclarationStep onNext={handleNext} initialAccepted={app?.declaration_accepted} />;
      case "selfie":
        return <SelfieStep onNext={handleNext} />;
      case "status":
        return <StatusStep stage={app.stage} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Button variant="secondary" onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8">
        <aside className="bg-white/50 rounded-2xl p-3 space-y-4">
          <div className="rounded-lg border border-hairline p-4 bg-white">
            <h3 className="font-medium text-sm text-ink900 mb-2">Application Status</h3>
            <div className="text-sm text-ink700 mb-2">{app?.review_status || app?.status}</div>
            {app?.review_remarks && (
              <div className="text-xs text-ink500 mb-1">Remarks</div>
            )}
            {app?.review_remarks && <div className="text-sm font-mono text-ink900">{app.review_remarks}</div>}
            {app?.review_date && <div className="text-xs text-ink500 mt-2">Reviewed at {new Date(app.review_date).toLocaleString()}</div>}
          </div>

          <Stepper currentKey={currentComputed} onNavigate={handleNavigate} />
        </aside>
        <main key={`${stepToRender}-${app?.id}`}>{renderStep()}</main>
      </div>
    </div>
  );
}

export const STEPS = [
  { key: "verify", label: "Verify Identity", note: "Email & phone" },
  { key: "kyc", label: "KYC Details", note: "Identity & address" },
  { key: "eligibility", label: "Eligibility Check", note: "Income & credit score" },
  { key: "emi", label: "EMI Terms", note: "Amount & tenure" },
  { key: "bank", label: "Bank Account", note: "Disbursement account" },
  { key: "declaration", label: "Declaration", note: "Consent & confirmation" },
  { key: "selfie", label: "Selfie Verification", note: "Live photo check" },
  { key: "status", label: "Application Status", note: "Admin review & disbursal" },
];

export default function Stepper({ currentKey, onNavigate }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentKey);

  return (
    <nav className="flex flex-col">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isClickable = idx <= currentIdx;

        return (
          <button
            key={step.key}
            disabled={!isClickable}
            onClick={() => isClickable && onNavigate(step.key)}
            className={`group flex items-start gap-3 text-left py-3 px-2 rounded-lg transition-colors
              ${isCurrent ? "bg-teal-light" : "hover:bg-white/60"}
              ${!isClickable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono
                ${isDone ? "bg-teal text-white" : isCurrent ? "border-2 border-teal text-teal font-semibold" : "border border-hairline text-ink500"}`}
            >
              {isDone ? "✓" : idx + 1}
            </span>
            <span>
              <span className={`block text-sm font-medium ${isCurrent ? "text-ink" : "text-ink900"}`}>
                {step.label}
              </span>
              <span className="block text-xs text-ink500">{step.note}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

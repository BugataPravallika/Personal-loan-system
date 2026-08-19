export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-hairline shadow-sm p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink900 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink500 mt-1">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm text-ink900 placeholder:text-ink500/60
        focus:border-teal transition-colors ${props.className || ""}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm text-ink900 bg-white focus:border-teal transition-colors"
    >
      {children}
    </select>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-dark disabled:bg-teal/40",
    secondary: "bg-white text-ink border border-hairline hover:border-ink disabled:opacity-40",
    danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
    ghost: "text-teal hover:bg-teal-light disabled:opacity-40",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold
        transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Banner({ type = "error", children }) {
  if (!children) return null;
  const styles =
    type === "error"
      ? "bg-danger-light text-danger border-danger/20"
      : type === "success"
      ? "bg-teal-light text-teal-dark border-teal/20"
      : "bg-gold-light text-ink900 border-gold/30";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm mb-5 ${styles}`}>{children}</div>
  );
}

export function StageBadge({ stage }) {
  const map = {
    "Approved": "bg-teal-light text-teal-dark",
    "Disbursed": "bg-teal text-white",
    "Rejected": "bg-danger-light text-danger",
    "Waiting for Admin Review": "bg-gold-light text-ink900",
  };
  const cls = map[stage] || "bg-hairline/60 text-ink500";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium font-mono ${cls}`}>
      {stage}
    </span>
  );
}

export function Money({ value, className = "" }) {
  const n = Number(value || 0);
  return (
    <span className={`font-mono ${className}`}>
      ₹{n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
    </span>
  );
}

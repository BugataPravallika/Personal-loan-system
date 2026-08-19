export default function Logo({ dark = false }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="1" y="1" width="28" height="28" rx="7" stroke={dark ? "#F5F7FA" : "#0F2C4C"} strokeWidth="1.6" />
        <path d="M9 20.5V9.5H19.5" stroke={dark ? "#F5F7FA" : "#0F2C4C"} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 15h7" stroke="#E8A33D" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-xl tracking-tight ${dark ? "text-paper" : "text-ink"}`}>
        Ez<span className="text-teal">Finanz</span>
      </span>
    </div>
  );
}

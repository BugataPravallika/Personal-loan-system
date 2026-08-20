import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import { Button, StageBadge, Money } from "../components/ui";

export default function AdminDashboard() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    client.get("/admin/applications").then(({ data }) => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink500">Admin Dashboard</span>
            <Button variant="secondary" onClick={handleLogout}>
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl text-ink mb-1">Loan Applications</h1>
        <p className="text-sm text-ink500 mb-6">{apps.length} total application{apps.length !== 1 ? "s" : ""}</p>

        {loading ? (
          <p className="text-ink500 text-sm">Loading…</p>
        ) : apps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-ink500">
            No applications submitted yet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-hairline overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper text-ink500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Applicant</th>
                  <th className="text-left px-5 py-3 font-medium">Loan Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Tenure</th>
                  <th className="text-left px-5 py-3 font-medium">Stage</th>
                  <th className="text-left px-5 py-3 font-medium">Review</th>
                  <th className="text-left px-5 py-3 font-medium">Submitted</th>
                  <th className="text-left px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-hairline hover:bg-paper/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-ink900">{a.applicant_name}</div>
                      <div className="text-xs text-ink500">{a.email || a.phone}</div>
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {a.loan_amount ? <Money value={a.loan_amount} /> : "—"}
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {a.tenure_months ? `${a.tenure_months} mo` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StageBadge stage={a.stage} />
                    </td>
                    <td className="px-5 py-4 font-mono text-sm">{a.review_status || "—"}</td>
                    <td className="px-5 py-4 text-ink500 text-xs font-mono">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <Button variant="ghost" onClick={() => navigate(`/admin/applications/${a.id}`)}>
                        View →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

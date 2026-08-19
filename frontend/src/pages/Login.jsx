import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, Field, Input, Button, Banner } from "../components/ui";
import Logo from "../components/Logo";
import GoogleSignInButton from "../components/GoogleSignInButton";

const TABS = [
  { key: "login", label: "Log In" },
  { key: "signup", label: "Sign Up" },
];

const METHODS = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "google", label: "Google" },
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function Login() {
  const [tab, setTab] = useState("login");
  const [method, setMethod] = useState("email");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signup, login, googleSignIn } = useAuth();
  const navigate = useNavigate();

  const goAfterAuth = (data) => {
    navigate(data.role === "admin" ? "/admin" : "/apply");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "signup") {
        const payload = { full_name: fullName };
        if (method === "email") {
          payload.email = identifier;
          payload.password = password;
        } else {
          payload.phone = identifier;
        }
        const data = await signup(payload);
        goAfterAuth(data);
      } else {
        const data = await login({ identifier, password: method === "email" ? password : undefined });
        goAfterAuth(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setError("");
    setLoading(true);
    try {
      const data = await googleSignIn(response.credential);
      goAfterAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo dark />
        </div>
        <Card>
          <div className="flex rounded-lg bg-paper p-1 mb-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  tab === t.key ? "bg-white text-ink shadow-sm" : "text-ink500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
            {METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMethod(m.key)}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  method === m.key
                    ? "border-teal text-teal bg-teal-light"
                    : "border-hairline text-ink500 hover:border-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Banner type="error">{error}</Banner>

          {method === "google" ? (
            <div className="space-y-4">
              <p className="text-sm text-ink500">
                Sign in securely with your Google account. Your email will be verified automatically.
              </p>
              {GOOGLE_CLIENT_ID ? (
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in was cancelled or failed.")}
                />
              ) : (
                <Banner type="error">
                  Google Sign-In is not configured. Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in
                  the frontend and <code className="font-mono">GOOGLE_CLIENT_ID</code> on the backend.
                </Banner>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {tab === "signup" && (
                <Field label="Full name">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As per your ID"
                    required
                  />
                </Field>
              )}

              <Field label={method === "email" ? "Email address" : "Phone number"}>
                <Input
                  type={method === "email" ? "email" : "tel"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={method === "email" ? "you@example.com" : "+91 9XXXXXXXXX"}
                  required
                />
              </Field>

              {method === "email" && (
                <Field label="Password">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </Field>
              )}

              {method === "phone" && (
                <p className="text-xs text-ink500 -mt-2 mb-4">
                  Phone accounts sign in via OTP — you'll verify your number right after this step.
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? "Please wait…" : tab === "login" ? "Log In" : "Create Account"}
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-ink500 mt-6">
            Admins use the same form — email + password issued by EzFinanz.
          </p>
        </Card>
      </div>
    </div>
  );
}

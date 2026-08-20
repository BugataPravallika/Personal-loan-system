import { createContext, useContext, useState, useCallback } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("ezfinanz_token"));
  const [role, setRole] = useState(localStorage.getItem("ezfinanz_role"));
  const [profile, setProfile] = useState({
    email: localStorage.getItem("ezfinanz_email") || "",
    phone: localStorage.getItem("ezfinanz_phone") || "",
  });
  const [verification, setVerification] = useState({
    email_verified: localStorage.getItem("ezfinanz_email_verified") === "true",
    phone_verified: localStorage.getItem("ezfinanz_phone_verified") === "true",
  });

  const applyAuth = useCallback((data) => {
    localStorage.setItem("ezfinanz_token", data.access_token);
    localStorage.setItem("ezfinanz_role", data.role);
    localStorage.setItem("ezfinanz_email", data.email || "");
    localStorage.setItem("ezfinanz_phone", data.phone || "");
    localStorage.setItem("ezfinanz_email_verified", String(data.email_verified));
    localStorage.setItem("ezfinanz_phone_verified", String(data.phone_verified));
    setToken(data.access_token);
    setRole(data.role);
    setProfile({ email: data.email || "", phone: data.phone || "" });
    setVerification({
      email_verified: data.email_verified,
      phone_verified: data.phone_verified,
    });
  }, []);

  const syncVerification = useCallback(({ email_verified, phone_verified }) => {
    localStorage.setItem("ezfinanz_email_verified", String(email_verified));
    localStorage.setItem("ezfinanz_phone_verified", String(phone_verified));
    setVerification({ email_verified, phone_verified });
  }, []);

  const markVerified = useCallback((channel, data) => {
    setVerification((prev) => {
      const emailVerified = data?.email_verified ?? (channel === "email" ? true : prev.email_verified);
      const phoneVerified = data?.phone_verified ?? (channel === "phone" ? true : prev.phone_verified);
      localStorage.setItem("ezfinanz_email_verified", String(emailVerified));
      localStorage.setItem("ezfinanz_phone_verified", String(phoneVerified));

      // Update profile if the backend returned canonicalized email/phone
      if (data?.email) {
        localStorage.setItem("ezfinanz_email", data.email);
        setProfile((p) => ({ ...p, email: data.email }));
      }
      if (data?.phone) {
        localStorage.setItem("ezfinanz_phone", data.phone);
        setProfile((p) => ({ ...p, phone: data.phone }));
      }

      return { email_verified: emailVerified, phone_verified: phoneVerified };
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ezfinanz_token");
    localStorage.removeItem("ezfinanz_role");
    localStorage.removeItem("ezfinanz_email");
    localStorage.removeItem("ezfinanz_phone");
    localStorage.removeItem("ezfinanz_email_verified");
    localStorage.removeItem("ezfinanz_phone_verified");
    sessionStorage.removeItem("ezfinanz_view_step");
    setToken(null);
    setRole(null);
    setProfile({ email: "", phone: "" });
    setVerification({ email_verified: false, phone_verified: false });
  }, []);

  const signup = async (payload) => {
    const { data } = await client.post("/auth/signup", payload);
    applyAuth(data);
    return data;
  };

  const login = async (payload) => {
    const { data } = await client.post("/auth/login", payload);
    applyAuth(data);
    return data;
  };

  const googleSignIn = async (credential) => {
    const { data } = await client.post("/auth/google", { credential });
    applyAuth(data);
    return data;
  };

  const oauthGoogle = async (payload) => {
    const { data } = await client.post("/auth/oauth/google", payload);
    applyAuth(data);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        profile,
        verification,
        signup,
        login,
        googleSignIn,
        oauthGoogle,
        logout,
        markVerified,
        syncVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

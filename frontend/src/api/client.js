import axios from "axios";

// Central API client used by the React app.
// It injects the JWT token for authenticated requests and converts backend
// error payloads into friendly UI messages.
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("ezfinanz_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err?.response?.data?.detail || err?.message || "Something went wrong. Please try again.";
    return Promise.reject(new Error(message));
  }
);

export default client;

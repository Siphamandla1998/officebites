import axios from "axios";

// Central Axios instance. Swap VITE_API_BASE_URL when the real backend exists —
// nothing else in the app needs to change since all services import this client.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("ob_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // Centralised error normalisation so every service throws the same shape.
    const message =
      error?.response?.data?.message || error?.message || "Something went wrong";
    return Promise.reject({ message, status: error?.response?.status });
  }
);

export default axiosClient;

import axios from "axios";

const defaultBaseUrl =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? defaultBaseUrl,
  withCredentials: true,
});

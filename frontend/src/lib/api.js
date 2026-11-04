
import axios from "axios";

/**
 * Base URL API Laravel.
 * Atur lewat frontend/.env:
 * VITE_API_BASE_URL=http://127.0.0.1:8000/api
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredBaseUrl || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

/**
 * Gunakan key ini di AuthContext, jangan menduplikasi
 * nama key di banyak file.
 */
export const API_TOKEN_LS_KEY = "motopartspro_token";

export function getAuthToken() {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(API_TOKEN_LS_KEY);
  } catch {
    return null;
  }
}

export function saveAuthToken(token) {
  if (typeof token !== "string" || token.trim() === "") {
    throw new TypeError("Token autentikasi tidak valid.");
  }

  try {
    window.localStorage.setItem(
      API_TOKEN_LS_KEY,
      token.trim(),
    );
  } catch {
    throw new Error(
      "Token tidak dapat disimpan pada penyimpanan browser.",
    );
  }
}

export function clearAuthToken() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(API_TOKEN_LS_KEY);
    }
  } catch {
    // Kegagalan storage tidak boleh menutupi error API awal.
  }
}

/**
 * AuthContext dapat mendaftarkan callback untuk mereset
 * user state saat backend mengembalikan HTTP 401.
 */
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler =
    typeof handler === "function" ? handler : null;

  const registeredHandler = unauthorizedHandler;

  return () => {
    if (unauthorizedHandler === registeredHandler) {
      unauthorizedHandler = null;
    }
  };
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Token dibaca ulang pada setiap request.
 * Jangan pernah menuliskan token secara hardcoded.
 *
 * Tidak menetapkan Content-Type secara global menjaga agar
 * upload FormData bisa menggunakan multipart boundary browser.
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers.delete("Authorization");
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Jika token invalid atau expired, bersihkan token lokal
 * dan beri tahu AuthContext.
 *
 * Login/register dikecualikan agar kredensial salah tidak
 * mengganggu sesi yang sedang ada.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url ?? "")
        .split("?")[0]
        .replace(/\/+$/, "");

      const isAuthenticationEndpoint =
        /\/(login|register)$/.test(requestUrl);

      if (!isAuthenticationEndpoint) {
        clearAuthToken();

        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

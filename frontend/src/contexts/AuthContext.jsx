
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient, {
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
  setUnauthorizedHandler,
} from "../lib/api";

const AuthContext = createContext(null);

function getErrorMessage(error, fallback) {
  const response = error?.response?.data;
  const validationErrors = response?.errors;

  if (validationErrors && typeof validationErrors === "object") {
    for (const messages of Object.values(validationErrors)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") {
        return messages[0];
      }
    }
  }

  if (typeof response?.message === "string") {
    return response.message;
  }

  if (typeof error?.message === "string") {
    return error.message;
  }

  return fallback;
}

function extractUser(responseData) {
  // Kompatibel dengan respons objek langsung dan resource { data: {...} }.
  const candidate =
    responseData?.user ??
    responseData?.data ??
    responseData;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !Number.isInteger(Number(candidate.id)) ||
    !["admin", "staff", "member"].includes(candidate.role)
  ) {
    return null;
  }

  return candidate;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  /**
   * Bootstrap sesi saat aplikasi dimuat atau di-refresh.
   * Token lokal bukan bukti autentikasi; Laravel tetap
   * harus mengonfirmasi token melalui endpoint /user.
   */
  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const token = getAuthToken();

      if (!token) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }

        return;
      }

      try {
        const response = await apiClient.get("/user");
        const currentUser = extractUser(response.data);

        if (!currentUser || currentUser.is_active === false) {
          throw new Error("Informasi akun tidak valid.");
        }

        if (!cancelled) {
          setUser(currentUser);
        }
      } catch (error) {
        const status = error?.response?.status;

        // Token yang ditolak atau akun yang dinonaktifkan
        // tidak boleh dianggap sebagai sesi aktif.
        if (status === 401 || status === 403) {
          clearAuthToken();
        }

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Respons HTTP 401 dari API menghapus sesi frontend.
   * Handler dilepas saat provider di-unmount.
   */
  useEffect(() => {
    return setUnauthorizedHandler(() => {
      clearAuthToken();
      setUser(null);
      setIsLoading(false);
    });
  }, []);

  /**
   * Ambil kembali informasi pengguna dari backend.
   * Alias mutateUser disediakan untuk kompatibilitas
   * dengan komponen autentikasi sebelumnya.
   */
  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setIsLoading(false);

      return {
        success: false,
        message: "Silakan login terlebih dahulu.",
      };
    }

    try {
      const response = await apiClient.get("/user");
      const currentUser = extractUser(response.data);

      if (!currentUser || currentUser.is_active === false) {
        clearAuthToken();
        setUser(null);

        return {
          success: false,
          message: "Sesi tidak valid atau akun tidak aktif.",
        };
      }

      setUser(currentUser);

      return {
        success: true,
        user: currentUser,
      };
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        clearAuthToken();
        setUser(null);
      }

      return {
        success: false,
        message: getErrorMessage(
          error,
          "Gagal memuat informasi pengguna.",
        ),
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login menggunakan endpoint POST /api/login.
   * Hasil berupa object agar komponen bisa menampilkan
   * pesan kegagalan tanpa harus menangkap exception.
   */
  const login = useCallback(async (email, password) => {
    setIsAuthenticating(true);

    try {
      const response = await apiClient.post("/login", {
        email: String(email ?? "").trim(),
        password,
      });

      const token = response.data?.token;
      const currentUser = extractUser(response.data);

      if (!token || !currentUser) {
        clearAuthToken();
        setUser(null);

        return {
          success: false,
          message: "Respons login dari server tidak valid.",
        };
      }

      if (currentUser.is_active === false) {
        clearAuthToken();
        setUser(null);

        return {
          success: false,
          message: "Akun tidak aktif.",
        };
      }

      saveAuthToken(token);
      setUser(currentUser);

      return {
        success: true,
        user: currentUser,
        message: response.data?.message ?? "Login berhasil.",
      };
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(
          error,
          "Login gagal. Periksa koneksi dan kredensial lu.",
        ),
      };
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  /**
   * Registrasi melalui POST /api/register.
   * Backend menetapkan role member secara default.
   */
  const register = useCallback(async (formData) => {
    setIsAuthenticating(true);

    try {
      const response = await apiClient.post("/register", {
        name: formData.name,
        email: String(formData.email ?? "").trim(),
        password: formData.password,
        password_confirmation: formData.password_confirmation,
      });

      const token = response.data?.token;
      const currentUser = extractUser(response.data);

      if (!token || !currentUser) {
        return {
          success: false,
          message: "Respons registrasi dari server tidak valid.",
        };
      }

      if (currentUser.role !== "member") {
        clearAuthToken();
        setUser(null);

        return {
          success: false,
          message: "Role akun hasil registrasi tidak valid.",
        };
      }

      saveAuthToken(token);
      setUser(currentUser);

      return {
        success: true,
        user: currentUser,
        message: response.data?.message ?? "Registrasi berhasil.",
      };
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(
          error,
          "Registrasi gagal. Silakan periksa kembali data lu.",
        ),
      };
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  /**
   * Logout mencoba mencabut token di server.
   * Token lokal dan user state tetap dibersihkan
   * meskipun server tidak dapat dihubungi.
   */
  const logout = useCallback(async () => {
    let serverLogoutSucceeded = false;
    let message = "Sesi lokal sudah dibersihkan.";

    try {
      if (getAuthToken()) {
        const response = await apiClient.post("/logout");

        serverLogoutSucceeded = true;
        message = response.data?.message ?? "Logout berhasil.";
      } else {
        serverLogoutSucceeded = true;
        message = "Tidak ada sesi aktif.";
      }
    } catch (error) {
      message = getErrorMessage(
        error,
        "Server tidak dapat dihubungi. Sesi lokal sudah dibersihkan.",
      );
    } finally {
      clearAuthToken();
      setUser(null);
      setIsAuthenticating(false);
    }

    return {
      success: serverLogoutSucceeded,
      message,
    };
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticating,
    isAuthenticated: Boolean(user && user.is_active !== false),

    login,
    register,
    logout,

    refreshUser,
    mutateUser: refreshUser,
  }), [
    user,
    isLoading,
    isAuthenticating,
    login,
    register,
    logout,
    refreshUser,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth harus digunakan di dalam AuthProvider.",
    );
  }

  return context;
}

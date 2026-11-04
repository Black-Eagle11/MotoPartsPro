
import { useEffect, useId, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

function getSafeReturnPath(state) {
  const from = state?.from;

  if (
    !from ||
    typeof from.pathname !== "string" ||
    !from.pathname.startsWith("/") ||
    from.pathname.startsWith("//") ||
    ["/login", "/register"].includes(from.pathname)
  ) {
    return "/dashboard";
  }

  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}

export default function LoginPage() {
  const emailId = useId();
  const passwordId = useId();

  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    user,
    isLoading,
    isAuthenticating,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isSubmitting || isAuthenticating;

  useEffect(() => {
    if (!isLoading && user) {
      navigate(
        getSafeReturnPath(location.state),
        { replace: true },
      );
    }
  }, [isLoading, user, navigate, location.state]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password);

      if (!result?.success) {
        setError(
          result?.message ??
            "Login gagal. Periksa email dan password lu.",
        );

        return;
      }

      const destination = getSafeReturnPath(location.state);

      navigate(destination, {
        replace: true,
        state: null,
      });
    } catch {
      setError(
        "Terjadi kesalahan saat login. Periksa koneksi dan coba kembali.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || user) {
    return (
      <main className="auth-layout">
        <section
          className="auth-card loading-state"
          role="status"
          aria-live="polite"
        >
          <h1 className="page-title">MotoPartsPro</h1>
          <p>Memeriksa sesi akun...</p>
        </section>
      </main>
    );
  }

  const logoutMessage = location.state?.logoutMessage;

  return (
    <main className="auth-layout">
      <section
        className="auth-card"
        aria-labelledby="login-title"
      >
        <header style={{ marginBottom: 28 }}>
          <Link
            to="/login"
            className="app-brand"
            style={{
              color: "var(--color-text)",
              marginBottom: 28,
            }}
            aria-label="MotoPartsPro"
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 46,
                height: 46,
                flexShrink: 0,
                borderRadius: 12,
                background: "#172554",
                color: "#ffffff",
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              MP
            </span>

            <span>MotoPartsPro</span>
          </Link>

          <h1
            id="login-title"
            className="auth-title"
          >
            Selamat datang kembali
          </h1>

          <p className="auth-description">
            Masuk untuk mengakses sistem manajemen suku cadang motor.
          </p>
        </header>

        {logoutMessage && (
          <div
            className="alert alert-success"
            role="status"
            style={{ marginBottom: 18 }}
          >
            {logoutMessage}
          </div>
        )}

        {error && (
          <div
            className="alert alert-error"
            role="alert"
            aria-live="assertive"
            style={{ marginBottom: 18 }}
          >
            {error}
          </div>
        )}

        <form
          className="form"
          onSubmit={handleSubmit}
        >
          <div className="field">
            <label
              htmlFor={emailId}
              className="field-label"
            >
              Alamat email
            </label>

            <input
              id={emailId}
              name="email"
              type="email"
              className="form-control"
              placeholder="nama@email.com"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              disabled={isBusy}
            />
          </div>

          <div className="field">
            <label
              htmlFor={passwordId}
              className="field-label"
            >
              Password
            </label>

            <div
              className="flex items-center gap-2"
              style={{ position: "relative" }}
            >
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                className="form-control"
                style={{ paddingRight: 82 }}
                placeholder="Masukkan password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                maxLength={255}
                disabled={isBusy}
              />

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  position: "absolute",
                  right: 4,
                  minHeight: 32,
                  padding: "5px 9px",
                  fontSize: 12,
                }}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
                aria-pressed={showPassword}
                disabled={isBusy}
              >
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ minHeight: 46, marginTop: 6 }}
            disabled={isBusy || !email.trim() || !password}
          >
            {isBusy ? "Sedang masuk..." : "Masuk ke Akun"}
          </button>
        </form>

        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid var(--color-border)",
            textAlign: "center",
          }}
        >
          <p
            className="text-muted"
            style={{ marginBottom: 0 }}
          >
            Belum punya akun?{" "}
            <Link
              to="/register"
              style={{ fontWeight: 700 }}
            >
              Daftar sekarang
            </Link>
          </p>
        </div>

        <p
          className="text-muted"
          style={{
            marginTop: 22,
            marginBottom: 0,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          MotoPartsPro · Sistem Informasi Manajemen Suku Cadang
        </p>
      </section>
    </main>
  );
}

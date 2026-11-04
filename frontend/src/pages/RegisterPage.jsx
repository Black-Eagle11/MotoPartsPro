
import { useEffect, useId, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

function validatePassword(password) {
  if (password.length < 12) {
    return "Password harus memiliki minimal 12 karakter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password harus memiliki setidaknya satu huruf kecil.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password harus memiliki setidaknya satu huruf besar.";
  }

  if (!/\d/.test(password)) {
    return "Password harus memiliki setidaknya satu angka.";
  }

  return "";
}

export default function RegisterPage() {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmationId = useId();

  const navigate = useNavigate();

  const {
    register,
    user,
    isLoading,
    isAuthenticating,
  } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isSubmitting || isAuthenticating;

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2) {
      setError("Nama minimal harus terdiri dari 2 karakter.");
      return;
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register({
        name: normalizedName,
        email: normalizedEmail,
        password,
        password_confirmation: passwordConfirmation,
      });

      if (!result?.success) {
        setError(
          result?.message ??
            "Registrasi gagal. Periksa data yang lu masukkan.",
        );

        return;
      }

      navigate("/dashboard", {
        replace: true,
        state: null,
      });
    } catch {
      setError(
        "Terjadi kesalahan saat registrasi. Periksa koneksi dan coba kembali.",
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

  return (
    <main className="auth-layout">
      <section
        className="auth-card"
        aria-labelledby="register-title"
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
            id="register-title"
            className="auth-title"
          >
            Buat akun baru
          </h1>

          <p className="auth-description">
            Daftar untuk menjelajahi katalog suku cadang dan mengelola pesanan.
          </p>
        </header>

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
              htmlFor={nameId}
              className="field-label"
            >
              Nama lengkap
            </label>

            <input
              id={nameId}
              name="name"
              type="text"
              className="form-control"
              placeholder="Masukkan nama lengkap"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={120}
              required
              disabled={isBusy}
            />
          </div>

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
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
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

            <div style={{ position: "relative" }}>
              <input
                id={passwordId}
                name="password"
                type={showPasswords ? "text" : "password"}
                className="form-control"
                style={{ paddingRight: 82 }}
                placeholder="Minimal 12 karakter"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                maxLength={255}
                required
                disabled={isBusy}
                aria-describedby={`${passwordId}-help`}
              />

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  position: "absolute",
                  right: 4,
                  top: 4,
                  minHeight: 32,
                  padding: "5px 9px",
                  fontSize: 12,
                }}
                onClick={() => setShowPasswords((value) => !value)}
                aria-label={
                  showPasswords
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
                aria-pressed={showPasswords}
                disabled={isBusy}
              >
                {showPasswords ? "Sembunyikan" : "Lihat"}
              </button>
            </div>

            <p
              id={`${passwordId}-help`}
              className="field-help"
            >
              Minimal 12 karakter, dengan huruf besar, huruf kecil,
              dan angka.
            </p>
          </div>

          <div className="field">
            <label
              htmlFor={confirmationId}
              className="field-label"
            >
              Konfirmasi password
            </label>

            <input
              id={confirmationId}
              name="password_confirmation"
              type={showPasswords ? "text" : "password"}
              className="form-control"
              placeholder="Masukkan ulang password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(event.target.value)
              }
              maxLength={255}
              required
              disabled={isBusy}
            />
          </div>

          <div
            className="alert"
            style={{
              background: "var(--color-primary-soft)",
              color: "#1e40af",
              borderColor: "#bfdbfe",
              fontSize: 13,
            }}
          >
            Akun yang dibuat melalui halaman ini memperoleh role
            Member. Hak akses Admin dan Staff ditetapkan oleh
            administrator.
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ minHeight: 46, marginTop: 4 }}
            disabled={
              isBusy ||
              !name.trim() ||
              !email.trim() ||
              !password ||
              !passwordConfirmation
            }
          >
            {isBusy ? "Membuat akun..." : "Daftar Sekarang"}
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
            Sudah punya akun?{" "}
            <Link
              to="/login"
              style={{ fontWeight: 700 }}
            >
              Masuk di sini
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

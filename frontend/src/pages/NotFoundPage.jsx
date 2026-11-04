
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function NotFoundPage() {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const isAuthenticated = Boolean(user && !isLoading);
  const destination = isAuthenticated ? "/dashboard" : "/login";

  return (
    <main
      className="auth-layout"
      style={{ textAlign: "center" }}
    >
      <section
        className="auth-card"
        aria-labelledby="not-found-title"
      >
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: 76,
            height: 76,
            margin: "0 auto 24px",
            borderRadius: 20,
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          MP
        </div>

        <p
          style={{
            marginBottom: 8,
            color: "var(--color-primary)",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
          }}
        >
          ERROR 404
        </p>

        <h1
          id="not-found-title"
          className="auth-title"
        >
          Halaman tidak ditemukan
        </h1>

        <p className="auth-description">
          Halaman yang lu cari tidak tersedia, mungkin alamatnya
          salah atau halaman tersebut sudah dipindahkan.
        </p>

        {location.pathname && (
          <div
            className="alert"
            style={{
              marginBottom: 24,
              overflowWrap: "anywhere",
              textAlign: "left",
            }}
          >
            <strong>Alamat yang diakses:</strong>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: "monospace",
              }}
            >
              {location.pathname}
            </p>
          </div>
        )}

        <div className="form">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              replace="true"
              className="btn btn-primary w-full"
            >
              Kembali ke Dashboard
            </Link>
          ) : isLoading ? (
            <div
              className="loading-state"
              role="status"
              aria-live="polite"
            >
              Memeriksa sesi pengguna...
            </div>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary w-full"
            >
              Masuk ke MotoPartsPro
            </Link>
          )}

          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => window.history.back()}
          >
            Kembali ke Halaman Sebelumnya
          </button>

          {!isAuthenticated && !isLoading && (
            <Link
              to="/register"
              style={{
                display: "inline-block",
                marginTop: 6,
                fontWeight: 650,
              }}
            >
              Belum punya akun? Daftar
            </Link>
          )}
        </div>

        <p
          className="text-muted"
          style={{
            marginTop: 28,
            marginBottom: 0,
            fontSize: 12,
          }}
        >
          MotoPartsPro · Sistem Informasi Manajemen Suku Cadang
        </p>
      </section>
    </main>
  );
}

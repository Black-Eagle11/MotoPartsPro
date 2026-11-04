
import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

const ROLE_LABELS = {
  admin: "Administrator",
  staff: "Staff",
  member: "Member",
};

const BASE_NAVIGATION = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "▦",
    roles: ["admin", "staff", "member"],
  },
  {
    label: "Produk",
    path: "/products",
    icon: "▤",
    roles: ["admin", "staff", "member"],
  },
  {
    label: "Kategori",
    path: "/categories",
    icon: "▧",
    roles: ["admin", "staff", "member"],
  },
  {
    label: "Keranjang",
    path: "/cart",
    icon: "🛒",
    roles: ["member"],
  },
  {
    label: "Checkout",
    path: "/checkout",
    icon: "✓",
    roles: ["member"],
  },
  {
    label: "Pesanan",
    path: "/orders",
    icon: "▣",
    roles: ["admin", "staff", "member"],
  },
  {
    label: "Inventori",
    path: "/inventory",
    icon: "▥",
    roles: ["admin", "staff"],
  },
  {
    label: "Manajemen Pengguna",
    path: "/users",
    icon: "♙",
    roles: ["admin"],
  },
];

function getInitials(name) {
  if (typeof name !== "string" || !name.trim()) {
    return "MP";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function NavigationLink({
  item,
  cartCount,
  onNavigate,
}) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/dashboard"}
      onClick={onNavigate}
      className={({ isActive }) =>
        isActive ? "active" : ""
      }
      aria-label={
        item.path === "/cart" && cartCount > 0
          ? `${item.label}, ${cartCount} item`
          : item.label
      }
    >
      <span
        aria-hidden="true"
        className="app-nav-icon"
      >
        {item.icon}
      </span>

      <span>{item.label}</span>

      {item.path === "/cart" && cartCount > 0 && (
        <span
          className="badge badge-primary"
          aria-label={`${cartCount} item dalam keranjang`}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { itemCount, isCartReady } = useCart();

  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const role = user?.role;

  const navigationItems = BASE_NAVIGATION.filter((item) =>
    item.roles.includes(role),
  );

  const pageTitle =
    navigationItems.find((item) => {
      if (item.path === "/dashboard") {
        return location.pathname === item.path;
      }

      return (
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)
      );
    })?.label ?? "MotoPartsPro";

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutError("");

    try {
      const result = await logout();

      // AuthContext membersihkan token lokal meskipun
      // endpoint logout server gagal dihubungi.
      navigate("/login", {
        replace: true,
        state: {
          logoutMessage: result?.message ?? "Sesi telah diakhiri.",
          logoutSuccess: result?.success ?? false,
        },
      });
    } catch {
      setLogoutError(
        "Terjadi kendala saat logout. Silakan coba kembali.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <aside
        className="app-sidebar"
        aria-label="Sidebar aplikasi"
      >
        <Link
          to="/dashboard"
          className="app-brand"
          aria-label="MotoPartsPro, Dashboard"
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 10,
              background: "#ffffff",
              color: "#172554",
              fontWeight: 900,
            }}
          >
            MP
          </span>

          <span>
            <span style={{ display: "block" }}>
              MotoPartsPro
            </span>

            <span
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 400,
                opacity: 0.8,
              }}
            >
              Management System
            </span>
          </span>
        </Link>

        <div
          style={{
            margin: "0 12px 10px",
            color: "#bfdbfe",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Menu Utama
        </div>

        <nav aria-label="Navigasi utama">
          {navigationItems.map((item) => (
            <NavigationLink
              key={item.path}
              item={item}
              cartCount={isCartReady ? itemCount : 0}
            />
          ))}
        </nav>

        <div
          style={{
            marginTop: "auto",
            padding: "24px 12px 0",
            color: "#bfdbfe",
            fontSize: 12,
          }}
        >
          <div
            style={{
              borderTop: "1px solid rgb(255 255 255 / 15%)",
              paddingTop: 16,
            }}
          >
            Sistem Informasi Inventori
            <br />
            dan Penjualan Suku Cadang
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div style={{ minWidth: 0 }}>
            <p
              className="text-muted"
              style={{
                marginBottom: 2,
                fontSize: 12,
              }}
            >
              MotoPartsPro / Workspace
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 750,
              }}
            >
              {pageTitle}
            </h1>
          </div>

          <div
            className="flex items-center gap-3"
            style={{
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              className="flex items-center gap-2"
              style={{ minWidth: 0 }}
            >
              <div
                aria-hidden="true"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  fontWeight: 800,
                }}
              >
                {getInitials(user?.name)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    maxWidth: 220,
                    overflow: "hidden",
                    color: "var(--color-text)",
                    fontWeight: 700,
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.name ?? "Pengguna"}
                </div>

                <div
                  className="text-muted"
                  style={{ fontSize: 12 }}
                >
                  {ROLE_LABELS[role] ?? "Pengguna"}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Keluar dari akun MotoPartsPro"
            >
              {isLoggingOut ? "Keluar..." : "Logout"}
            </button>
          </div>
        </header>

        {logoutError && (
          <div
            className="alert alert-error"
            role="alert"
            style={{ margin: 16 }}
          >
            {logoutError}
          </div>
        )}

        <main
          id="main-content"
          className="app-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>

        <footer
          style={{
            padding: "16px 28px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-muted)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} MotoPartsPro
          {" — "}
          Sistem Informasi Manajemen Suku Cadang Motor
        </footer>
      </div>
    </div>
  );
}

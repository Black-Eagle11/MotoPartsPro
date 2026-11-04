
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const CURRENCY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("id-ID");

const STATUS_LABELS = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

function formatCurrency(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Rp0";
  }

  return CURRENCY_FORMATTER.format(amount);
}

function formatNumber(value) {
  const number = Number(value ?? 0);

  return NUMBER_FORMATTER.format(
    Number.isFinite(number) ? number : 0,
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClass(status) {
  switch (status) {
    case "completed":
    case "confirmed":
      return "badge badge-success";

    case "cancelled":
      return "badge badge-danger";

    case "processing":
    case "shipped":
      return "badge badge-primary";

    case "pending":
      return "badge badge-warning";

    default:
      return "badge";
  }
}

function StatCard({
  label,
  value,
  description,
  tone = "primary",
}) {
  const toneColors = {
    primary: "#1d4ed8",
    success: "#15803d",
    warning: "#a16207",
    danger: "#b91c1c",
    neutral: "#344054",
  };

  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>

      <p
        className="stat-value"
        style={{
          color: toneColors[tone] ?? toneColors.primary,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </p>

      {description && (
        <p className="stat-caption">
          {description}
        </p>
      )}
    </article>
  );
}

function StatusSummary({ counts }) {
  const entries = Object.entries(STATUS_LABELS);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
        gap: 12,
      }}
    >
      {entries.map(([status, label]) => (
        <div
          key={status}
          style={{
            padding: 14,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p
            className="text-muted"
            style={{
              marginBottom: 6,
              fontSize: 12,
            }}
          >
            {label}
          </p>

          <p
            style={{
              marginBottom: 0,
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {formatNumber(counts?.[status] ?? 0)}
          </p>
        </div>
      ))}
    </div>
  );
}

function QuickLink({ to, title, description }) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        display: "block",
        color: "var(--color-text)",
        transition: "border-color 150ms ease",
      }}
    >
      <h3 style={{ marginBottom: 8 }}>
        {title}
      </h3>

      <p
        className="text-muted"
        style={{ marginBottom: 0, fontSize: 13 }}
      >
        {description}
      </p>
    </Link>
  );
}

function RecentOrders({ orders, isMember }) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ marginBottom: 0 }}>
          Belum ada pesanan untuk ditampilkan.
        </p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <caption className="sr-only">
          Daftar pesanan terbaru
        </caption>

        <thead>
          <tr>
            <th scope="col">Nomor Pesanan</th>

            {!isMember && (
              <th scope="col">Pelanggan</th>
            )}

            <th scope="col">Tanggal</th>
            <th scope="col">Total</th>
            <th scope="col">Status</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <span style={{ fontWeight: 700 }}>
                  {order.order_number ?? `#${order.id}`}
                </span>
              </td>

              {!isMember && (
                <td>
                  <div>
                    {order.customer?.name ?? "Pengguna"}
                  </div>

                  {order.customer?.email && (
                    <div
                      className="text-muted"
                      style={{ fontSize: 12 }}
                    >
                      {order.customer.email}
                    </div>
                  )}
                </td>
              )}

              <td>
                {formatDate(
                  order.placed_at ?? order.created_at,
                )}
              </td>

              <td>
                {formatCurrency(order.total_amount)}
              </td>

              <td>
                <span className={getStatusClass(order.status)}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const controllerRef = useRef(null);

  const role = user?.role;
  const isMember = role === "member";
  const isAdmin = role === "admin";

  const loadDashboard = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/dashboard", {
        signal,
      });

      const payload = response.data?.data;

      if (!payload || typeof payload !== "object") {
        throw new Error(
          "Format data dashboard dari server tidak valid.",
        );
      }

      if (!signal?.aborted) {
        setDashboard(payload);
      }
    } catch (requestError) {
      if (signal?.aborted) {
        return;
      }

      const responseMessage =
        requestError?.response?.data?.message;

      setError(
        typeof responseMessage === "string"
          ? responseMessage
          : requestError?.message ??
              "Dashboard gagal dimuat. Periksa koneksi API.",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    controllerRef.current = controller;

    void loadDashboard(controller.signal);

    return () => {
      controller.abort();

      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [loadDashboard]);

  function handleRefresh() {
    controllerRef.current?.abort();

    const controller = new AbortController();

    controllerRef.current = controller;

    void loadDashboard(controller.signal);
  }

  const catalog = dashboard?.catalog ?? {};
  const inventory = dashboard?.inventory ?? {};
  const ordersData = dashboard?.orders ?? {};
  const sales = dashboard?.sales ?? {};
  const payments = dashboard?.payments ?? {};
  const userStats = dashboard?.users ?? {};
  const recentOrders = dashboard?.recent_orders ?? [];

  let stats = [];

  if (isMember) {
    stats = [
      {
        label: "Produk Tersedia",
        value: formatNumber(catalog.active_products),
        description: "Produk aktif di katalog",
        tone: "primary",
      },
      {
        label: "Kategori Aktif",
        value: formatNumber(catalog.active_categories),
        description: "Kategori yang tersedia",
        tone: "neutral",
      },
      {
        label: "Total Pesanan",
        value: formatNumber(ordersData.total),
        description: "Seluruh pesanan akun ini",
        tone: "success",
      },
      {
        label: "Faktur Lunas",
        value: formatNumber(payments.paid_invoices),
        description: "Faktur berstatus lunas",
        tone: "primary",
      },
    ];
  } else {
    stats = [
      {
        label: "Total Produk",
        value: formatNumber(catalog.products_total),
        description: "Semua data produk",
        tone: "primary",
      },
      {
        label: "Produk Aktif",
        value: formatNumber(catalog.active_products),
        description: "Produk yang dijual",
        tone: "success",
      },
      {
        label: "Stok Menipis",
        value: formatNumber(inventory.low_stock),
        description: "Stok mencapai batas minimum",
        tone: "warning",
      },
      {
        label: "Stok Habis",
        value: formatNumber(inventory.out_of_stock),
        description: "Produk tanpa persediaan",
        tone: "danger",
      },
      {
        label: "Total Pesanan",
        value: formatNumber(ordersData.total),
        description: "Semua pesanan tercatat",
        tone: "primary",
      },
      {
        label: "Pendapatan Lunas",
        value: formatCurrency(sales.paid_revenue),
        description: `${formatNumber(sales.paid_invoices)} faktur berstatus lunas`,
        tone: "success",
      },
    ];

    if (isAdmin) {
      stats.push({
        label: "Total Pengguna",
        value: formatNumber(userStats.total),
        description: `${formatNumber(userStats.active)} akun aktif`,
        tone: "neutral",
      });
    }
  }

  return (
    <section aria-labelledby="dashboard-title">
      <header className="page-header">
        <div>
          <p
            className="text-muted"
            style={{ marginBottom: 5 }}
          >
            Ringkasan aktivitas
          </p>

          <h1
            id="dashboard-title"
            className="page-title"
          >
            Dashboard
          </h1>

          <p className="page-description">
            Halo, {user?.name ?? "Pengguna"}.
            {" "}
            {isMember
              ? "Pantau katalog dan pesanan lu di sini."
              : "Pantau kondisi inventori dan aktivitas operasional di sini."}
          </p>

          <div style={{ marginTop: 10 }}>
            <span className="badge badge-primary">
              {isAdmin
                ? "Administrator"
                : role === "staff"
                  ? "Staff"
                  : "Member"}
            </span>
          </div>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Memuat..." : "Muat Ulang"}
          </button>

          {isMember ? (
            <Link
              to="/products"
              className="btn btn-primary"
            >
              Lihat Produk
            </Link>
          ) : (
            <Link
              to="/products"
              className="btn btn-primary"
            >
              Kelola Produk
            </Link>
          )}
        </div>
      </header>

      {error && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginBottom: 22 }}
        >
          <p style={{ marginBottom: 12 }}>
            {error}
          </p>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {isLoading && !dashboard ? (
        <div
          className="loading-state"
          role="status"
          aria-live="polite"
        >
          Memuat data dashboard dari server...
        </div>
      ) : (
        <>
          <div className="stat-grid">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                {...stat}
              />
            ))}
          </div>

          {!isMember && (
            <section
              className="card"
              style={{ marginBottom: 24 }}
              aria-labelledby="inventory-summary-title"
            >
              <div className="card-header">
                <div>
                  <h2
                    id="inventory-summary-title"
                    className="card-title"
                  >
                    Ringkasan Inventori
                  </h2>

                  <p
                    className="text-muted"
                    style={{
                      marginTop: 6,
                      marginBottom: 0,
                      fontSize: 13,
                    }}
                  >
                    Pantau ketersediaan barang dan stok minimum.
                  </p>
                </div>

                <Link
                  to="/inventory"
                  className="btn btn-secondary"
                >
                  Buka Inventori
                </Link>
              </div>

              <div className="grid grid-2">
                <div className="alert alert-warning">
                  <strong>Perlu diperiksa</strong>

                  <p style={{ margin: "6px 0 0" }}>
                    {formatNumber(inventory.low_stock)}
                    {" "}
                    produk berada pada atau di bawah stok minimum.
                  </p>
                </div>

                <div className="alert alert-error">
                  <strong>Stok habis</strong>

                  <p style={{ margin: "6px 0 0" }}>
                    {formatNumber(inventory.out_of_stock)}
                    {" "}
                    produk aktif tidak memiliki persediaan.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section
            className="card"
            style={{ marginBottom: 24 }}
            aria-labelledby="orders-summary-title"
          >
            <div className="card-header">
              <div>
                <h2
                  id="orders-summary-title"
                  className="card-title"
                >
                  Ringkasan Status Pesanan
                </h2>

                <p
                  className="text-muted"
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                    fontSize: 13,
                  }}
                >
                  Distribusi status berdasarkan data backend.
                </p>
              </div>

              <Link
                to="/orders"
                className="btn btn-secondary"
              >
                Lihat Pesanan
              </Link>
            </div>

            <StatusSummary
              counts={ordersData.by_status}
            />
          </section>

          <section
            className="card"
            style={{ marginBottom: 24 }}
            aria-labelledby="recent-orders-title"
          >
            <div className="card-header">
              <div>
                <h2
                  id="recent-orders-title"
                  className="card-title"
                >
                  Pesanan Terbaru
                </h2>

                <p
                  className="text-muted"
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                    fontSize: 13,
                  }}
                >
                  {isMember
                    ? "Riwayat pesanan terbaru akun lu."
                    : "Aktivitas pesanan terbaru dari sistem."}
                </p>
              </div>

              <Link
                to="/orders"
                className="btn btn-secondary"
              >
                Semua Pesanan
              </Link>
            </div>

            {isLoading && dashboard && (
              <p
                className="text-muted"
                role="status"
                aria-live="polite"
              >
                Memperbarui data...
              </p>
            )}

            <RecentOrders
              orders={recentOrders}
              isMember={isMember}
            />
          </section>

          <section aria-labelledby="quick-links-title">
            <header className="card-header">
              <h2
                id="quick-links-title"
                className="card-title"
              >
                Akses Cepat
              </h2>
            </header>

            <div className="grid grid-3">
              <QuickLink
                to="/products"
                title="Katalog Produk"
                description="Cari suku cadang dan lihat informasi produk."
              />

              <QuickLink
                to="/orders"
                title="Manajemen Pesanan"
                description="Lihat status dan riwayat pesanan."
              />

              {isMember ? (
                <QuickLink
                  to="/cart"
                  title="Keranjang"
                  description="Tinjau produk sebelum melakukan checkout."
                />
              ) : (
                <QuickLink
                  to="/inventory"
                  title="Inventori"
                  description="Periksa pergerakan stok dan lakukan penyesuaian."
                />
              )}

              {isAdmin && (
                <QuickLink
                  to="/users"
                  title="Manajemen Pengguna"
                  description="Kelola akun dan hak akses Admin, Staff, dan Member."
                />
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

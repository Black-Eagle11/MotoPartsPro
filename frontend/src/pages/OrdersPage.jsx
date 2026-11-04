
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination from "../components/Pagination";

const ORDER_STATUSES = [
  { value: "pending", label: "Menunggu Konfirmasi" },
  { value: "confirmed", label: "Dikonfirmasi" },
  { value: "processing", label: "Diproses" },
  { value: "shipped", label: "Dikirim" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

const STATUS_LABELS = Object.fromEntries(
  ORDER_STATUSES.map((status) => [
    status.value,
    status.label,
  ]),
);

const NEXT_STATUS = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "completed",
};

const NEXT_ACTION_LABELS = {
  confirmed: "Konfirmasi",
  processing: "Mulai Proses",
  shipped: "Tandai Dikirim",
  completed: "Selesaikan",
};

const INITIAL_FILTERS = {
  search: "",
  status: "",
  date_from: "",
  date_to: "",
  sort: "created_at",
  direction: "desc",
};

function getErrorMessage(error, fallback) {
  const response = error?.response?.data;

  if (response?.errors && typeof response.errors === "object") {
    for (const messages of Object.values(response.errors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        return messages[0];
      }
    }
  }

  return typeof response?.message === "string"
    ? response.message
    : fallback;
}

function formatRupiah(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value) {
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
  }).format(date);
}

function formatNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? new Intl.NumberFormat("id-ID").format(number)
    : "—";
}

function getStatusBadge(status) {
  switch (status) {
    case "completed":
      return "badge badge-success";

    case "cancelled":
      return "badge badge-danger";

    case "processing":
    case "shipped":
      return "badge badge-warning";

    case "confirmed":
      return "badge badge-info";

    case "pending":
      return "badge";

    default:
      return "badge";
  }
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function getInvoice(order) {
  return order?.invoice &&
    typeof order.invoice === "object"
    ? order.invoice
    : null;
}

function canCancelStatus(status) {
  return ["pending", "confirmed"].includes(status);
}

export default function OrdersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canProcessOrders = isAdmin || isStaff;

  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState(null);

  const [filtersDraft, setFiltersDraft] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [busyOrderId, setBusyOrderId] = useState(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const detailRequestId = useRef(0);

  const loadOrders = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    const params = {
      per_page: 10,
      page,
      sort: filters.sort,
      direction: filters.direction,
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.status) {
      params.status = filters.status;
    }

    if (filters.date_from) {
      params.date_from = filters.date_from;
    }

    if (filters.date_to) {
      params.date_to = filters.date_to;
    }

    try {
      const response = await apiClient.get("/orders", {
        params,
        signal,
      });

      if (signal.aborted) {
        return;
      }

      setOrders(
        Array.isArray(response.data?.data)
          ? response.data.data
          : [],
      );

      setMeta(response.data?.meta ?? null);
    } catch (requestError) {
      if (signal.aborted) {
        return;
      }

      setError(
        getErrorMessage(
          requestError,
          "Pesanan gagal dimuat. Periksa koneksi API.",
        ),
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();

    void loadOrders(controller.signal);

    return () => controller.abort();
  }, [loadOrders, refreshKey]);

  /*
   * Menampilkan informasi sukses sesudah checkout.
   * State navigasi dibersihkan setelah dikonsumsi.
   */
  useEffect(() => {
    if (!location.state?.checkoutSuccess) {
      return;
    }

    setNotice({
      type: "success",
      message:
        location.state.message ??
        (
          location.state.orderNumber
            ? `Pesanan ${location.state.orderNumber} berhasil dibuat.`
            : "Pesanan berhasil dibuat."
        ),
    });

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.state, navigate]);

  function handleApplyFilters(event) {
    event.preventDefault();

    if (
      filtersDraft.date_from &&
      filtersDraft.date_to &&
      filtersDraft.date_from > filtersDraft.date_to
    ) {
      setError(
        "Tanggal awal tidak boleh melebihi tanggal akhir.",
      );
      return;
    }

    setError("");
    setNotice(null);
    setPage(1);

    setFilters({
      ...filtersDraft,
      search: filtersDraft.search.trim(),
    });
  }

  function handleResetFilters() {
    setFiltersDraft({ ...INITIAL_FILTERS });
    setFilters({ ...INITIAL_FILTERS });
    setPage(1);
    setError("");
    setNotice(null);
  }

  async function handleOpenDetails(order) {
    const requestId = ++detailRequestId.current;

    setSelectedOrder(order);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setDetailError("");

    try {
      const response = await apiClient.get(
        `/orders/${order.id}`,
      );

      if (requestId !== detailRequestId.current) {
        return;
      }

      const detailedOrder =
        response.data?.data ??
        response.data?.order ??
        null;

      if (detailedOrder) {
        setSelectedOrder(detailedOrder);
      }
    } catch (requestError) {
      if (requestId !== detailRequestId.current) {
        return;
      }

      setDetailError(
        getErrorMessage(
          requestError,
          "Detail pesanan gagal dimuat.",
        ),
      );
    } finally {
      if (requestId === detailRequestId.current) {
        setIsDetailLoading(false);
      }
    }
  }

  function handleCloseDetails() {
    detailRequestId.current += 1;
    setIsDetailOpen(false);
    setSelectedOrder(null);
    setDetailError("");
    setIsDetailLoading(false);
  }

  async function handleAdvanceStatus(order) {
    if (
      !canProcessOrders ||
      busyOrderId !== null
    ) {
      return;
    }

    const nextStatus = NEXT_STATUS[order.status];

    if (!nextStatus) {
      return;
    }

    const actionLabel = NEXT_ACTION_LABELS[nextStatus] ?? "Perbarui Status";

    const confirmed = window.confirm(
      `${actionLabel} pesanan ${order.order_number ?? `#${order.id}`}?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyOrderId(order.id);
    setNotice(null);
    setError("");

    try {
      await apiClient.patch(
        `/orders/${order.id}/status`,
        { status: nextStatus },
      );

      setNotice({
        type: "success",
        message: `Status pesanan ${order.order_number ?? `#${order.id}`} berhasil diperbarui.`,
      });

      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          requestError,
          "Status pesanan gagal diperbarui.",
        ),
      });
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleCancelOrder(order) {
    if (busyOrderId !== null) {
      return;
    }

    if (!canCancelStatus(order.status)) {
      return;
    }

    const confirmed = window.confirm(
      `Batalkan pesanan ${order.order_number ?? `#${order.id}`}?\n\nPembatalan hanya diizinkan untuk status yang memenuhi aturan backend.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyOrderId(order.id);
    setNotice(null);
    setError("");

    try {
      await apiClient.patch(
        `/orders/${order.id}/cancel`,
        {},
      );

      setNotice({
        type: "success",
        message: `Pesanan ${order.order_number ?? `#${order.id}`} berhasil dibatalkan.`,
      });

      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          requestError,
          "Pesanan tidak dapat dibatalkan.",
        ),
      });
    } finally {
      setBusyOrderId(null);
    }
  }

  const columns = [
    {
      key: "order_number",
      label: "Nomor Pesanan",
      render: (value, order) => (
        <div>
          <strong>{value || `#${order.id}`}</strong>
          <div
            className="text-muted"
            style={{ fontSize: 12 }}
          >
            {formatDateTime(order.placed_at ?? order.created_at)}
          </div>
        </div>
      ),
    },
    ...(canProcessOrders ? [{
      key: "user",
      label: "Pelanggan",
      render: (value, order) => (
        value?.name ?? order.user?.name ?? "—"
      ),
    }] : []),
    {
      key: "items",
      label: "Jumlah Item",
      render: (value, order) => {
        const items = getOrderItems(order);

        if (items.length > 0) {
          return items.reduce(
            (total, item) =>
              total + Number(item.quantity ?? 0),
            0,
          ).toLocaleString("id-ID");
        }

        return formatNumber(order.items_count ?? 0);
      },
    },
    {
      key: "total",
      label: "Total Pesanan",
      render: (value, order) => (
        <strong>{formatRupiah(order.total ?? value)}</strong>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value) => (
        <span className={getStatusBadge(value)}>
          {STATUS_LABELS[value] ?? value ?? "—"}
        </span>
      ),
    },
    {
      key: "invoice",
      label: "Status Invoice",
      render: (value, order) => {
        const invoice = getInvoice(order);

        if (!invoice) {
          return "—";
        }

        return (
          <span
            className={
              invoice.status === "paid"
                ? "badge badge-success"
                : "badge"
            }
          >
            {invoice.status === "paid"
              ? "Lunas"
              : invoice.status === "void"
                ? "Dibatalkan"
                : "Belum Lunas"}
          </span>
        );
      },
    },
  ];

  const rowActions = (order) => {
    const nextStatus = NEXT_STATUS[order.status];
    const showCancel = canCancelStatus(order.status);
    const isBusy = busyOrderId === order.id;

    return (
      <div className="table-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleOpenDetails(order)}
        >
          Detail
        </button>

        {canProcessOrders && nextStatus && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyOrderId !== null}
            onClick={() => handleAdvanceStatus(order)}
          >
            {isBusy
              ? "Memproses..."
              : NEXT_ACTION_LABELS[nextStatus]}
          </button>
        )}

        {showCancel && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busyOrderId !== null}
            onClick={() => handleCancelOrder(order)}
          >
            {isBusy ? "Memproses..." : "Batalkan"}
          </button>
        )}
      </div>
    );
  };

  const detailItems = getOrderItems(selectedOrder);
  const detailInvoice = getInvoice(selectedOrder);

  return (
    <section aria-labelledby="orders-title">
      <header className="page-header">
        <div>
          <h1 id="orders-title" className="page-title">
            {canProcessOrders
              ? "Manajemen Pesanan"
              : "Pesanan Saya"}
          </h1>

          <p className="page-description">
            {canProcessOrders
              ? "Pantau transaksi pelanggan dan proses pesanan sesuai alur status."
              : "Lihat status pembelian, detail barang, dan informasi invoice."}
          </p>
        </div>
      </header>

      {notice && (
        <div
          className={
            notice.type === "error"
              ? "alert alert-error"
              : "alert alert-success"
          }
          role={notice.type === "error" ? "alert" : "status"}
          style={{ marginBottom: 20 }}
        >
          {notice.message}
        </div>
      )}

      <section
        className="card"
        style={{ marginBottom: 24 }}
      >
        <form
          className="form"
          onSubmit={handleApplyFilters}
          aria-label="Filter pesanan"
        >
          <div className="grid grid-3">
            <div className="field">
              <label
                className="field-label"
                htmlFor="orders-search"
              >
                Cari Pesanan
              </label>

              <input
                id="orders-search"
                type="search"
                className="form-control"
                placeholder="Nomor pesanan..."
                maxLength={120}
                value={filtersDraft.search}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    search: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="orders-status"
              >
                Status
              </label>

              <select
                id="orders-status"
                className="form-control"
                value={filtersDraft.status}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">Semua Status</option>

                {ORDER_STATUSES.map((status) => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="orders-sort"
              >
                Urutkan
              </label>

              <select
                id="orders-sort"
                className="form-control"
                value={filtersDraft.sort}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    sort: event.target.value,
                  }))
                }
              >
                <option value="created_at">Tanggal Dibuat</option>
                <option value="placed_at">Tanggal Pesanan</option>
                <option value="total">Total</option>
                <option value="status">Status</option>
                <option value="id">ID</option>
              </select>
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="orders-date-from"
              >
                Dari Tanggal
              </label>

              <input
                id="orders-date-from"
                type="date"
                className="form-control"
                value={filtersDraft.date_from}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    date_from: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="orders-date-to"
              >
                Sampai Tanggal
              </label>

              <input
                id="orders-date-to"
                type="date"
                className="form-control"
                value={filtersDraft.date_to}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    date_to: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="orders-direction"
              >
                Urutan
              </label>

              <select
                id="orders-direction"
                className="form-control"
                value={filtersDraft.direction}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    direction: event.target.value,
                  }))
                }
              >
                <option value="desc">Terbaru / Terbesar</option>
                <option value="asc">Terlama / Terkecil</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Terapkan Filter
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetFilters}
            >
              Reset Filter
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          <p style={{ marginBottom: 12 }}>{error}</p>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Coba Lagi
          </button>
        </div>
      )}

      <section className="card">
        <DataTable
          caption="Daftar pesanan MotoPartsPro"
          columns={columns}
          data={orders}
          isLoading={isLoading}
          error={null}
          emptyMessage="Tidak ada pesanan yang cocok dengan filter."
          actions={rowActions}
        />

        <Pagination
          meta={meta}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </section>

      <FormModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetails}
        title={
          selectedOrder?.order_number
            ? `Detail ${selectedOrder.order_number}`
            : "Detail Pesanan"
        }
        description="Informasi pesanan dan snapshot barang yang tercatat saat transaksi dibuat."
        size="lg"
        closeOnBackdrop={!isDetailLoading}
        closeOnEscape={!isDetailLoading}
        showCloseButton
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCloseDetails}
          >
            Tutup
          </button>
        }
      >
        {detailError && (
          <div className="alert alert-error" role="alert">
            {detailError}
          </div>
        )}

        {isDetailLoading ? (
          <div className="loading-state" role="status">
            Memuat detail pesanan...
          </div>
        ) : selectedOrder ? (
          <div className="form">
            <div className="grid grid-2">
              <div>
                <span className="text-muted">Nomor Pesanan</span>
                <p>
                  <strong>
                    {selectedOrder.order_number ?? `#${selectedOrder.id}`}
                  </strong>
                </p>
              </div>

              <div>
                <span className="text-muted">Tanggal Pesanan</span>
                <p>
                  <strong>
                    {formatDateTime(
                      selectedOrder.placed_at ??
                      selectedOrder.created_at,
                    )}
                  </strong>
                </p>
              </div>

              {canProcessOrders && (
                <div>
                  <span className="text-muted">Pelanggan</span>
                  <p>
                    <strong>
                      {selectedOrder.user?.name ?? "—"}
                    </strong>
                  </p>
                  <p className="text-muted">
                    {selectedOrder.user?.email ?? ""}
                  </p>
                </div>
              )}

              <div>
                <span className="text-muted">Status Pesanan</span>
                <p>
                  <span
                    className={getStatusBadge(selectedOrder.status)}
                  >
                    {STATUS_LABELS[selectedOrder.status] ??
                      selectedOrder.status}
                  </span>
                </p>
              </div>
            </div>

            <div className="divider" />

            <h3>Alamat Pengiriman</h3>

            <p>
              <strong>
                {selectedOrder.shipping_name ?? "—"}
              </strong>
            </p>

            <p>
              {selectedOrder.shipping_phone ?? "—"}
            </p>

            <p>
              {selectedOrder.shipping_address ?? "—"}
            </p>

            <p>
              {[
                selectedOrder.shipping_city,
                selectedOrder.shipping_province,
                selectedOrder.shipping_postal_code,
              ].filter(Boolean).join(", ") || "—"}
            </p>

            {selectedOrder.notes && (
              <p>
                <span className="text-muted">Catatan: </span>
                {selectedOrder.notes}
              </p>
            )}

            <div className="divider" />

            <h3>Item Pesanan</h3>

            {detailItems.length === 0 ? (
              <p className="text-muted">
                Detail item tidak tersedia pada respons API ini.
              </p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Produk</th>
                      <th scope="col">Jumlah</th>
                      <th scope="col">Harga Satuan</th>
                      <th scope="col">Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detailItems.map((item, index) => (
                      <tr key={item.id ?? `${item.product_id}-${index}`}>
                        <td>
                          <strong>
                            {item.product_name ??
                              item.product?.name ??
                              "Produk"}
                          </strong>

                          {(item.product_sku ?? item.sku) && (
                            <div
                              className="text-muted"
                              style={{ fontSize: 12 }}
                            >
                              SKU: {item.product_sku ?? item.sku}
                            </div>
                          )}
                        </td>

                        <td>{formatNumber(item.quantity)}</td>
                        <td>{formatRupiah(item.unit_price)}</td>
                        <td>
                          {formatRupiah(
                            item.line_total ??
                            Number(item.unit_price ?? 0) *
                              Number(item.quantity ?? 0),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="divider" />

            <h3>Rincian Pembayaran</h3>

            <div className="flex items-center justify-between gap-2">
              <span>Subtotal</span>
              <strong>
                {formatRupiah(selectedOrder.subtotal)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>Diskon</span>
              <strong>
                {formatRupiah(selectedOrder.discount ?? 0)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>Ongkos Kirim</span>
              <strong>
                {formatRupiah(selectedOrder.shipping ?? 0)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>Pajak</span>
              <strong>
                {formatRupiah(selectedOrder.tax ?? 0)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>Total</span>
              <strong>
                {formatRupiah(selectedOrder.total)}
              </strong>
            </div>

            {detailInvoice && (
              <>
                <div className="divider" />

                <h3>Invoice</h3>

                <div className="flex items-center justify-between gap-2">
                  <span>Nomor Invoice</span>
                  <strong>
                    {detailInvoice.invoice_number ?? "—"}
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span>Status</span>
                  <span
                    className={
                      detailInvoice.status === "paid"
                        ? "badge badge-success"
                        : "badge"
                    }
                  >
                    {detailInvoice.status === "paid"
                      ? "Lunas"
                      : detailInvoice.status === "void"
                        ? "Dibatalkan"
                        : "Belum Lunas"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span>Tanggal Terbit</span>
                  <strong>
                    {formatDate(detailInvoice.issued_at)}
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span>Jatuh Tempo</span>
                  <strong>
                    {formatDate(detailInvoice.due_at)}
                  </strong>
                </div>
              </>
            )}
          </div>
        ) : (
          <p>Detail pesanan belum tersedia.</p>
        )}
      </FormModal>
    </section>
  );
}

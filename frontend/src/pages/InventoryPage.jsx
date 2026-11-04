
import { useCallback, useEffect, useState } from "react";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination from "../components/Pagination";

const INITIAL_FILTERS = {
  product_id: "",
  movement_type: "",
  sort: "created_at",
  direction: "desc",
};

const INITIAL_FORM = {
  product_id: "",
  movement_type: "stock_in",
  quantity: "1",
  unit_cost: "",
  notes: "",
};

const MOVEMENT_TYPES = [
  { value: "stock_in", label: "Barang Masuk" },
  { value: "stock_out", label: "Barang Keluar" },
  { value: "adjustment_in", label: "Penyesuaian Stok Masuk" },
  { value: "adjustment_out", label: "Penyesuaian Stok Keluar" },
  { value: "sale", label: "Penjualan" },
  { value: "return", label: "Retur" },
];

const MANUAL_MOVEMENT_TYPES = new Set([
  "stock_in",
  "stock_out",
  "adjustment_in",
  "adjustment_out",
]);

const MOVEMENT_LABELS = Object.fromEntries(
  MOVEMENT_TYPES.map((item) => [
    item.value,
    item.label,
  ]),
);

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

function getFieldError(errors, field) {
  const value = errors?.[field];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function formatNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? new Intl.NumberFormat("id-ID").format(number)
    : "—";
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
    maximumFractionDigits: 2,
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

function getMovementBadge(type) {
  if (["stock_in", "adjustment_in", "return"].includes(type)) {
    return "badge badge-success";
  }

  if (["stock_out", "adjustment_out", "sale"].includes(type)) {
    return "badge badge-warning";
  }

  return "badge";
}

export default function InventoryPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const canManageInventory = isAdmin || user?.role === "staff";

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);

  const [filtersDraft, setFiltersDraft] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [error, setError] = useState("");
  const [productsError, setProductsError] = useState("");
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");

  const loadProducts = useCallback(async (signal) => {
    if (!canManageInventory) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    setIsLoadingProducts(true);
    setProductsError("");

    try {
      const response = await apiClient.get("/products", {
        params: {
          per_page: 100,
          page: 1,
          sort: "name",
          direction: "asc",
        },
        signal,
      });

      if (signal.aborted) {
        return;
      }

      setProducts(
        Array.isArray(response.data?.data)
          ? response.data.data
          : [],
      );
    } catch (requestError) {
      if (signal.aborted) {
        return;
      }

      setProductsError(
        getErrorMessage(
          requestError,
          "Daftar produk gagal dimuat.",
        ),
      );
    } finally {
      if (!signal.aborted) {
        setIsLoadingProducts(false);
      }
    }
  }, [canManageInventory]);

  const loadMovements = useCallback(async (signal) => {
    if (!canManageInventory) {
      setMovements([]);
      setMeta(null);
      setError("Akses inventori hanya tersedia untuk Admin dan Staff.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const params = {
      per_page: 15,
      page,
      sort: filters.sort,
      direction: filters.direction,
    };

    if (filters.product_id) {
      params.product_id = filters.product_id;
    }

    if (filters.movement_type) {
      params.movement_type = filters.movement_type;
    }

    try {
      const response = await apiClient.get("/inventory/movements", {
        params,
        signal,
      });

      if (signal.aborted) {
        return;
      }

      setMovements(
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
          "Riwayat pergerakan stok gagal dimuat.",
        ),
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [canManageInventory, filters, page]);

  useEffect(() => {
    const controller = new AbortController();

    void loadProducts(controller.signal);

    return () => controller.abort();
  }, [loadProducts, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();

    void loadMovements(controller.signal);

    return () => controller.abort();
  }, [loadMovements, refreshKey]);

  function handleApplyFilters(event) {
    event.preventDefault();

    setPage(1);
    setFilters({ ...filtersDraft });
    setNotice(null);
  }

  function handleResetFilters() {
    setFiltersDraft({ ...INITIAL_FILTERS });
    setFilters({ ...INITIAL_FILTERS });
    setPage(1);
    setNotice(null);
  }

  function handleOpenAdjustment() {
    if (!canManageInventory) {
      return;
    }

    setForm({ ...INITIAL_FORM });
    setFormErrors({});
    setFormError("");
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setFormErrors({});
    setFormError("");
  }

  async function handleSubmitAdjustment(event) {
    event.preventDefault();

    if (!canManageInventory || isSaving) {
      return;
    }

    setFormErrors({});
    setFormError("");
    setNotice(null);

    const quantity = Number(form.quantity);
    const selectedType = form.movement_type;
    const notes = form.notes.trim();

    if (!form.product_id) {
      setFormError("Pilih produk terlebih dahulu.");
      return;
    }

    if (
      !MANUAL_MOVEMENT_TYPES.has(selectedType)
    ) {
      setFormError("Jenis pergerakan ini tidak dapat dibuat secara manual.");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000000
    ) {
      setFormError("Jumlah harus berupa bilangan bulat antara 1 dan 1.000.000.");
      return;
    }

    if (
      ["adjustment_in", "adjustment_out"].includes(selectedType) &&
      !notes
    ) {
      setFormError("Catatan wajib diisi untuk penyesuaian stok.");
      return;
    }

    if (
      isAdmin &&
      form.unit_cost !== "" &&
      (
        !Number.isFinite(Number(form.unit_cost)) ||
        Number(form.unit_cost) < 0
      )
    ) {
      setFormError("Harga modal harus berupa angka nol atau lebih.");
      return;
    }

    const payload = {
      product_id: Number(form.product_id),
      movement_type: selectedType,
      quantity,
      notes: notes || null,
    };

    // Harga modal hanya dikirim oleh Admin.
    if (isAdmin && form.unit_cost !== "") {
      payload.unit_cost = form.unit_cost;
    }

    setIsSaving(true);

    try {
      await apiClient.post("/inventory/adjustments", payload);

      setIsModalOpen(false);
      setForm({ ...INITIAL_FORM });
      setPage(1);

      setNotice({
        type: "success",
        message: "Pergerakan stok berhasil dicatat.",
      });

      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setFormErrors(
        requestError?.response?.data?.errors ?? {},
      );

      setFormError(
        getErrorMessage(
          requestError,
          "Penyesuaian stok gagal. Periksa stok terkini dan data yang dikirim.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const selectedProduct = products.find(
    (product) => String(product.id) === String(form.product_id),
  );

  const columns = [
    {
      key: "created_at",
      label: "Waktu",
      render: (value) => formatDateTime(value),
    },
    {
      key: "product",
      label: "Produk",
      render: (value, movement) => {
        const product = value ?? movement.product;

        return (
          <div>
            <strong>{product?.name ?? "Produk tidak tersedia"}</strong>

            {product?.sku && (
              <div
                className="text-muted"
                style={{ fontSize: 12 }}
              >
                SKU: {product.sku}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "movement_type",
      label: "Jenis Pergerakan",
      render: (value) => (
        <span className={getMovementBadge(value)}>
          {MOVEMENT_LABELS[value] ?? value ?? "—"}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Jumlah",
      render: (value, movement) => {
        const inbound = [
          "stock_in",
          "adjustment_in",
          "return",
        ].includes(movement.movement_type);

        return (
          <strong>
            {inbound ? "+" : ["stock_out", "adjustment_out", "sale"].includes(
              movement.movement_type,
            ) ? "−" : ""}
            {formatNumber(value)}
          </strong>
        );
      },
    },
    {
      key: "quantity_before",
      label: "Stok Sebelum",
      render: (value) => formatNumber(value),
    },
    {
      key: "quantity_after",
      label: "Stok Sesudah",
      render: (value) => formatNumber(value),
    },
    {
      key: "user",
      label: "Dilakukan Oleh",
      render: (value, movement) => (
        value?.name ?? movement.user?.name ?? "Pengguna tidak tersedia"
      ),
    },
    {
      key: "order",
      label: "Nomor Pesanan",
      render: (value, movement) => (
        value?.order_number ??
        movement.order?.order_number ??
        "—"
      ),
    },
    ...(isAdmin ? [{
      key: "unit_cost",
      label: "Harga Modal",
      render: (value) => formatRupiah(value),
    }] : []),
    {
      key: "notes",
      label: "Catatan",
      render: (value) => value || "—",
    },
  ];

  if (!canManageInventory) {
    return (
      <section className="card">
        <h1 className="page-title">Akses Inventori Ditolak</h1>
        <p>
          Halaman inventori hanya tersedia bagi Admin dan Staff yang aktif.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="inventory-title">
      <header className="page-header">
        <div>
          <h1 id="inventory-title" className="page-title">
            Manajemen Inventori
          </h1>

          <p className="page-description">
            Pantau stok produk, rekam barang masuk dan keluar, serta telusuri riwayat perubahan inventori.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAdjustment}
            disabled={isLoadingProducts || Boolean(productsError)}
          >
            + Catat Pergerakan Stok
          </button>
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

      {productsError && (
        <div className="alert alert-error" role="alert">
          {productsError}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: 12 }}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Muat Ulang Produk
          </button>
        </div>
      )}

      <section className="card">
        <form
          className="toolbar"
          onSubmit={handleApplyFilters}
          aria-label="Filter riwayat inventori"
        >
          <div className="field">
            <label
              className="sr-only"
              htmlFor="inventory-product-filter"
            >
              Filter produk
            </label>

            <select
              id="inventory-product-filter"
              className="form-control"
              value={filtersDraft.product_id}
              onChange={(event) =>
                setFiltersDraft((previous) => ({
                  ...previous,
                  product_id: event.target.value,
                }))
              }
              disabled={isLoadingProducts}
            >
              <option value="">Semua Produk</option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.sku} — {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label
              className="sr-only"
              htmlFor="inventory-type-filter"
            >
              Filter jenis pergerakan
            </label>

            <select
              id="inventory-type-filter"
              className="form-control"
              value={filtersDraft.movement_type}
              onChange={(event) =>
                setFiltersDraft((previous) => ({
                  ...previous,
                  movement_type: event.target.value,
                }))
              }
            >
              <option value="">Semua Jenis Pergerakan</option>

              {MOVEMENT_TYPES.map((movement) => (
                <option
                  key={movement.value}
                  value={movement.value}
                >
                  {movement.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label
              className="sr-only"
              htmlFor="inventory-sort"
            >
              Urutkan riwayat
            </label>

            <select
              id="inventory-sort"
              className="form-control"
              value={filtersDraft.sort}
              onChange={(event) =>
                setFiltersDraft((previous) => ({
                  ...previous,
                  sort: event.target.value,
                }))
              }
            >
              <option value="created_at">Waktu</option>
              <option value="id">ID</option>
              <option value="quantity">Jumlah</option>
              <option value="movement_type">Jenis Pergerakan</option>
            </select>
          </div>

          <div className="field">
            <label
              className="sr-only"
              htmlFor="inventory-direction"
            >
              Arah urutan
            </label>

            <select
              id="inventory-direction"
              className="form-control"
              value={filtersDraft.direction}
              onChange={(event) =>
                setFiltersDraft((previous) => ({
                  ...previous,
                  direction: event.target.value,
                }))
              }
            >
              <option value="desc">Terbaru dahulu</option>
              <option value="asc">Terlama dahulu</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">
            Terapkan
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetFilters}
          >
            Reset
          </button>
        </form>

        {error && (
          <div
            className="alert alert-error"
            role="alert"
            style={{ marginBottom: 18 }}
          >
            <p style={{ marginBottom: 12 }}>
              {error}
            </p>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              Coba Lagi
            </button>
          </div>
        )}

        <DataTable
          caption="Riwayat pergerakan stok MotoPartsPro"
          columns={columns}
          data={movements}
          isLoading={isLoading}
          error={null}
          emptyMessage="Belum ada riwayat pergerakan stok untuk filter ini."
        />

        <Pagination
          meta={meta}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </section>

      <FormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Catat Pergerakan Stok"
        description="Setiap perubahan direkam sebagai riwayat inventori. Stok tidak diedit langsung dari formulir ini."
        closeOnBackdrop={!isSaving}
        closeOnEscape={!isSaving}
        showCloseButton={!isSaving}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCloseModal}
              disabled={isSaving}
            >
              Batal
            </button>

            <button
              type="submit"
              form="inventory-adjustment-form"
              className="btn btn-primary"
              disabled={isSaving || isLoadingProducts || products.length === 0}
            >
              {isSaving ? "Menyimpan..." : "Simpan Pergerakan"}
            </button>
          </>
        }
      >
        <form
          id="inventory-adjustment-form"
          className="form"
          onSubmit={handleSubmitAdjustment}
          noValidate
        >
          {formError && (
            <div className="alert alert-error" role="alert">
              {formError}
            </div>
          )}

          <div className="field">
            <label
              htmlFor="inventory-product"
              className="field-label"
            >
              Produk *
            </label>

            <select
              id="inventory-product"
              className="form-control"
              value={form.product_id}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  product_id: event.target.value,
                }))
              }
              required
              disabled={isSaving || isLoadingProducts}
            >
              <option value="">Pilih Produk</option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.sku} — {product.name}
                </option>
              ))}
            </select>

            {selectedProduct && (
              <p className="field-help">
                Stok saat ini: <strong>{formatNumber(selectedProduct.stock)}</strong>
              </p>
            )}

            {getFieldError(formErrors, "product_id") && (
              <span className="field-error">
                {getFieldError(formErrors, "product_id")}
              </span>
            )}
          </div>

          <div className="field">
            <label
              htmlFor="inventory-movement-type"
              className="field-label"
            >
              Jenis Pergerakan *
            </label>

            <select
              id="inventory-movement-type"
              className="form-control"
              value={form.movement_type}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  movement_type: event.target.value,
                }))
              }
              required
              disabled={isSaving}
            >
              {MOVEMENT_TYPES
                .filter((item) =>
                  MANUAL_MOVEMENT_TYPES.has(item.value)
                )
                .map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
            </select>

            <p className="field-help">
              Penjualan dan retur dicatat melalui alur transaksi yang sesuai, bukan dibuat dari formulir manual ini.
            </p>

            {getFieldError(formErrors, "movement_type") && (
              <span className="field-error">
                {getFieldError(formErrors, "movement_type")}
              </span>
            )}
          </div>

          <div className="field">
            <label
              htmlFor="inventory-quantity"
              className="field-label"
            >
              Jumlah *
            </label>

            <input
              id="inventory-quantity"
              type="number"
              className="form-control"
              min="1"
              max="1000000"
              step="1"
              inputMode="numeric"
              value={form.quantity}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  quantity: event.target.value,
                }))
              }
              required
              disabled={isSaving}
            />

            {getFieldError(formErrors, "quantity") && (
              <span className="field-error">
                {getFieldError(formErrors, "quantity")}
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="field">
              <label
                htmlFor="inventory-unit-cost"
                className="field-label"
              >
                Harga Modal per Unit (Rp)
              </label>

              <input
                id="inventory-unit-cost"
                type="number"
                className="form-control"
                min="0"
                max="9999999999.99"
                step="0.01"
                inputMode="decimal"
                value={form.unit_cost}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    unit_cost: event.target.value,
                  }))
                }
                disabled={isSaving}
              />

              {getFieldError(formErrors, "unit_cost") && (
                <span className="field-error">
                  {getFieldError(formErrors, "unit_cost")}
                </span>
              )}
            </div>
          )}

          <div className="field">
            <label
              htmlFor="inventory-notes"
              className="field-label"
            >
              Catatan
              {["adjustment_in", "adjustment_out"].includes(
                form.movement_type,
              ) ? " *" : ""}
            </label>

            <textarea
              id="inventory-notes"
              className="form-control"
              value={form.notes}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              maxLength={2000}
              rows={4}
              required={["adjustment_in", "adjustment_out"].includes(
                form.movement_type,
              )}
              disabled={isSaving}
              placeholder="Alasan penyesuaian, referensi, atau keterangan lain..."
            />

            {getFieldError(formErrors, "notes") && (
              <span className="field-error">
                {getFieldError(formErrors, "notes")}
              </span>
            )}
          </div>
        </form>
      </FormModal>
    </section>
  );
}

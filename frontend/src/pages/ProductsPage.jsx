
import { useCallback, useEffect, useState } from "react";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination from "../components/Pagination";
import ProductCard from "../components/ProductCard";

const INITIAL_FILTERS = {
  search: "",
  category_id: "",
  brand: "",
  min_price: "",
  max_price: "",
  in_stock: "all",
  is_active: "all",
  sort: "name",
  direction: "asc",
};

const INITIAL_FORM = {
  category_id: "",
  sku: "",
  name: "",
  slug: "",
  brand: "",
  description: "",
  price: "",
  cost_price: "",
  min_stock: "5",
  is_active: true,
  image: null,
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

function getFieldError(errors, field) {
  const value = errors?.[field];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatRupiah(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildPayload(form, isAdmin) {
  const payload = {
    category_id: Number(form.category_id),
    sku: form.sku.trim(),
    name: form.name.trim(),
    slug: slugify(form.slug),
    brand: form.brand.trim() || null,
    description: form.description.trim() || null,
    price: form.price,
    min_stock: Number(form.min_stock),
    is_active: Boolean(form.is_active),
  };

  if (isAdmin) {
    payload.cost_price =
      form.cost_price === "" ? null : form.cost_price;
  }

  return payload;
}

function buildFormData(payload, image) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (key === "is_active") {
      formData.append(key, value ? "1" : "0");
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    } else {
      formData.append(key, "");
    }
  }

  if (image instanceof File) {
    formData.append("image", image);
  }

  return formData;
}

export default function ProductsPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const isMember = user?.role === "member";
  const canManageProducts = isAdmin || isStaff;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState(null);

  const [filtersDraft, setFiltersDraft] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");

  /*
   * Ambil kategori untuk filter dan form produk.
   * API menyesuaikan visibilitas kategori menurut role.
   */
  const loadCategories = useCallback(async (signal) => {
    setCategoriesError("");

    try {
      const response = await apiClient.get("/categories", {
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

      setCategories(
        Array.isArray(response.data?.data)
          ? response.data.data
          : [],
      );
    } catch (requestError) {
      if (signal.aborted) {
        return;
      }

      setCategoriesError(
        getErrorMessage(
          requestError,
          "Gagal memuat kategori.",
        ),
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadCategories(controller.signal);

    return () => controller.abort();
  }, [loadCategories, refreshKey]);

  /*
   * Ambil produk berdasarkan filter yang diterapkan.
   */
  const loadProducts = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    const params = {
      per_page: 12,
      page,
      sort: filters.sort,
      direction: filters.direction,
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.category_id) {
      params.category_id = filters.category_id;
    }

    if (filters.brand) {
      params.brand = filters.brand;
    }

    if (filters.min_price !== "") {
      params.min_price = filters.min_price;
    }

    if (filters.max_price !== "") {
      params.max_price = filters.max_price;
    }

    if (filters.in_stock !== "all") {
      params.in_stock = filters.in_stock === "yes" ? "1" : "0";
    }

    if (
      canManageProducts &&
      filters.is_active !== "all"
    ) {
      params.is_active = filters.is_active === "active" ? "1" : "0";
    }

    try {
      const response = await apiClient.get("/products", {
        params,
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

      setMeta(response.data?.meta ?? null);
    } catch (requestError) {
      if (signal.aborted) {
        return;
      }

      setError(
        getErrorMessage(
          requestError,
          "Gagal memuat produk. Periksa koneksi API.",
        ),
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, page, canManageProducts]);

  useEffect(() => {
    const controller = new AbortController();

    void loadProducts(controller.signal);

    return () => controller.abort();
  }, [loadProducts, refreshKey]);

  function handleApplyFilters(event) {
    event.preventDefault();

    const minPrice = filtersDraft.min_price.trim();
    const maxPrice = filtersDraft.max_price.trim();

    if (
      minPrice !== "" &&
      maxPrice !== "" &&
      Number(minPrice) > Number(maxPrice)
    ) {
      setError(
        "Harga minimum tidak boleh lebih besar daripada harga maksimum.",
      );
      return;
    }

    setError("");
    setPage(1);

    setFilters({
      ...filtersDraft,
      search: filtersDraft.search.trim(),
      brand: filtersDraft.brand.trim(),
    });

    setNotice(null);
  }

  function handleResetFilters() {
    setFiltersDraft(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
    setPage(1);
    setError("");
    setNotice(null);
  }

  function handleCreate() {
    if (!canManageProducts) {
      return;
    }

    setEditingProduct(null);
    setForm({ ...INITIAL_FORM });
    setFormErrors({});
    setFormError("");
    setIsModalOpen(true);
  }

  function handleEdit(product) {
    if (!canManageProducts) {
      return;
    }

    setEditingProduct(product);

    setForm({
      category_id: String(product.category_id ?? ""),
      sku: product.sku ?? "",
      name: product.name ?? "",
      slug: product.slug ?? "",
      brand: product.brand ?? "",
      description: product.description ?? "",
      price: String(product.price ?? ""),
      cost_price:
        isAdmin && product.cost_price != null
          ? String(product.cost_price)
          : "",
      min_stock: String(product.min_stock ?? 5),
      is_active: Boolean(product.is_active),
      image: null,
    });

    setFormErrors({});
    setFormError("");
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingProduct(null);
    setFormErrors({});
    setFormError("");
  }

  function handleNameChange(value) {
    setForm((previous) => {
      const previousSlug = slugify(previous.name);

      const shouldGenerateSlug =
        previous.slug === "" ||
        previous.slug === previousSlug;

      return {
        ...previous,
        name: value,
        slug: shouldGenerateSlug
          ? slugify(value)
          : previous.slug,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageProducts || isSaving) {
      return;
    }

    setFormErrors({});
    setFormError("");
    setNotice(null);

    const payload = buildPayload(form, isAdmin);

    setIsSaving(true);

    try {
      let response;

      if (editingProduct) {
        if (form.image instanceof File) {
          // PHP tidak selalu mem-parsing multipart PATCH.
          // Method spoofing _method=PATCH dipakai agar Laravel
          // menerima FormData beserta file upload.
          const formData = buildFormData(payload, form.image);

          formData.append("_method", "PATCH");

          response = await apiClient.post(
            `/products/${editingProduct.id}`,
            formData,
          );
        } else {
          response = await apiClient.patch(
            `/products/${editingProduct.id}`,
            payload,
          );
        }

        setNotice({
          type: "success",
          message: "Produk berhasil diperbarui.",
        });
      } else {
        if (form.image instanceof File) {
          const formData = buildFormData(payload, form.image);

          response = await apiClient.post(
            "/products",
            formData,
          );
        } else {
          response = await apiClient.post(
            "/products",
            payload,
          );
        }

        setNotice({
          type: "success",
          message: "Produk berhasil ditambahkan.",
        });
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      setForm({ ...INITIAL_FORM });
      setPage(1);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setFormErrors(
        requestError?.response?.data?.errors ?? {},
      );

      setFormError(
        getErrorMessage(
          requestError,
          "Produk gagal disimpan.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus produk "${product.name}"?\n\nProduk yang memiliki riwayat pesanan atau pergerakan stok tidak dapat dihapus.`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice(null);

    try {
      await apiClient.delete(`/products/${product.id}`);

      setNotice({
        type: "success",
        message: "Produk berhasil dihapus.",
      });

      if (products.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        setRefreshKey((value) => value + 1);
      }
    } catch (requestError) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          requestError,
          "Produk gagal dihapus.",
        ),
      });
    }
  }

  const columns = [
    {
      key: "image_url",
      label: "Gambar",
      render: (value, product) => (
        value ? (
          <img
            src={value}
            alt={product.name}
            loading="lazy"
            style={{
              width: 58,
              height: 48,
              objectFit: "contain",
              borderRadius: 6,
              background: "#f2f4f7",
            }}
          />
        ) : (
          <span className="text-muted">—</span>
        )
      ),
    },
    {
      key: "sku",
      label: "SKU",
      render: (value) => (
        <code>{value}</code>
      ),
    },
    {
      key: "name",
      label: "Produk",
      render: (value, product) => (
        <div>
          <strong>{value}</strong>

          {product.brand && (
            <div
              className="text-muted"
              style={{ fontSize: 12 }}
            >
              {product.brand}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "category_id",
      label: "Kategori",
      render: (value, product) => (
        product.category?.name ?? `Kategori #${value}`
      ),
    },
    {
      key: "price",
      label: "Harga Jual",
      render: (value) => formatRupiah(value),
    },
    ...(canManageProducts ? [{
      key: "cost_price",
      label: "Harga Modal",
      render: (value) => (
        value == null ? "—" : formatRupiah(value)
      ),
    }] : []),
    {
      key: "stock",
      label: "Stok",
      render: (value, product) => (
        <div>
          <strong>{Number(value ?? 0).toLocaleString("id-ID")}</strong>

          {product.is_low_stock && (
            <div>
              <span className="badge badge-warning">
                Stok Menipis
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (value) => (
        <span
          className={
            value
              ? "badge badge-success"
              : "badge badge-danger"
          }
        >
          {value ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="products-title">
      <header className="page-header">
        <div>
          <h1
            id="products-title"
            className="page-title"
          >
            {isMember ? "Katalog Suku Cadang" : "Manajemen Produk"}
          </h1>

          <p className="page-description">
            {isMember
              ? "Cari suku cadang motor, periksa ketersediaan, dan tambahkan produk ke keranjang."
              : "Kelola produk, harga, kategori, gambar, dan informasi stok suku cadang."}
          </p>
        </div>

        {canManageProducts && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
            >
              + Tambah Produk
            </button>
          </div>
        )}
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

      {categoriesError && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          {categoriesError}
        </div>
      )}

      <section
        className="card"
        style={{ marginBottom: 24 }}
      >
        <form
          className="form"
          onSubmit={handleApplyFilters}
          aria-label="Pencarian dan filter produk"
        >
          <div className="grid grid-3">
            <div className="field">
              <label
                className="field-label"
                htmlFor="product-search"
              >
                Pencarian
              </label>

              <input
                id="product-search"
                type="search"
                className="form-control"
                placeholder="Nama, SKU, atau merek..."
                value={filtersDraft.search}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    search: event.target.value,
                  }))
                }
                maxLength={120}
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-category-filter"
              >
                Kategori
              </label>

              <select
                id="product-category-filter"
                className="form-control"
                value={filtersDraft.category_id}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    category_id: event.target.value,
                  }))
                }
              >
                <option value="">Semua Kategori</option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-brand-filter"
              >
                Merek
              </label>

              <input
                id="product-brand-filter"
                className="form-control"
                value={filtersDraft.brand}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    brand: event.target.value,
                  }))
                }
                placeholder="Contoh: Honda"
                maxLength={120}
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-min-price"
              >
                Harga Minimum
              </label>

              <input
                id="product-min-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="form-control"
                value={filtersDraft.min_price}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    min_price: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-max-price"
              >
                Harga Maksimum
              </label>

              <input
                id="product-max-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="form-control"
                value={filtersDraft.max_price}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    max_price: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-stock-filter"
              >
                Ketersediaan
              </label>

              <select
                id="product-stock-filter"
                className="form-control"
                value={filtersDraft.in_stock}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    in_stock: event.target.value,
                  }))
                }
              >
                <option value="all">Semua Stok</option>
                <option value="yes">Ada Stok</option>
                <option value="no">Stok Habis</option>
              </select>
            </div>

            {canManageProducts && (
              <div className="field">
                <label
                  className="field-label"
                  htmlFor="product-status-filter"
                >
                  Status Produk
                </label>

                <select
                  id="product-status-filter"
                  className="form-control"
                  value={filtersDraft.is_active}
                  onChange={(event) =>
                    setFiltersDraft((previous) => ({
                      ...previous,
                      is_active: event.target.value,
                    }))
                  }
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Tidak Aktif</option>
                </select>
              </div>
            )}

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-sort"
              >
                Urutkan
              </label>

              <select
                id="product-sort"
                className="form-control"
                value={filtersDraft.sort}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    sort: event.target.value,
                  }))
                }
              >
                <option value="name">Nama</option>
                <option value="price">Harga</option>
                <option value="stock">Stok</option>
                <option value="sku">SKU</option>
                <option value="created_at">Tanggal Dibuat</option>
                <option value="id">ID</option>
              </select>
            </div>

            <div className="field">
              <label
                className="field-label"
                htmlFor="product-sort-direction"
              >
                Urutan
              </label>

              <select
                id="product-sort-direction"
                className="form-control"
                value={filtersDraft.direction}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    direction: event.target.value,
                  }))
                }
              >
                <option value="asc">Naik</option>
                <option value="desc">Turun</option>
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

      {isMember ? (
        <section aria-label="Katalog produk">
          {isLoading && products.length === 0 ? (
            <div
              className="loading-state"
              role="status"
              aria-live="polite"
            >
              Memuat katalog produk...
            </div>
          ) : products.length === 0 && !isLoading ? (
            <div className="card empty-state">
              <h2>Tidak ada produk ditemukan</h2>
              <p>Coba ubah kata pencarian atau filter yang digunakan.</p>
            </div>
          ) : (
            <>
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
              </div>

              {isLoading && (
                <p
                  className="text-muted"
                  role="status"
                  aria-live="polite"
                  style={{ marginTop: 14 }}
                >
                  Memperbarui katalog...
                </p>
              )}
            </>
          )}

          <Pagination
            meta={meta}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </section>
      ) : (
        <section className="card">
          <DataTable
            caption="Data produk MotoPartsPro"
            columns={columns}
            data={products}
            isLoading={isLoading}
            error={null}
            emptyMessage="Tidak ada produk yang cocok dengan filter."
            actions={
              canManageProducts
                ? (product) => (
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleEdit(product)}
                      >
                        Edit
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDelete(product)}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  )
                : null
            }
          />

          <Pagination
            meta={meta}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </section>
      )}

      <FormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? "Edit Produk" : "Tambah Produk"}
        description={
          editingProduct
            ? "Perbarui informasi produk. Perubahan stok harus dilakukan melalui modul inventori."
            : "Masukkan data suku cadang baru ke dalam katalog."
        }
        size="lg"
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
              form="product-form"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? "Menyimpan..." : "Simpan Produk"}
            </button>
          </>
        }
      >
        <form
          id="product-form"
          className="form"
          onSubmit={handleSubmit}
          noValidate
        >
          {formError && (
            <div
              className="alert alert-error"
              role="alert"
            >
              {formError}
            </div>
          )}

          {[
            {
              key: "category_id",
              label: "Kategori",
              type: "select",
              required: true,
            },
            {
              key: "sku",
              label: "SKU",
              required: true,
              maxLength: 64,
            },
            {
              key: "name",
              label: "Nama Produk",
              required: true,
              maxLength: 180,
            },
            {
              key: "slug",
              label: "Slug",
              required: true,
              maxLength: 200,
            },
            {
              key: "brand",
              label: "Merek",
              maxLength: 120,
            },
          ].map((field) => (
            <div className="field" key={field.key}>
              <label
                className="field-label"
                htmlFor={`product-${field.key}`}
              >
                {field.label}
                {field.required ? " *" : ""}
              </label>

              {field.type === "select" ? (
                <select
                  id={`product-${field.key}`}
                  className="form-control"
                  value={form.category_id}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      category_id: event.target.value,
                    }))
                  }
                  required={field.required}
                  disabled={isSaving}
                  aria-invalid={Boolean(
                    getFieldError(formErrors, field.key),
                  )}
                >
                  <option value="">Pilih Kategori</option>

                  {categories
                    .filter((category) => category.is_active)
                    .map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  id={`product-${field.key}`}
                  className="form-control"
                  value={form[field.key]}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (field.key === "name") {
                      handleNameChange(value);
                    } else {
                      setForm((previous) => ({
                        ...previous,
                        [field.key]: value,
                      }));
                    }
                  }}
                  maxLength={field.maxLength}
                  required={field.required}
                  disabled={isSaving}
                  aria-invalid={Boolean(
                    getFieldError(formErrors, field.key),
                  )}
                />
              )}

              {getFieldError(formErrors, field.key) && (
                <span className="field-error">
                  {getFieldError(formErrors, field.key)}
                </span>
              )}
            </div>
          ))}

          <div className="field">
            <label
              className="field-label"
              htmlFor="product-description"
            >
              Deskripsi
            </label>

            <textarea
              id="product-description"
              className="form-control"
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              maxLength={5000}
              rows={4}
              disabled={isSaving}
            />

            {getFieldError(formErrors, "description") && (
              <span className="field-error">
                {getFieldError(formErrors, "description")}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="field">
              <label
                className="field-label"
                htmlFor="product-price"
              >
                Harga Jual (Rp) *
              </label>

              <input
                id="product-price"
                type="number"
                className="form-control"
                min="0"
                max="9999999999.99"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    price: event.target.value,
                  }))
                }
                required
                disabled={isSaving}
              />

              {getFieldError(formErrors, "price") && (
                <span className="field-error">
                  {getFieldError(formErrors, "price")}
                </span>
              )}
            </div>

            {isAdmin && (
              <div className="field">
                <label
                  className="field-label"
                  htmlFor="product-cost-price"
                >
                  Harga Modal (Rp)
                </label>

                <input
                  id="product-cost-price"
                  type="number"
                  className="form-control"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  inputMode="decimal"
                  value={form.cost_price}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      cost_price: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />

                {getFieldError(formErrors, "cost_price") && (
                  <span className="field-error">
                    {getFieldError(formErrors, "cost_price")}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label
              className="field-label"
              htmlFor="product-min-stock"
            >
              Batas Minimum Stok *
            </label>

            <input
              id="product-min-stock"
              type="number"
              className="form-control"
              min="0"
              max="1000000"
              step="1"
              value={form.min_stock}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  min_stock: event.target.value,
                }))
              }
              required
              disabled={isSaving}
            />

            {getFieldError(formErrors, "min_stock") && (
              <span className="field-error">
                {getFieldError(formErrors, "min_stock")}
              </span>
            )}
          </div>

          <div className="field">
            <label
              className="field-label"
              htmlFor="product-image"
            >
              Gambar Produk
            </label>

            <input
              id="product-image"
              type="file"
              className="form-control"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  image: event.target.files?.[0] ?? null,
                }))
              }
              disabled={isSaving}
            />

            <p className="field-help">
              Format JPG, PNG, atau WebP. Maksimal 2 MB.
              {editingProduct?.image_url
                ? " Upload gambar baru untuk mengganti gambar saat ini."
                : ""}
            </p>

            {getFieldError(formErrors, "image") && (
              <span className="field-error">
                {getFieldError(formErrors, "image")}
              </span>
            )}
          </div>

          <label
            className="flex items-center gap-2"
            htmlFor="product-active"
          >
            <input
              id="product-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  is_active: event.target.checked,
                }))
              }
              disabled={isSaving}
            />

            Produk aktif
          </label>

          {getFieldError(formErrors, "is_active") && (
            <span className="field-error">
              {getFieldError(formErrors, "is_active")}
            </span>
          )}
        </form>
      </FormModal>
    </section>
  );
}

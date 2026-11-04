
import { useCallback, useEffect, useState } from "react";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination from "../components/Pagination";

const INITIAL_FORM = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
};

function getErrorMessage(error, fallback) {
  const response = error?.response?.data;

  if (response?.errors && typeof response.errors === "object") {
    const firstMessages = Object.values(response.errors);

    for (const messages of firstMessages) {
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

export default function CategoriesPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const canFilterStatus = ["admin", "staff"].includes(user?.role);

  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState(null);

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState("asc");
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");

  const loadCategories = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    const params = {
      search: search || undefined,
      sort,
      direction,
      per_page: 10,
      page,
    };

    if (
      canFilterStatus &&
      activeFilter !== "all"
    ) {
      params.is_active = activeFilter === "active" ? "1" : "0";
    }

    try {
      const response = await apiClient.get("/categories", {
        params,
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

      setMeta(response.data?.meta ?? null);
    } catch (requestError) {
      if (signal.aborted) {
        return;
      }

      setError(
        getErrorMessage(
          requestError,
          "Gagal memuat kategori. Periksa koneksi API.",
        ),
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    search,
    activeFilter,
    sort,
    direction,
    page,
    canFilterStatus,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    void loadCategories(controller.signal);

    return () => controller.abort();
  }, [loadCategories, refreshKey]);

  function handleSearch(event) {
    event.preventDefault();

    setPage(1);
    setSearch(searchDraft.trim());
    setNotice(null);
  }

  function handleCreate() {
    setEditingCategory(null);
    setForm({ ...INITIAL_FORM });
    setFormErrors({});
    setFormError("");
    setIsModalOpen(true);
  }

  function handleEdit(category) {
    setEditingCategory(category);

    setForm({
      name: category.name ?? "",
      slug: category.slug ?? "",
      description: category.description ?? "",
      is_active: Boolean(category.is_active),
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
    setEditingCategory(null);
    setFormErrors({});
    setFormError("");
  }

  function handleNameChange(value) {
    setForm((previous) => {
      const previousGeneratedSlug = slugify(previous.name);

      const shouldUpdateSlug =
        previous.slug === "" ||
        previous.slug === previousGeneratedSlug;

      return {
        ...previous,
        name: value,
        slug: shouldUpdateSlug
          ? slugify(value)
          : previous.slug,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isAdmin || isSaving) {
      return;
    }

    setFormErrors({});
    setFormError("");
    setNotice(null);

    const payload = {
      name: form.name.trim(),
      slug: slugify(form.slug),
      description: form.description.trim() || null,
      is_active: Boolean(form.is_active),
    };

    setIsSaving(true);

    try {
      if (editingCategory) {
        await apiClient.patch(
          `/categories/${editingCategory.id}`,
          payload,
        );

        setNotice({
          type: "success",
          message: "Kategori berhasil diperbarui.",
        });
      } else {
        await apiClient.post("/categories", payload);

        setNotice({
          type: "success",
          message: "Kategori berhasil ditambahkan.",
        });
      }

      setIsModalOpen(false);
      setEditingCategory(null);
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
          "Kategori gagal disimpan.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(category) {
    if (!isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus kategori "${category.name}"?\n\nKategori yang masih mempunyai produk tidak bisa dihapus.`,
    );

    if (!confirmed) {
      return;
    }

    setNotice(null);
    setError("");

    try {
      await apiClient.delete(`/categories/${category.id}`);

      setNotice({
        type: "success",
        message: "Kategori berhasil dihapus.",
      });

      // Jika item terakhir di halaman dihapus, mundur satu halaman.
      if (categories.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        setRefreshKey((value) => value + 1);
      }
    } catch (requestError) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          requestError,
          "Kategori gagal dihapus.",
        ),
      });
    }
  }

  const columns = [
    {
      key: "name",
      label: "Nama Kategori",
      render: (value) => (
        <strong>{value}</strong>
      ),
    },
    {
      key: "slug",
      label: "Slug",
      render: (value) => (
        <code>{value}</code>
      ),
    },
    {
      key: "description",
      label: "Deskripsi",
      render: (value) => value || "—",
    },
    {
      key: "products_count",
      label: "Jumlah Produk",
      render: (value) => Number(value ?? 0).toLocaleString("id-ID"),
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
    {
      key: "created_at",
      label: "Dibuat",
      render: (value) => formatDate(value),
    },
  ];

  return (
    <section aria-labelledby="categories-title">
      <header className="page-header">
        <div>
          <h1
            id="categories-title"
            className="page-title"
          >
            Manajemen Kategori
          </h1>

          <p className="page-description">
            Kelola kategori suku cadang motor dan pantau
            jumlah produk di setiap kategori.
          </p>
        </div>

        {isAdmin && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
            >
              + Tambah Kategori
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

      <section className="card">
        <form
          className="toolbar"
          onSubmit={handleSearch}
          aria-label="Filter kategori"
        >
          <div className="toolbar-search">
            <label
              htmlFor="category-search"
              className="sr-only"
            >
              Cari kategori
            </label>

            <input
              id="category-search"
              type="search"
              className="form-control"
              placeholder="Cari nama atau slug..."
              value={searchDraft}
              onChange={(event) =>
                setSearchDraft(event.target.value)
              }
              maxLength={100}
            />
          </div>

          {canFilterStatus && (
            <div className="field">
              <label
                htmlFor="category-status"
                className="sr-only"
              >
                Filter status
              </label>

              <select
                id="category-status"
                className="form-control"
                value={activeFilter}
                onChange={(event) => {
                  setPage(1);
                  setActiveFilter(event.target.value);
                }}
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          )}

          <div className="field">
            <label
              htmlFor="category-sort"
              className="sr-only"
            >
              Urutkan kategori
            </label>

            <select
              id="category-sort"
              className="form-control"
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value);
              }}
            >
              <option value="name">Nama</option>
              <option value="created_at">Tanggal Dibuat</option>
              <option value="id">ID</option>
              <option value="slug">Slug</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
          >
            Cari
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearchDraft("");
              setSearch("");
              setActiveFilter("all");
              setSort("name");
              setDirection("asc");
              setPage(1);
            }}
          >
            Reset
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDirection(
              (value) => value === "asc" ? "desc" : "asc",
            )}
            aria-label={`Arah urutan saat ini ${direction}`}
          >
            {direction === "asc" ? "A–Z ↑" : "Z–A ↓"}
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
          caption="Daftar kategori MotoPartsPro"
          columns={columns}
          data={categories}
          isLoading={isLoading}
          error={null}
          emptyMessage="Belum ada kategori yang cocok."
          actions={
            isAdmin
              ? (category) => (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleEdit(category)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleDelete(category)}
                    >
                      Hapus
                    </button>
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

      <FormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={
          editingCategory
            ? "Edit Kategori"
            : "Tambah Kategori"
        }
        description={
          editingCategory
            ? "Perbarui informasi kategori."
            : "Masukkan informasi kategori suku cadang baru."
        }
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
              form="category-form"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? "Menyimpan..." : "Simpan Kategori"}
            </button>
          </>
        }
      >
        <form
          id="category-form"
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

          <div className="field">
            <label
              className="field-label"
              htmlFor="category-name"
            >
              Nama Kategori *
            </label>

            <input
              id="category-name"
              className="form-control"
              value={form.name}
              onChange={(event) =>
                handleNameChange(event.target.value)
              }
              maxLength={120}
              required
              disabled={isSaving}
              aria-invalid={Boolean(
                getFieldError(formErrors, "name"),
              )}
            />

            {getFieldError(formErrors, "name") && (
              <span className="field-error">
                {getFieldError(formErrors, "name")}
              </span>
            )}
          </div>

          <div className="field">
            <label
              className="field-label"
              htmlFor="category-slug"
            >
              Slug *
            </label>

            <input
              id="category-slug"
              className="form-control"
              value={form.slug}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  slug: event.target.value,
                }))
              }
              maxLength={150}
              required
              disabled={isSaving}
              aria-invalid={Boolean(
                getFieldError(formErrors, "slug"),
              )}
            />

            <p className="field-help">
              Contoh: engine-transmission.
            </p>

            {getFieldError(formErrors, "slug") && (
              <span className="field-error">
                {getFieldError(formErrors, "slug")}
              </span>
            )}
          </div>

          <div className="field">
            <label
              className="field-label"
              htmlFor="category-description"
            >
              Deskripsi
            </label>

            <textarea
              id="category-description"
              className="form-control"
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              maxLength={2000}
              rows={4}
              disabled={isSaving}
            />

            {getFieldError(formErrors, "description") && (
              <span className="field-error">
                {getFieldError(formErrors, "description")}
              </span>
            )}
          </div>

          <label
            className="flex items-center gap-2"
            htmlFor="category-active"
          >
            <input
              id="category-active"
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

            Kategori aktif
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

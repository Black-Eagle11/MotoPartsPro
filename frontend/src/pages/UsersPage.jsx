
import { useCallback, useEffect, useState } from "react";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination from "../components/Pagination";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "member", label: "Member" },
];

const ROLE_LABELS = Object.fromEntries(
  ROLES.map((role) => [role.value, role.label]),
);

const INITIAL_FILTERS = {
  search: "",
  role: "",
  active: "all",
  sort: "created_at",
  direction: "desc",
};

function getErrorMessage(error, fallback) {
  const response = error?.response?.data;

  if (
    response?.errors &&
    typeof response.errors === "object"
  ) {
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

function getRoleBadge(role) {
  switch (role) {
    case "admin":
      return "badge badge-danger";

    case "staff":
      return "badge badge-info";

    case "member":
      return "badge badge-success";

    default:
      return "badge";
  }
}

function getActiveBadge(isActive) {
  return isActive
    ? "badge badge-success"
    : "badge badge-danger";
}

function getUserInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function UsersPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);

  const [filtersDraft, setFiltersDraft] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [busyUserId, setBusyUserId] = useState(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("member");
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleFormErrors, setRoleFormErrors] = useState({});
  const [roleFormError, setRoleFormError] = useState("");

  const currentUserId = user?.id;

  const loadUsers = useCallback(async (signal) => {
    if (!isAdmin) {
      setUsers([]);
      setMeta(null);
      setIsLoading(false);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");

    const params = {
      page,
      per_page: 10,
      sort: filters.sort,
      direction: filters.direction,
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.role) {
      params.role = filters.role;
    }

    if (filters.active !== "all") {
      params.is_active = filters.active === "active" ? "1" : "0";
    }

    try {
      const response = await apiClient.get("/users", {
        params,
        signal,
      });

      if (signal.aborted) {
        return;
      }

      setUsers(
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
          "Data pengguna gagal dimuat. Periksa koneksi API dan hak akses akun.",
        ),
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [isAdmin, filters, page]);

  useEffect(() => {
    const controller = new AbortController();

    void loadUsers(controller.signal);

    return () => controller.abort();
  }, [loadUsers, refreshKey]);

  function handleApplyFilters(event) {
    event.preventDefault();

    setPage(1);
    setFilters({
      ...filtersDraft,
      search: filtersDraft.search.trim(),
    });
    setError("");
    setNotice(null);
  }

  function handleResetFilters() {
    setFiltersDraft({ ...INITIAL_FILTERS });
    setFilters({ ...INITIAL_FILTERS });
    setPage(1);
    setError("");
    setNotice(null);
  }

  function handleOpenRoleModal(targetUser) {
    if (
      !isAdmin ||
      String(targetUser.id) === String(currentUserId)
    ) {
      return;
    }

    setEditingUser(targetUser);
    setSelectedRole(targetUser.role);
    setRoleFormErrors({});
    setRoleFormError("");
    setIsRoleModalOpen(true);
  }

  function handleCloseRoleModal() {
    if (isSavingRole) {
      return;
    }

    setIsRoleModalOpen(false);
    setEditingUser(null);
    setRoleFormErrors({});
    setRoleFormError("");
  }

  async function handleSaveRole(event) {
    event.preventDefault();

    if (
      !isAdmin ||
      !editingUser ||
      isSavingRole ||
      String(editingUser.id) === String(currentUserId)
    ) {
      return;
    }

    setRoleFormErrors({});
    setRoleFormError("");
    setNotice(null);

    if (!ROLES.some((role) => role.value === selectedRole)) {
      setRoleFormError("Pilih role pengguna yang valid.");
      return;
    }

    if (selectedRole === editingUser.role) {
      handleCloseRoleModal();
      return;
    }

    setIsSavingRole(true);

    try {
      await apiClient.patch(
        `/users/${editingUser.id}/role`,
        { role: selectedRole },
      );

      setIsRoleModalOpen(false);

      setNotice({
        type: "success",
        message: `Role pengguna ${editingUser.name} berhasil diperbarui menjadi ${ROLE_LABELS[selectedRole]}.`,
      });

      setEditingUser(null);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setRoleFormErrors(
        requestError?.response?.data?.errors ?? {},
      );

      setRoleFormError(
        getErrorMessage(
          requestError,
          "Role gagal diperbarui. Periksa kebijakan akses Admin.",
        ),
      );
    } finally {
      setIsSavingRole(false);
    }
  }

  async function handleAccountAction(targetUser, action) {
    if (
      !isAdmin ||
      busyUserId !== null ||
      String(targetUser.id) === String(currentUserId)
    ) {
      return;
    }

    const isActive = Boolean(targetUser.is_active);

    if (action === "activate" && isActive) {
      return;
    }

    if (action === "deactivate" && !isActive) {
      return;
    }

    const actionConfig = {
      activate: {
        endpoint: `/users/${targetUser.id}/activate`,
        method: "patch",
        title: "Aktifkan akun",
        confirmation:
          `Aktifkan akun ${targetUser.name}?\n\nPengguna akan dapat mengakses aplikasi kembali.`,
        success:
          `Akun ${targetUser.name} berhasil diaktifkan.`,
        failure: "Akun gagal diaktifkan.",
      },
      deactivate: {
        endpoint: `/users/${targetUser.id}/deactivate`,
        method: "patch",
        title: "Nonaktifkan akun",
        confirmation:
          `Nonaktifkan akun ${targetUser.name}?\n\nPengguna tidak akan dapat menggunakan akun selama dinonaktifkan.`,
        success:
          `Akun ${targetUser.name} berhasil dinonaktifkan.`,
        failure: "Akun gagal dinonaktifkan.",
      },
      delete: {
        endpoint: `/users/${targetUser.id}`,
        method: "delete",
        title: "Hapus akun",
        confirmation:
          `Hapus akun ${targetUser.name} secara permanen?\n\nTindakan ini tidak dapat dibatalkan. Akun yang memiliki riwayat pesanan atau inventori mungkin tidak dapat dihapus.`,
        success:
          `Akun ${targetUser.name} berhasil dihapus.`,
        failure: "Akun gagal dihapus.",
      },
    };

    const config = actionConfig[action];

    if (!config) {
      return;
    }

    const confirmed = window.confirm(config.confirmation);

    if (!confirmed) {
      return;
    }

    setBusyUserId(targetUser.id);
    setNotice(null);
    setError("");

    try {
      if (config.method === "delete") {
        await apiClient.delete(config.endpoint);
      } else {
        await apiClient.patch(config.endpoint, {});
      }

      setNotice({
        type: "success",
        message: config.success,
      });

      if (
        action === "delete" &&
        users.length === 1 &&
        page > 1
      ) {
        setPage((value) => value - 1);
      } else {
        setRefreshKey((value) => value + 1);
      }
    } catch (requestError) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          requestError,
          config.failure,
        ),
      });
    } finally {
      setBusyUserId(null);
    }
  }

  const columns = [
    {
      key: "name",
      label: "Pengguna",
      render: (value, targetUser) => (
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            style={{
              width: 42,
              height: 42,
              minWidth: 42,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "#eef2ff",
              color: "#4338ca",
              fontWeight: 700,
            }}
          >
            {getUserInitials(value)}
          </div>

          <div>
            <strong>{value || "Tanpa nama"}</strong>

            {String(targetUser.id) === String(currentUserId) && (
              <div
                className="text-muted"
                style={{ fontSize: 12 }}
              >
                Akun Anda
              </div>
            )}

            <div
              className="text-muted"
              style={{ fontSize: 12 }}
            >
              ID: {targetUser.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (value) => (
        <span style={{ overflowWrap: "anywhere" }}>
          {value || "—"}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (value) => (
        <span className={getRoleBadge(value)}>
          {ROLE_LABELS[value] ?? value ?? "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status Akun",
      render: (value) => (
        <span className={getActiveBadge(Boolean(value))}>
          {value ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "email_verified_at",
      label: "Verifikasi Email",
      render: (value) => (
        <span
          className={
            value
              ? "badge badge-success"
              : "badge badge-warning"
          }
        >
          {value ? "Terverifikasi" : "Belum Verifikasi"}
        </span>
      ),
    },
    {
      key: "orders_count",
      label: "Jumlah Pesanan",
      render: (value) => (
        value === undefined || value === null
          ? "—"
          : new Intl.NumberFormat("id-ID").format(value)
      ),
    },
    {
      key: "created_at",
      label: "Terdaftar",
      render: (value) => formatDateTime(value),
    },
  ];

  function renderRowActions(targetUser) {
    const isCurrentUser =
      String(targetUser.id) === String(currentUserId);

    const isBusy = busyUserId === targetUser.id;

    return (
      <div className="table-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleOpenRoleModal(targetUser)}
          disabled={
            isCurrentUser ||
            busyUserId !== null
          }
          title={
            isCurrentUser
              ? "Role akun yang sedang digunakan tidak dapat diubah dari halaman ini."
              : "Ubah role pengguna"
          }
        >
          Ubah Role
        </button>

        {!isCurrentUser && (
          <>
            {targetUser.is_active ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  handleAccountAction(targetUser, "deactivate")
                }
                disabled={busyUserId !== null}
              >
                {isBusy ? "Memproses..." : "Nonaktifkan"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  handleAccountAction(targetUser, "activate")
                }
                disabled={busyUserId !== null}
              >
                {isBusy ? "Memproses..." : "Aktifkan"}
              </button>
            )}

            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                handleAccountAction(targetUser, "delete")
              }
              disabled={busyUserId !== null}
              title="Penghapusan tetap mengikuti aturan backend."
            >
              {isBusy ? "Memproses..." : "Hapus"}
            </button>
          </>
        )}
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div
        className="loading-state"
        role="status"
        aria-live="polite"
      >
        Memeriksa hak akses...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <section className="card">
        <h1 className="page-title">Akses Ditolak</h1>

        <p>
          Manajemen pengguna hanya tersedia untuk Admin.
          Perubahan role, aktivasi akun, dan penghapusan juga
          tetap diperiksa oleh backend.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="users-title">
      <header className="page-header">
        <div>
          <h1 id="users-title" className="page-title">
            Manajemen Pengguna
          </h1>

          <p className="page-description">
            Kelola role, status akun, serta informasi pengguna
            yang terdaftar di MotoPartsPro.
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
          aria-label="Pencarian dan filter pengguna"
        >
          <div className="grid grid-3">
            <div className="field">
              <label
                htmlFor="users-search"
                className="field-label"
              >
                Cari Pengguna
              </label>

              <input
                id="users-search"
                type="search"
                className="form-control"
                placeholder="Nama atau email..."
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
                htmlFor="users-role"
                className="field-label"
              >
                Role
              </label>

              <select
                id="users-role"
                className="form-control"
                value={filtersDraft.role}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    role: event.target.value,
                  }))
                }
              >
                <option value="">Semua Role</option>

                {ROLES.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label
                htmlFor="users-status"
                className="field-label"
              >
                Status Akun
              </label>

              <select
                id="users-status"
                className="form-control"
                value={filtersDraft.active}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    active: event.target.value,
                  }))
                }
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>

            <div className="field">
              <label
                htmlFor="users-sort"
                className="field-label"
              >
                Urutkan
              </label>

              <select
                id="users-sort"
                className="form-control"
                value={filtersDraft.sort}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    sort: event.target.value,
                  }))
                }
              >
                <option value="created_at">Tanggal Terdaftar</option>
                <option value="name">Nama</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
                <option value="id">ID</option>
              </select>
            </div>

            <div className="field">
              <label
                htmlFor="users-direction"
                className="field-label"
              >
                Arah Urutan
              </label>

              <select
                id="users-direction"
                className="form-control"
                value={filtersDraft.direction}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({
                    ...previous,
                    direction: event.target.value,
                  }))
                }
              >
                <option value="desc">Menurun / Terbaru</option>
                <option value="asc">Menaik / Terlama</option>
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

      <section className="card">
        <DataTable
          caption="Daftar pengguna MotoPartsPro"
          columns={columns}
          data={users}
          isLoading={isLoading}
          error={null}
          emptyMessage="Tidak ada pengguna yang cocok dengan filter."
          actions={renderRowActions}
        />

        <Pagination
          meta={meta}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </section>

      <FormModal
        isOpen={isRoleModalOpen}
        onClose={handleCloseRoleModal}
        title="Ubah Role Pengguna"
        description="Role menentukan kewenangan pengguna ketika mengakses sistem."
        closeOnBackdrop={!isSavingRole}
        closeOnEscape={!isSavingRole}
        showCloseButton={!isSavingRole}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCloseRoleModal}
              disabled={isSavingRole}
            >
              Batal
            </button>

            <button
              type="submit"
              form="change-user-role-form"
              className="btn btn-primary"
              disabled={
                isSavingRole ||
                !editingUser ||
                selectedRole === editingUser.role
              }
            >
              {isSavingRole ? "Menyimpan..." : "Simpan Role"}
            </button>
          </>
        }
      >
        {editingUser && (
          <form
            id="change-user-role-form"
            className="form"
            onSubmit={handleSaveRole}
            noValidate
          >
            {roleFormError && (
              <div
                className="alert alert-error"
                role="alert"
              >
                {roleFormError}
              </div>
            )}

            <div>
              <span className="text-muted">Nama Pengguna</span>
              <p>
                <strong>{editingUser.name}</strong>
              </p>
            </div>

            <div>
              <span className="text-muted">Email</span>
              <p>{editingUser.email}</p>
            </div>

            <div className="field">
              <label
                htmlFor="user-new-role"
                className="field-label"
              >
                Role Baru *
              </label>

              <select
                id="user-new-role"
                className="form-control"
                value={selectedRole}
                onChange={(event) => {
                  setSelectedRole(event.target.value);
                  setRoleFormError("");
                  setRoleFormErrors({});
                }}
                disabled={isSavingRole}
                required
                aria-invalid={Boolean(
                  getFieldError(roleFormErrors, "role"),
                )}
              >
                {ROLES.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </select>

              {getFieldError(roleFormErrors, "role") && (
                <span className="field-error">
                  {getFieldError(roleFormErrors, "role")}
                </span>
              )}
            </div>

            <div className="alert">
              <strong>Perhatian:</strong> role Admin memberikan
              kewenangan tertinggi. Laravel akan menolak perubahan
              yang melanggar kebijakan, termasuk perubahan yang
              membahayakan keberadaan Admin aktif terakhir.
            </div>
          </form>
        )}
      </FormModal>
    </section>
  );
}

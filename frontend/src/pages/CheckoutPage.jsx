
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import apiClient from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

const INITIAL_FORM = {
  shipping_name: "",
  shipping_phone: "",
  shipping_address: "",
  shipping_city: "",
  shipping_province: "",
  shipping_postal_code: "",
  notes: "",
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

function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function getProduct(item) {
  return item?.product && typeof item.product === "object"
    ? item.product
    : item ?? {};
}

function normalizeCartItem(item, index) {
  const product = getProduct(item);

  const id =
    item?.product_id ??
    item?.productId ??
    product?.id ??
    item?.id;

  const quantity = Number(item?.quantity ?? 1);
  const price = Number(product?.price ?? item?.price ?? 0);

  const stock =
    product?.stock === null ||
    product?.stock === undefined ||
    product?.stock === ""
      ? null
      : Number(product.stock);

  return {
    key: id ?? `checkout-item-${index}`,
    productId: id,
    name: product?.name ?? item?.name ?? "Produk",
    sku: product?.sku ?? item?.sku ?? "",
    imageUrl: product?.image_url ?? item?.image_url ?? null,
    quantity,
    price,
    stock:
      stock !== null && Number.isFinite(stock) && stock >= 0
        ? Math.floor(stock)
        : null,
    isActive: product?.is_active,
  };
}

function validateCartItem(item) {
  if (
    item.productId === null ||
    item.productId === undefined ||
    !Number.isInteger(Number(item.productId)) ||
    Number(item.productId) < 1
  ) {
    return "Ada produk dengan identitas yang tidak valid. Hapus produk tersebut, lalu tambahkan kembali dari katalog.";
  }

  if (
    !Number.isInteger(item.quantity) ||
    item.quantity < 1 ||
    item.quantity > 10000
  ) {
    return `Jumlah ${item.name} tidak valid.`;
  }

  if (!Number.isFinite(item.price) || item.price < 0) {
    return `Harga ${item.name} tidak valid.`;
  }

  if (item.isActive === false) {
    return `${item.name} sudah tidak aktif. Hapus produk dari keranjang.`;
  }

  if (item.stock !== null && item.quantity > item.stock) {
    return `Stok ${item.name} hanya tersisa ${formatNumber(item.stock)}. Sesuaikan jumlah di keranjang.`;
  }

  if (item.stock === 0) {
    return `Stok ${item.name} sedang habis.`;
  }

  return "";
}

export default function CheckoutPage() {
  const navigate = useNavigate();

  const { user, isLoading: isAuthLoading } = useAuth();
  const cart = useCart();

  const rawItems = useMemo(
    () => (Array.isArray(cart.items) ? cart.items : []),
    [cart.items],
  );

  const items = useMemo(
    () => rawItems.map(normalizeCartItem),
    [rawItems],
  );

  const cartIssues = useMemo(
    () => items
      .map((item) => ({
        key: item.key,
        message: validateCartItem(item),
      }))
      .filter((issue) => Boolean(issue.message)),
    [items],
  );

  const subtotalCents = useMemo(
    () => items.reduce((total, item) => {
      return total +
        Math.round(item.price * 100) * item.quantity;
    }, 0),
    [items],
  );

  const totalQuantity = useMemo(
    () => items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    [items],
  );

  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    shipping_name: user?.name ?? "",
  }));

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setForm((previous) => ({
        ...previous,
        shipping_name: previous.shipping_name || user.name,
      }));
    }
  }, [user?.name]);

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitError("");
    setFieldErrors({});

    if (items.length === 0) {
      setSubmitError(
        "Keranjang kosong. Tambahkan produk sebelum checkout.",
      );
      return;
    }

    if (cartIssues.length > 0) {
      setSubmitError(
        "Periksa produk yang bermasalah sebelum melanjutkan.",
      );
      return;
    }

    const requiredFields = [
      ["shipping_name", "Nama penerima"],
      ["shipping_phone", "Nomor telepon"],
      ["shipping_address", "Alamat lengkap"],
      ["shipping_city", "Kota/Kabupaten"],
      ["shipping_province", "Provinsi"],
      ["shipping_postal_code", "Kode pos"],
    ];

    const newErrors = {};

    for (const [key, label] of requiredFields) {
      if (!String(form[key] ?? "").trim()) {
        newErrors[key] = `${label} wajib diisi.`;
      }
    }

    if (
      form.shipping_phone.trim() &&
      !/^[0-9+()\-\s]{8,25}$/.test(form.shipping_phone.trim())
    ) {
      newErrors.shipping_phone =
        "Periksa format nomor telepon.";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setSubmitError(
        "Lengkapi informasi pengiriman yang masih belum valid.",
      );
      return;
    }

    const payload = {
      items: items.map((item) => ({
        product_id: Number(item.productId),
        quantity: item.quantity,
      })),
      shipping_name: form.shipping_name.trim(),
      shipping_phone: form.shipping_phone.trim(),
      shipping_address: form.shipping_address.trim(),
      shipping_city: form.shipping_city.trim(),
      shipping_province: form.shipping_province.trim(),
      shipping_postal_code: form.shipping_postal_code.trim(),
      notes: form.notes.trim() || null,
    };

    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/orders", payload);

      const order = response.data?.data ?? response.data?.order ?? null;

      // Pesanan sudah dibuat oleh server. Kegagalan membersihkan
      // state lokal tidak boleh dilaporkan sebagai kegagalan transaksi.
      try {
        if (typeof cart.clearCart === "function") {
          cart.clearCart();
        }
      } catch {
        // Server tetap menjadi sumber kebenaran untuk status pesanan.
      }

      navigate("/orders", {
        replace: true,
        state: {
          checkoutSuccess: true,
          orderNumber: order?.order_number ?? null,
          message: order?.order_number
            ? `Pesanan ${order.order_number} berhasil dibuat.`
            : "Pesanan berhasil dibuat.",
        },
      });
    } catch (requestError) {
      setFieldErrors(
        requestError?.response?.data?.errors ?? {},
      );

      setSubmitError(
        getErrorMessage(
          requestError,
          "Checkout gagal. Periksa stok, alamat, dan koneksi, lalu coba lagi.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="loading-state" role="status">
        Memuat informasi akun...
      </div>
    );
  }

  if (user?.role !== "member") {
    return (
      <section className="card">
        <h1 className="page-title">Checkout</h1>
        <p>
          Checkout dan pemesanan tersedia untuk akun Member.
        </p>
        <Link to="/products" className="btn btn-primary">
          Kembali ke Produk
        </Link>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="card empty-state">
        <h1 className="page-title">Keranjang Kosong</h1>
        <p>
          Tambahkan produk ke keranjang sebelum mengisi checkout.
        </p>
        <Link to="/products" className="btn btn-primary">
          Jelajahi Produk
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="checkout-title">
      <header className="page-header">
        <div>
          <h1 id="checkout-title" className="page-title">
            Checkout
          </h1>
          <p className="page-description">
            Masukkan data pengiriman, lalu tinjau ringkasan pesanan.
          </p>
        </div>
      </header>

      {submitError && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          {submitError}
        </div>
      )}

      {cartIssues.length > 0 && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          <strong>Periksa keranjang sebelum checkout.</strong>
          <ul style={{ marginTop: 8 }}>
            {cartIssues.map((issue) => (
              <li key={issue.key}>{issue.message}</li>
            ))}
          </ul>
          <Link
            to="/cart"
            className="btn btn-secondary"
            style={{ marginTop: 10 }}
          >
            Perbaiki Keranjang
          </Link>
        </div>
      )}

      <div className="grid grid-3">
        <section
          className="card"
          style={{ gridColumn: "span 2", minWidth: 0 }}
        >
          <h2 className="card-title">
            Informasi Pengiriman
          </h2>

          <form
            id="checkout-form"
            className="form"
            onSubmit={handleSubmit}
          >
            <div className="field">
              <label
                htmlFor="shipping-name"
                className="field-label"
              >
                Nama Penerima *
              </label>
              <input
                id="shipping-name"
                name="shipping_name"
                className="form-control"
                autoComplete="name"
                maxLength={120}
                required
                value={form.shipping_name}
                onChange={(event) =>
                  updateField("shipping_name", event.target.value)
                }
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.shipping_name)}
                aria-describedby={
                  fieldErrors.shipping_name
                    ? "shipping-name-error"
                    : undefined
                }
              />
              {getFieldError(fieldErrors, "shipping_name") && (
                <span
                  id="shipping-name-error"
                  className="field-error"
                >
                  {getFieldError(fieldErrors, "shipping_name")}
                </span>
              )}
            </div>

            <div className="field">
              <label
                htmlFor="shipping-phone"
                className="field-label"
              >
                Nomor Telepon *
              </label>
              <input
                id="shipping-phone"
                name="shipping_phone"
                className="form-control"
                type="tel"
                autoComplete="tel"
                maxLength={25}
                placeholder="Contoh: 081234567890"
                required
                value={form.shipping_phone}
                onChange={(event) =>
                  updateField("shipping_phone", event.target.value)
                }
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.shipping_phone)}
              />
              {getFieldError(fieldErrors, "shipping_phone") && (
                <span className="field-error">
                  {getFieldError(fieldErrors, "shipping_phone")}
                </span>
              )}
            </div>

            <div className="field">
              <label
                htmlFor="shipping-address"
                className="field-label"
              >
                Alamat Lengkap *
              </label>
              <textarea
                id="shipping-address"
                name="shipping_address"
                className="form-control"
                autoComplete="street-address"
                rows={4}
                maxLength={1000}
                required
                placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, dan detail alamat"
                value={form.shipping_address}
                onChange={(event) =>
                  updateField("shipping_address", event.target.value)
                }
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.shipping_address)}
              />
              {getFieldError(fieldErrors, "shipping_address") && (
                <span className="field-error">
                  {getFieldError(fieldErrors, "shipping_address")}
                </span>
              )}
            </div>

            <div className="grid grid-2">
              <div className="field">
                <label
                  htmlFor="shipping-city"
                  className="field-label"
                >
                  Kota/Kabupaten *
                </label>
                <input
                  id="shipping-city"
                  name="shipping_city"
                  className="form-control"
                  autoComplete="address-level2"
                  maxLength={100}
                  required
                  value={form.shipping_city}
                  onChange={(event) =>
                    updateField("shipping_city", event.target.value)
                  }
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.shipping_city)}
                />
                {getFieldError(fieldErrors, "shipping_city") && (
                  <span className="field-error">
                    {getFieldError(fieldErrors, "shipping_city")}
                  </span>
                )}
              </div>

              <div className="field">
                <label
                  htmlFor="shipping-province"
                  className="field-label"
                >
                  Provinsi *
                </label>
                <input
                  id="shipping-province"
                  name="shipping_province"
                  className="form-control"
                  autoComplete="address-level1"
                  maxLength={100}
                  required
                  value={form.shipping_province}
                  onChange={(event) =>
                    updateField("shipping_province", event.target.value)
                  }
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.shipping_province)}
                />
                {getFieldError(fieldErrors, "shipping_province") && (
                  <span className="field-error">
                    {getFieldError(fieldErrors, "shipping_province")}
                  </span>
                )}
              </div>
            </div>

            <div className="field">
              <label
                htmlFor="shipping-postal-code"
                className="field-label"
              >
                Kode Pos *
              </label>
              <input
                id="shipping-postal-code"
                name="shipping_postal_code"
                className="form-control"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={20}
                required
                value={form.shipping_postal_code}
                onChange={(event) =>
                  updateField(
                    "shipping_postal_code",
                    event.target.value,
                  )
                }
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.shipping_postal_code)}
              />
              {getFieldError(fieldErrors, "shipping_postal_code") && (
                <span className="field-error">
                  {getFieldError(fieldErrors, "shipping_postal_code")}
                </span>
              )}
            </div>

            <div className="field">
              <label
                htmlFor="checkout-notes"
                className="field-label"
              >
                Catatan untuk Penjual
              </label>
              <textarea
                id="checkout-notes"
                name="notes"
                className="form-control"
                rows={3}
                maxLength={2000}
                placeholder="Petunjuk pengiriman tambahan (opsional)"
                value={form.notes}
                onChange={(event) =>
                  updateField("notes", event.target.value)
                }
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.notes)}
              />
              {getFieldError(fieldErrors, "notes") && (
                <span className="field-error">
                  {getFieldError(fieldErrors, "notes")}
                </span>
              )}
            </div>

            <p className="text-muted" style={{ fontSize: 13 }}>
              Total final, ketersediaan stok, dan snapshot harga produk
              diverifikasi oleh server saat pesanan dibuat.
            </p>
          </form>
        </section>

        <aside
          className="card"
          aria-labelledby="checkout-summary-title"
          style={{ alignSelf: "start" }}
        >
          <h2
            id="checkout-summary-title"
            className="card-title"
          >
            Ringkasan Pesanan
          </h2>

          <div style={{ marginTop: 16 }}>
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-2"
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-color, #e5e7eb)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{item.name}</strong>
                  {item.sku && (
                    <div
                      className="text-muted"
                      style={{ fontSize: 12 }}
                    >
                      SKU: {item.sku}
                    </div>
                  )}
                  <div
                    className="text-muted"
                    style={{ fontSize: 12 }}
                  >
                    {formatRupiah(item.price)} × {item.quantity}
                  </div>
                </div>
                <strong style={{ whiteSpace: "nowrap" }}>
                  {formatRupiah(
                    Math.round(item.price * 100) *
                      item.quantity / 100,
                  )}
                </strong>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between gap-2"
            style={{ marginTop: 18 }}
          >
            <span>Jumlah barang</span>
            <strong>{formatNumber(totalQuantity)}</strong>
          </div>

          <div
            className="flex items-center justify-between gap-2"
            style={{ marginTop: 14 }}
          >
            <span>Subtotal sementara</span>
            <strong>{formatRupiah(subtotalCents / 100)}</strong>
          </div>

          <p
            className="text-muted"
            style={{ fontSize: 12, marginTop: 12 }}
          >
            Ongkos kirim, diskon, pajak, dan total final mengikuti
            perhitungan server.
          </p>

          <div
            className="form-actions"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              marginTop: 20,
            }}
          >
            <button
              type="submit"
              form="checkout-form"
              className="btn btn-primary"
              disabled={isSubmitting || cartIssues.length > 0}
            >
              {isSubmitting
                ? "Memproses Pesanan..."
                : "Buat Pesanan"}
            </button>

            <Link
              to="/cart"
              className="btn btn-secondary"
              style={{ textAlign: "center" }}
            >
              Kembali ke Keranjang
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

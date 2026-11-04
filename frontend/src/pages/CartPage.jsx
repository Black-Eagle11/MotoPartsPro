
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

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
  if (item?.product && typeof item.product === "object") {
    return item.product;
  }

  return item ?? {};
}

function getProductId(item, product) {
  return (
    item?.product_id ??
    item?.productId ??
    product?.id ??
    item?.id ??
    null
  );
}

function getQuantity(item, product) {
  const value = Number(item?.quantity ?? product?.quantity ?? 1);

  return Number.isInteger(value) && value > 0
    ? value
    : 1;
}

function getPrice(item, product) {
  const value = Number(product?.price ?? item?.price ?? 0);

  return Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function getStock(product) {
  if (
    product?.stock === null ||
    product?.stock === undefined ||
    product?.stock === ""
  ) {
    return null;
  }

  const value = Number(product.stock);

  return Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

export default function CartPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const cart = useCart();

  const rawItems = useMemo(() => {
    if (Array.isArray(cart.items) && cart.items.length > 0) {
      return cart.items;
    }

    if (Array.isArray(cart.cartItems)) {
      return cart.cartItems;
    }

    return Array.isArray(cart.items)
      ? cart.items
      : [];
  }, [cart.items, cart.cartItems]);

  const updateQuantity = cart.updateQuantity;
  const removeFromCart = cart.removeFromCart ?? cart.removeItem;
  const clearCart = cart.clearCart;

  const [notice, setNotice] = useState(null);

  const items = useMemo(() => {
    return rawItems
      .map((item, index) => {
        const product = getProduct(item);
        const productId = getProductId(item, product);

        return {
          key: productId ?? `cart-item-${index}`,
          productId,
          product,
          name: product.name ?? item?.name ?? "Produk tanpa nama",
          sku: product.sku ?? item?.sku ?? "",
          imageUrl: product.image_url ?? item?.image_url ?? null,
          price: getPrice(item, product),
          quantity: getQuantity(item, product),
          stock: getStock(product),
          isActive: product.is_active,
        };
      })
      .filter((item) => item.productId !== null);
  }, [rawItems]);

  const subtotalCents = useMemo(() => {
    return items.reduce((total, item) => {
      const unitPriceCents = Math.round(item.price * 100);

      return total + unitPriceCents * item.quantity;
    }, 0);
  }, [items]);

  const totalQuantity = useMemo(() => {
    return items.reduce(
      (total, item) => total + item.quantity,
      0,
    );
  }, [items]);

  const itemsWithIssues = useMemo(() => {
    return items.filter((item) => {
      if (item.isActive === false) {
        return true;
      }

      if (
        item.stock !== null &&
        (
          item.stock <= 0 ||
          item.quantity > item.stock
        )
      ) {
        return true;
      }

      return false;
    });
  }, [items]);

  const canCheckout =
    items.length > 0 &&
    itemsWithIssues.length === 0;

  function showNotice(type, message) {
    setNotice({ type, message });
  }

  function handleUpdateQuantity(item, difference) {
    setNotice(null);

    if (typeof updateQuantity !== "function") {
      showNotice(
        "error",
        "Fungsi pembaruan keranjang belum tersedia. Periksa CartContext.jsx.",
      );
      return;
    }

    const nextQuantity = item.quantity + difference;

    if (nextQuantity < 1) {
      return;
    }

    if (
      item.stock !== null &&
      nextQuantity > item.stock
    ) {
      showNotice(
        "error",
        `Stok ${item.name} yang tersedia hanya ${formatNumber(item.stock)}.`,
      );
      return;
    }

    try {
      updateQuantity(item.productId, nextQuantity);
    } catch {
      showNotice(
        "error",
        `Jumlah ${item.name} gagal diperbarui.`,
      );
    }
  }

  function handleRemoveItem(item) {
    if (typeof removeFromCart !== "function") {
      showNotice(
        "error",
        "Fungsi penghapusan produk belum tersedia. Periksa CartContext.jsx.",
      );
      return;
    }

    try {
      removeFromCart(item.productId);

      showNotice(
        "success",
        `${item.name} dihapus dari keranjang.`,
      );
    } catch {
      showNotice(
        "error",
        `Produk ${item.name} gagal dihapus.`,
      );
    }
  }

  function handleClearCart() {
    if (items.length === 0) {
      return;
    }

    if (typeof clearCart !== "function") {
      showNotice(
        "error",
        "Fungsi untuk mengosongkan keranjang belum tersedia.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Kosongkan seluruh keranjang belanja?",
    );

    if (!confirmed) {
      return;
    }

    try {
      clearCart();

      showNotice(
        "success",
        "Keranjang berhasil dikosongkan.",
      );
    } catch {
      showNotice(
        "error",
        "Keranjang gagal dikosongkan.",
      );
    }
  }

  if (isAuthLoading) {
    return (
      <div
        className="loading-state"
        role="status"
        aria-live="polite"
      >
        Memuat keranjang...
      </div>
    );
  }

  if (user?.role !== "member") {
    return (
      <section className="card">
        <h1 className="page-title">
          Keranjang Belanja
        </h1>

        <p>
          Fitur keranjang dan checkout tersedia untuk akun Member.
          Admin dan Staff dapat mengelola katalog serta inventori melalui
          halaman masing-masing.
        </p>

        <Link
          to="/products"
          className="btn btn-primary"
        >
          Lihat Produk
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="cart-title">
      <header className="page-header">
        <div>
          <h1 id="cart-title" className="page-title">
            Keranjang Belanja
          </h1>

          <p className="page-description">
            Periksa produk, sesuaikan jumlah barang, lalu lanjutkan ke checkout.
          </p>
        </div>

        {items.length > 0 && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleClearCart}
            >
              Kosongkan Keranjang
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
          aria-live="polite"
          style={{ marginBottom: 20 }}
        >
          {notice.message}
        </div>
      )}

      {items.length === 0 ? (
        <section className="card empty-state">
          <div
            aria-hidden="true"
            style={{
              fontSize: 42,
              marginBottom: 12,
            }}
          >
            🛒
          </div>

          <h2>Keranjang masih kosong</h2>

          <p>
            Pilih suku cadang yang diperlukan dari katalog produk untuk
            mulai berbelanja.
          </p>

          <div style={{ marginTop: 18 }}>
            <Link
              to="/products"
              className="btn btn-primary"
            >
              Jelajahi Produk
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid grid-3">
          <section
            className="card"
            style={{
              gridColumn: "span 2",
              minWidth: 0,
            }}
            aria-label="Daftar barang dalam keranjang"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title">
                Daftar Produk
              </h2>

              <span className="badge">
                {formatNumber(totalQuantity)} barang
              </span>
            </div>

            <div
              className="table-container"
              style={{ marginTop: 18 }}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Produk</th>
                    <th scope="col">Harga</th>
                    <th scope="col">Jumlah</th>
                    <th scope="col">Subtotal</th>
                    <th scope="col">
                      <span className="sr-only">Tindakan</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const lineTotalCents =
                      Math.round(item.price * 100) *
                      item.quantity;

                    const hasStockIssue =
                      item.isActive === false ||
                      (
                        item.stock !== null &&
                        (
                          item.stock === 0 ||
                          item.quantity > item.stock
                        )
                      );

                    let stockMessage = "";

                    if (item.isActive === false) {
                      stockMessage =
                        "Produk tidak lagi aktif. Hapus produk ini sebelum checkout.";
                    } else if (item.stock === 0) {
                      stockMessage =
                        "Stok habis. Hapus produk ini atau periksa kembali nanti.";
                    } else if (
                      item.stock !== null &&
                      item.quantity > item.stock
                    ) {
                      stockMessage =
                        `Stok tersedia hanya ${formatNumber(item.stock)}. Kurangi jumlah barang.`;
                    }

                    return (
                      <tr key={item.key}>
                        <td>
                          <div
                            className="flex items-center gap-2"
                            style={{ minWidth: 190 }}
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                loading="lazy"
                                style={{
                                  width: 64,
                                  height: 58,
                                  objectFit: "contain",
                                  borderRadius: 6,
                                  background: "#f2f4f7",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                style={{
                                  width: 64,
                                  height: 58,
                                  display: "grid",
                                  placeItems: "center",
                                  background: "#f2f4f7",
                                  borderRadius: 6,
                                  flexShrink: 0,
                                }}
                              >
                                📦
                              </div>
                            )}

                            <div>
                              <strong>{item.name}</strong>

                              {item.sku && (
                                <div
                                  className="text-muted"
                                  style={{ fontSize: 12 }}
                                >
                                  SKU: {item.sku}
                                </div>
                              )}

                              {hasStockIssue && (
                                <div
                                  className="field-error"
                                  style={{
                                    marginTop: 5,
                                    maxWidth: 240,
                                  }}
                                >
                                  {stockMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          {formatRupiah(item.price)}
                        </td>

                        <td>
                          <div
                            className="flex items-center gap-2"
                            aria-label={`Jumlah ${item.name}`}
                          >
                            <button
                              type="button"
                              className="btn btn-secondary"
                              aria-label={`Kurangi jumlah ${item.name}`}
                              disabled={item.quantity <= 1}
                              onClick={() =>
                                handleUpdateQuantity(item, -1)
                              }
                            >
                              −
                            </button>

                            <output
                              aria-live="polite"
                              style={{
                                minWidth: 24,
                                textAlign: "center",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatNumber(item.quantity)}
                            </output>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              aria-label={`Tambah jumlah ${item.name}`}
                              disabled={
                                item.stock !== null &&
                                item.quantity >= item.stock
                              }
                              onClick={() =>
                                handleUpdateQuantity(item, 1)
                              }
                            >
                              +
                            </button>
                          </div>

                          {item.stock !== null && (
                            <div
                              className="text-muted"
                              style={{
                                fontSize: 12,
                                marginTop: 5,
                              }}
                            >
                              Stok: {formatNumber(item.stock)}
                            </div>
                          )}
                        </td>

                        <td>
                          <strong>
                            {formatRupiah(lineTotalCents / 100)}
                          </strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            aria-label={`Hapus ${item.name} dari keranjang`}
                            onClick={() => handleRemoveItem(item)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p
              className="text-muted"
              style={{
                fontSize: 13,
                marginTop: 14,
              }}
            >
              Harga dan ketersediaan pada keranjang berasal dari data produk
              yang tersimpan. Backend akan memvalidasi ulang harga dan stok
              terkini saat pesanan dibuat.
            </p>
          </section>

          <aside
            className="card"
            aria-labelledby="cart-summary-title"
            style={{ alignSelf: "start" }}
          >
            <h2
              id="cart-summary-title"
              className="card-title"
            >
              Ringkasan Belanja
            </h2>

            <div
              className="flex items-center justify-between gap-2"
              style={{ marginTop: 20 }}
            >
              <span>Total jenis produk</span>
              <strong>{formatNumber(items.length)}</strong>
            </div>

            <div
              className="flex items-center justify-between gap-2"
              style={{ marginTop: 12 }}
            >
              <span>Total kuantitas</span>
              <strong>{formatNumber(totalQuantity)}</strong>
            </div>

            <div
              className="flex items-center justify-between gap-2"
              style={{ marginTop: 18 }}
            >
              <span>Subtotal</span>
              <strong>
                {formatRupiah(subtotalCents / 100)}
              </strong>
            </div>

            <p
              className="text-muted"
              style={{
                fontSize: 12,
                marginTop: 10,
              }}
            >
              Ongkir, pajak, diskon, dan total final dihitung di sisi server
              sesuai aturan checkout.
            </p>

            {itemsWithIssues.length > 0 && (
              <div
                className="alert alert-error"
                role="alert"
                style={{ marginTop: 18 }}
              >
                Ada {formatNumber(itemsWithIssues.length)} produk dengan
                masalah stok atau status. Perbaiki keranjang sebelum
                melanjutkan.
              </div>
            )}

            <div
              className="form-actions"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                marginTop: 22,
              }}
            >
              {canCheckout ? (
                <Link
                  to="/checkout"
                  className="btn btn-primary"
                  style={{ textAlign: "center" }}
                >
                  Lanjut ke Checkout
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled
                  title={
                    items.length === 0
                      ? "Keranjang kosong"
                      : "Periksa stok dan status produk terlebih dahulu"
                  }
                >
                  Lanjut ke Checkout
                </button>
              )}

              <Link
                to="/products"
                className="btn btn-secondary"
                style={{ textAlign: "center" }}
              >
                Tambah Produk Lain
              </Link>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

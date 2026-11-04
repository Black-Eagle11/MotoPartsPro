
import { useEffect, useState } from "react";

import { useCart } from "../contexts/CartContext";

function formatRupiah(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "Harga belum tersedia";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductCard({
  product,
  onViewDetails,
}) {
  const { addToCart, getItemQuantity } = useCart();

  const [feedback, setFeedback] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setFeedback(null);
  }, [product?.image_url]);

  if (!product || product.id === undefined || product.id === null) {
    return null;
  }

  const stock = Number(product.stock ?? 0);
  const active = product.is_active !== false;
  const outOfStock = !Number.isFinite(stock) || stock < 1;
  const disabled = !active || outOfStock || isAdding;
  const quantityInCart = getItemQuantity(product.id);

  async function handleAddToCart() {
    if (disabled) {
      return;
    }

    setIsAdding(true);
    setFeedback(null);

    try {
      const result = addToCart(product, 1);

      setFeedback({
        type: result.success ? "success" : "error",
        message: result.message,
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Produk gagal ditambahkan ke keranjang.",
      });
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <article className="product-card">
      <div className="product-image">
        {product.image_url && !imageFailed ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-muted">
            Gambar tidak tersedia
          </span>
        )}
      </div>

      <div className="product-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="badge badge-primary">
            {product.category?.name ?? "Suku Cadang"}
          </span>

          {active ? (
            outOfStock ? (
              <span className="badge badge-danger">
                Stok habis
              </span>
            ) : product.is_low_stock ? (
              <span className="badge badge-warning">
                Stok menipis
              </span>
            ) : (
              <span className="badge badge-success">
                Tersedia
              </span>
            )
          ) : (
            <span className="badge badge-danger">
              Tidak aktif
            </span>
          )}
        </div>

        <div>
          <h2 className="product-name">
            {product.name}
          </h2>

          <p className="text-muted">
            SKU: {product.sku ?? "—"}
          </p>

          {product.brand && (
            <p className="text-muted">
              Merek: {product.brand}
            </p>
          )}
        </div>

        <p className="product-price">
          {formatRupiah(product.price)}
        </p>

        <p className="text-muted">
          Stok tersedia: {Math.max(0, stock)}
        </p>

        {quantityInCart > 0 && (
          <p className="text-muted">
            Dalam keranjang: {quantityInCart}
          </p>
        )}

        {feedback && (
          <div
            className={
              feedback.type === "success"
                ? "alert alert-success"
                : "alert alert-error"
            }
            role={feedback.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.message}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={handleAddToCart}
          disabled={disabled}
        >
          {isAdding
            ? "Menambahkan..."
            : outOfStock
              ? "Stok Habis"
              : !active
                ? "Produk Tidak Aktif"
                : "Tambah ke Keranjang"}
        </button>

        {typeof onViewDetails === "function" && (
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => onViewDetails(product)}
          >
            Lihat Detail
          </button>
        )}
      </div>
    </article>
  );
}

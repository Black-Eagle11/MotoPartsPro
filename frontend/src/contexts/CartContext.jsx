
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

const CART_STORAGE_PREFIX = "motopartspro_cart_user_";
const MAX_QUANTITY = 10_000;

function getCartStorageKey(userId) {
  return `${CART_STORAGE_PREFIX}${userId}`;
}

/**
 * Konversi nilai harga API ke integer sen rupiah.
 * Menghindari perhitungan subtotal menggunakan float.
 */
function priceToCents(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [whole, fraction = ""] = normalized.split(".");
  const cents =
    Number(whole) * 100 +
    Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents < 0) {
    return null;
  }

  return cents;
}

function centsToDecimal(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");

  return `${whole}.${fraction}`;
}

/**
 * Validasi data keranjang yang dipulihkan dari browser.
 * Data lokal tidak pernah dianggap sebagai sumber harga atau stok
 * yang definitif untuk transaksi backend.
 */
function normalizeCartItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = [];
  const seenIds = new Set();

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const productId = Number(rawItem.product_id);
    const quantity = Number(rawItem.quantity);
    const stock = Number(rawItem.stock);
    const priceCents = priceToCents(rawItem.price);

    if (
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      quantity > stock ||
      priceCents === null ||
      typeof rawItem.name !== "string" ||
      !rawItem.name.trim() ||
      seenIds.has(productId)
    ) {
      continue;
    }

    seenIds.add(productId);

    normalized.push({
      product_id: productId,
      name: rawItem.name,
      sku: typeof rawItem.sku === "string" ? rawItem.sku : "",
      slug: typeof rawItem.slug === "string" ? rawItem.slug : "",
      price: centsToDecimal(priceCents),
      image_url:
        typeof rawItem.image_url === "string"
          ? rawItem.image_url
          : null,
      stock,
      quantity,
    });
  }

  return normalized;
}

function readCartFromStorage(userId) {
  try {
    const rawValue = window.localStorage.getItem(
      getCartStorageKey(userId),
    );

    if (!rawValue) {
      return [];
    }

    return normalizeCartItems(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const {
    user,
    isLoading: authLoading,
  } = useAuth();

  const userId =
    user?.id !== undefined && user?.id !== null
      ? String(user.id)
      : null;

  const [items, setItems] = useState([]);
  const [loadedUserId, setLoadedUserId] = useState(null);

  /**
   * Pulihkan keranjang hanya setelah status autentikasi
   * selesai diperiksa.
   */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!userId) {
      setItems([]);
      setLoadedUserId(null);
      return;
    }

    const savedItems = readCartFromStorage(userId);

    setItems(savedItems);
    setLoadedUserId(userId);
  }, [authLoading, userId]);

  const isCartReady =
    !authLoading &&
    userId !== null &&
    loadedUserId === userId;

  /**
   * Jangan menulis keranjang akun sebelumnya ke storage
   * akun baru sebelum proses hidrasi selesai.
   */
  useEffect(() => {
    if (!isCartReady || !userId) {
      return;
    }

    try {
      window.localStorage.setItem(
        getCartStorageKey(userId),
        JSON.stringify(items),
      );
    } catch {
      // Keranjang tetap tersedia dalam state selama halaman aktif.
    }
  }, [items, isCartReady, userId]);

  /**
   * Tambahkan produk dari ProductResource API.
   */
  const addToCart = useCallback(
    (product, quantity = 1) => {
      if (!userId) {
        return {
          success: false,
          message: "Silakan login sebelum menggunakan keranjang.",
        };
      }

      if (!isCartReady) {
        return {
          success: false,
          message: "Keranjang sedang disiapkan. Coba lagi sebentar.",
        };
      }

      const productId = Number(product?.id);
      const amount = Number(quantity);
      const stock = Number(product?.stock);
      const priceCents = priceToCents(product?.price);

      if (
        !Number.isSafeInteger(productId) ||
        productId < 1
      ) {
        return {
          success: false,
          message: "Identitas produk tidak valid.",
        };
      }

      if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > MAX_QUANTITY
      ) {
        return {
          success: false,
          message: "Kuantitas produk tidak valid.",
        };
      }

      if (
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        return {
          success: false,
          message: "Informasi stok produk tidak valid.",
        };
      }

      if (product?.is_active === false) {
        return {
          success: false,
          message: "Produk sedang tidak aktif.",
        };
      }

      if (priceCents === null) {
        return {
          success: false,
          message: "Harga produk tidak valid.",
        };
      }

      if (stock < 1) {
        return {
          success: false,
          message: "Produk sedang habis.",
        };
      }

      if (typeof product?.name !== "string" || !product.name.trim()) {
        return {
          success: false,
          message: "Nama produk tidak valid.",
        };
      }

      const existingItem = items.find(
        (item) => item.product_id === productId,
      );

      const existingQuantity = existingItem?.quantity ?? 0;
      const nextQuantity = existingQuantity + amount;

      if (
        nextQuantity > stock ||
        nextQuantity > MAX_QUANTITY
      ) {
        return {
          success: false,
          message: `Jumlah melebihi stok yang tersedia (${stock}).`,
        };
      }

      const nextItem = {
        product_id: productId,
        name: product.name,
        sku: typeof product.sku === "string" ? product.sku : "",
        slug: typeof product.slug === "string" ? product.slug : "",
        price: centsToDecimal(priceCents),
        image_url:
          typeof product.image_url === "string"
            ? product.image_url
            : null,
        stock,
        quantity: nextQuantity,
      };

      const nextItems = existingItem
        ? items.map((item) =>
            item.product_id === productId
              ? nextItem
              : item,
          )
        : [...items, nextItem];

      setItems(nextItems);

      return {
        success: true,
        message: "Produk berhasil ditambahkan ke keranjang.",
        item: nextItem,
      };
    },
    [items, isCartReady, userId],
  );

  /**
   * Perbarui jumlah produk.
   * Kuantitas nol dapat digunakan untuk menghapus item.
   */
  const updateQuantity = useCallback(
    (productId, quantity) => {
      const id = Number(productId);
      const amount = Number(quantity);

      if (!isCartReady) {
        return {
          success: false,
          message: "Keranjang belum siap.",
        };
      }

      const existingItem = items.find(
        (item) => item.product_id === id,
      );

      if (!existingItem) {
        return {
          success: false,
          message: "Produk tidak ditemukan dalam keranjang.",
        };
      }

      if (
        !Number.isSafeInteger(id) ||
        !Number.isInteger(amount) ||
        amount < 0 ||
        amount > MAX_QUANTITY
      ) {
        return {
          success: false,
          message: "Kuantitas tidak valid.",
        };
      }

      if (amount === 0) {
        setItems(
          items.filter((item) => item.product_id !== id),
        );

        return {
          success: true,
          message: "Produk dihapus dari keranjang.",
        };
      }

      if (amount > existingItem.stock) {
        return {
          success: false,
          message:
            `Jumlah melebihi stok yang tersimpan (${existingItem.stock}).`,
        };
      }

      setItems(
        items.map((item) =>
          item.product_id === id
            ? { ...item, quantity: amount }
            : item,
        ),
      );

      return {
        success: true,
        message: "Kuantitas berhasil diperbarui.",
      };
    },
    [items, isCartReady],
  );

  /**
   * Hapus satu produk.
   */
  const removeFromCart = useCallback(
    (productId) => {
      const id = Number(productId);

      if (!isCartReady) {
        return {
          success: false,
          message: "Keranjang belum siap.",
        };
      }

      const exists = items.some(
        (item) => item.product_id === id,
      );

      if (!exists) {
        return {
          success: false,
          message: "Produk tidak ditemukan dalam keranjang.",
        };
      }

      setItems(
        items.filter((item) => item.product_id !== id),
      );

      return {
        success: true,
        message: "Produk berhasil dihapus.",
      };
    },
    [items, isCartReady],
  );

  /**
   * Kosongkan keranjang pengguna yang sedang login.
   */
  const clearCart = useCallback(() => {
    if (!isCartReady) {
      return {
        success: false,
        message: "Keranjang belum siap.",
      };
    }

    setItems([]);

    return {
      success: true,
      message: "Keranjang berhasil dikosongkan.",
    };
  }, [isCartReady]);

  const getItemQuantity = useCallback(
    (productId) => {
      const id = Number(productId);

      return (
        items.find((item) => item.product_id === id)?.quantity ?? 0
      );
    },
    [items],
  );

  const isInCart = useCallback(
    (productId) => getItemQuantity(productId) > 0,
    [getItemQuantity],
  );

  /**
   * Seluruh perhitungan subtotal menggunakan integer cents.
   * Backend tetap menghitung ulang total pada saat checkout.
   */
  const subtotalCents = useMemo(
    () =>
      items.reduce((total, item) => {
        const priceCents = priceToCents(item.price);

        if (priceCents === null) {
          return total;
        }

        return total + priceCents * item.quantity;
      }, 0),
    [items],
  );

  const totalItems = useMemo(
    () => items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    [items],
  );

  const subtotal = subtotalCents / 100;

  const value = useMemo(
    () => ({
      items,
      cartItems: items,

      isCartReady,
      itemCount: totalItems,
      totalItems,

      subtotalCents,
      subtotal,
      totalPrice: subtotal,

      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,

      getItemQuantity,
      isInCart,
    }),
    [
      items,
      isCartReady,
      totalItems,
      subtotalCents,
      subtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      getItemQuantity,
      isInCart,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (context === null) {
    throw new Error(
      "useCart harus digunakan di dalam CartProvider.",
    );
  }

  return context;
}


import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/*
 * Polyfill browser API yang kadang belum tersedia di jsdom.
 * Implementasi ini untuk kebutuhan pengujian, bukan produksi.
 */

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,

      addListener: vi.fn(),
      removeListener: vi.fn(),

      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),

      dispatchEvent: vi.fn(() => false),
    })),
  });

  window.scrollTo = vi.fn();
}

if (
  typeof HTMLElement !== "undefined" &&
  !HTMLElement.prototype.scrollIntoView
) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

/*
 * Pembersihan setelah setiap tes mencegah DOM, penyimpanan browser,
 * dan riwayat pemanggilan mock memengaruhi tes berikutnya.
 */
afterEach(() => {
  cleanup();

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Sebagian lingkungan test mungkin membatasi Web Storage.
  }

  vi.clearAllMocks();
});

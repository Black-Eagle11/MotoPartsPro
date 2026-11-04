
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../App";

/*
 * State autentikasi dapat diatur berbeda untuk setiap skenario.
 * vi.hoisted membuat objek ini tersedia pada saat mock diinisialisasi.
 */
const authMock = vi.hoisted(() => ({
  state: {
    isLoading: false,
    isAuthenticated: false,
    user: null,
  },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authMock.state,
}));

/*
 * Layout menggunakan Outlet agar nested routes dalam App tetap bekerja.
 * Komponen navigasi aslinya tidak diperlukan untuk tes routing.
 */
vi.mock("../layouts/AppLayout", async () => {
  const { Outlet } = await import("react-router-dom");

  function MockAppLayout() {
    return (
      <div data-testid="app-layout">
        <Outlet />
      </div>
    );
  }

  return {
    default: MockAppLayout,
  };
});

/*
 * Halaman individual di-mock supaya tes dapat fokus pada
 * routing, autentikasi, dan pembatasan akses.
 */
vi.mock("../pages/LoginPage", () => ({
  default: function MockLoginPage() {
    return <div data-testid="page-login">Login Page</div>;
  },
}));

vi.mock("../pages/RegisterPage", () => ({
  default: function MockRegisterPage() {
    return <div data-testid="page-register">Register Page</div>;
  },
}));

vi.mock("../pages/DashboardPage", () => ({
  default: function MockDashboardPage() {
    return <div data-testid="page-dashboard">Dashboard Page</div>;
  },
}));

vi.mock("../pages/ProductsPage", () => ({
  default: function MockProductsPage() {
    return <div data-testid="page-products">Products Page</div>;
  },
}));

vi.mock("../pages/CategoriesPage", () => ({
  default: function MockCategoriesPage() {
    return <div data-testid="page-categories">Categories Page</div>;
  },
}));

vi.mock("../pages/InventoryPage", () => ({
  default: function MockInventoryPage() {
    return <div data-testid="page-inventory">Inventory Page</div>;
  },
}));

vi.mock("../pages/CartPage", () => ({
  default: function MockCartPage() {
    return <div data-testid="page-cart">Cart Page</div>;
  },
}));

vi.mock("../pages/CheckoutPage", () => ({
  default: function MockCheckoutPage() {
    return <div data-testid="page-checkout">Checkout Page</div>;
  },
}));

vi.mock("../pages/OrdersPage", () => ({
  default: function MockOrdersPage() {
    return <div data-testid="page-orders">Orders Page</div>;
  },
}));

vi.mock("../pages/UsersPage", () => ({
  default: function MockUsersPage() {
    return <div data-testid="page-users">Users Page</div>;
  },
}));

vi.mock("../pages/NotFoundPage", () => ({
  default: function MockNotFoundPage() {
    return <div data-testid="page-not-found">Not Found Page</div>;
  },
}));

function setGuest() {
  authMock.state = {
    isLoading: false,
    isAuthenticated: false,
    user: null,
  };
}

function setAuthenticatedUser(role) {
  authMock.state = {
    isLoading: false,
    isAuthenticated: true,
    user: {
      id: 1,
      name: "Pengguna Pengujian",
      email: "test@example.com",
      role,
      is_active: true,
    },
  };
}

function renderApp(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setGuest();
});

describe("App — halaman publik", () => {
  it("menampilkan halaman login bagi pengunjung", async () => {
    renderApp("/login");

    expect(
      await screen.findByTestId("page-login"),
    ).toBeInTheDocument();
  });

  it("menampilkan halaman registrasi bagi pengunjung", async () => {
    renderApp("/register");

    expect(
      await screen.findByTestId("page-register"),
    ).toBeInTheDocument();
  });

  it("mengarahkan pengunjung yang belum login ke halaman login", async () => {
    renderApp("/dashboard");

    expect(
      await screen.findByTestId("page-login"),
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId("page-dashboard"),
    ).not.toBeInTheDocument();
  });
});

describe("App — akses Member", () => {
  beforeEach(() => {
    setAuthenticatedUser("member");
  });

  it("menampilkan dashboard untuk Member yang sudah login", async () => {
    renderApp("/dashboard");

    expect(
      await screen.findByTestId("page-dashboard"),
    ).toBeInTheDocument();
  });

  it("mengizinkan Member melihat katalog produk", async () => {
    renderApp("/products");

    expect(
      await screen.findByTestId("page-products"),
    ).toBeInTheDocument();
  });

  it("mengizinkan Member melihat kategori", async () => {
    renderApp("/categories");

    expect(
      await screen.findByTestId("page-categories"),
    ).toBeInTheDocument();
  });

  it("mengizinkan Member membuka keranjang dan checkout", async () => {
    renderApp("/cart");

    expect(
      await screen.findByTestId("page-cart"),
    ).toBeInTheDocument();
  });

  it("mengarahkan Member yang mencoba membuka inventori ke dashboard", async () => {
    renderApp("/inventory");

    expect(
      await screen.findByTestId("page-dashboard"),
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId("page-inventory"),
    ).not.toBeInTheDocument();
  });

  it("mengarahkan Member yang mencoba membuka manajemen pengguna ke dashboard", async () => {
    renderApp("/users");

    expect(
      await screen.findByTestId("page-dashboard"),
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId("page-users"),
    ).not.toBeInTheDocument();
  });
});

describe("App — akses Staff", () => {
  beforeEach(() => {
    setAuthenticatedUser("staff");
  });

  it("mengizinkan Staff membuka inventori", async () => {
    renderApp("/inventory");

    expect(
      await screen.findByTestId("page-inventory"),
    ).toBeInTheDocument();
  });

  it("mengarahkan Staff yang mencoba membuka manajemen pengguna ke dashboard", async () => {
    renderApp("/users");

    expect(
      await screen.findByTestId("page-dashboard"),
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId("page-users"),
    ).not.toBeInTheDocument();
  });
});

describe("App — akses Admin", () => {
  beforeEach(() => {
    setAuthenticatedUser("admin");
  });

  it("mengizinkan Admin membuka manajemen pengguna", async () => {
    renderApp("/users");

    expect(
      await screen.findByTestId("page-users"),
    ).toBeInTheDocument();
  });

  it("mengizinkan Admin membuka inventori", async () => {
    renderApp("/inventory");

    expect(
      await screen.findByTestId("page-inventory"),
    ).toBeInTheDocument();
  });
});

describe("App — penanganan rute", () => {
  it("menampilkan halaman tidak ditemukan untuk rute yang tidak tersedia", async () => {
    setAuthenticatedUser("member");

    renderApp("/rute-yang-tidak-tersedia");

    expect(
      await screen.findByTestId("page-not-found"),
    ).toBeInTheDocument();
  });
});

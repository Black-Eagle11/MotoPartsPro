
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import InventoryPage from "./pages/InventoryPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import UsersPage from "./pages/UsersPage";
import NotFoundPage from "./pages/NotFoundPage";

const AUTHENTICATED_ROLES = [
  "admin",
  "staff",
  "member",
];

const INVENTORY_ROLES = [
  "admin",
  "staff",
];

const ADMIN_ROLES = [
  "admin",
];

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      {/* All authenticated users */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={AUTHENTICATED_ROLES}
          />
        }
      >
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<DashboardPage />}
          />

          <Route
            path="products"
            element={<ProductsPage />}
          />

          <Route
            path="categories"
            element={<CategoriesPage />}
          />

          <Route
            path="cart"
            element={<CartPage />}
          />

          <Route
            path="checkout"
            element={<CheckoutPage />}
          />

          <Route
            path="orders"
            element={<OrdersPage />}
          />

          {/* Inventory: Admin and Staff */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={INVENTORY_ROLES}
              />
            }
          >
            <Route
              path="inventory"
              element={<InventoryPage />}
            />
          </Route>

          {/* User administration: Admin only */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={ADMIN_ROLES}
              />
            }
          >
            <Route
              path="users"
              element={<UsersPage />}
            />
          </Route>

          <Route
            path="*"
            element={<NotFoundPage />}
          />
        </Route>
      </Route>

      {/* Fallback untuk URL di luar route aplikasi */}
      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}

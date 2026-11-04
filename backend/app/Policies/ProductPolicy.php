<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAllowedUser($user);
    }

    public function view(User $user, Product $product): bool
    {
        if (!$this->isAllowedUser($user)) {
            return false;
        }

        if ($this->isAdminOrStaff($user)) {
            return true;
        }

        return $product->is_active;
    }

    public function create(User $user): bool
    {
        return $this->isAdminOrStaff($user);
    }

    public function update(User $user, Product $product): bool
    {
        return $this->isAdminOrStaff($user);
    }

    public function delete(User $user, Product $product): bool
    {
        if (!$this->isAdmin($user)) {
            return false;
        }

        // Pertahankan integritas riwayat transaksi dan stok.
        return !$product->orderItems()->exists()
            && !$product->stockMovements()->exists();
    }

    public function adjustStock(User $user, Product $product): bool
    {
        return $this->isAdminOrStaff($user);
    }

    public function viewCost(User $user, Product $product): bool
    {
        return $this->isAdminOrStaff($user);
    }

    private function isAllowedUser(User $user): bool
    {
        return $user->is_active
            && in_array($user->role, User::ROLES, true);
    }

    private function isAdmin(User $user): bool
    {
        return $this->isAllowedUser($user)
            && $user->role === User::ROLE_ADMIN;
    }

    private function isAdminOrStaff(User $user): bool
    {
        return $this->isAllowedUser($user)
            && in_array($user->role, [
                User::ROLE_ADMIN,
                User::ROLE_STAFF,
            ], true);
    }
}

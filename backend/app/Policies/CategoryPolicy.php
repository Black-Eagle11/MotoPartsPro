<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

class CategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAllowedUser($user);
    }

    public function view(User $user, Category $category): bool
    {
        if (!$this->isAllowedUser($user)) {
            return false;
        }

        if ($this->isAdminOrStaff($user)) {
            return true;
        }

        return $category->is_active;
    }

    public function create(User $user): bool
    {
        return $this->isAdmin($user);
    }

    public function update(User $user, Category $category): bool
    {
        return $this->isAdmin($user);
    }

    public function delete(User $user, Category $category): bool
    {
        if (!$this->isAdmin($user)) {
            return false;
        }

        // Kategori harus kosong agar tidak merusak relasi produk.
        return !$category->products()->exists();
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

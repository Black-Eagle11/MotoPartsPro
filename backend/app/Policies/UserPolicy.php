<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAdmin($user);
    }

    public function view(User $user, User $target): bool
    {
        if (!$this->isAllowedUser($user)) {
            return false;
        }

        return $this->isAdmin($user)
            || $user->id === $target->id;
    }

    public function create(User $user): bool
    {
        return $this->isAdmin($user);
    }

    public function update(User $user, User $target): bool
    {
        if (!$this->isAllowedUser($user)) {
            return false;
        }

        // User boleh memperbarui profil sendiri.
        // Perubahan role harus melewati changeRole().
        return $this->isAdmin($user)
            || $user->id === $target->id;
    }

    public function changeRole(
        User $user,
        User $target,
        string $newRole
    ): bool {
        if (
            !$this->isAdmin($user) ||
            $user->id === $target->id ||
            !in_array($newRole, User::ROLES, true)
        ) {
            return false;
        }

        // Admin aktif terakhir tidak boleh diturunkan rolenya.
        if (
            $target->is_active &&
            $target->role === User::ROLE_ADMIN &&
            $newRole !== User::ROLE_ADMIN &&
            $this->activeAdminCount() <= 1
        ) {
            return false;
        }

        return true;
    }

    public function activate(User $user, User $target): bool
    {
        return $this->isAdmin($user)
            && $user->id !== $target->id;
    }

    public function deactivate(User $user, User $target): bool
    {
        if (
            !$this->isAdmin($user) ||
            $user->id === $target->id
        ) {
            return false;
        }

        if (
            $target->is_active &&
            $target->role === User::ROLE_ADMIN &&
            $this->activeAdminCount() <= 1
        ) {
            return false;
        }

        return true;
    }

    public function delete(User $user, User $target): bool
    {
        if (
            !$this->isAdmin($user) ||
            $user->id === $target->id
        ) {
            return false;
        }

        // Akun dengan riwayat transaksi tidak dihapus.
        if (
            $target->orders()->exists() ||
            $target->stockMovements()->exists()
        ) {
            return false;
        }

        // Lindungi Admin aktif terakhir.
        if (
            $target->is_active &&
            $target->role === User::ROLE_ADMIN &&
            $this->activeAdminCount() <= 1
        ) {
            return false;
        }

        return true;
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

    private function activeAdminCount(): int
    {
        return User::query()
            ->active()
            ->role(User::ROLE_ADMIN)
            ->count();
    }
}

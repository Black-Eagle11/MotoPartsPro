<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAllowedUser($user);
    }

    public function view(User $user, Order $order): bool
    {
        if (!$this->isAllowedUser($user)) {
            return false;
        }

        if ($this->isAdminOrStaff($user)) {
            return true;
        }

        return $order->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $this->isAllowedUser($user);
    }

    public function update(User $user, Order $order): bool
    {
        if (!$this->isAllowedUser($user)) {
            return false;
        }

        if ($user->role === User::ROLE_MEMBER) {
            return $order->user_id === $user->id
                && $order->status === Order::STATUS_PENDING;
        }

        return $this->isAdminOrStaff($user)
            && in_array($order->status, [
                Order::STATUS_PENDING,
                Order::STATUS_CONFIRMED,
            ], true);
    }

    public function updateStatus(User $user, Order $order): bool
    {
        if (!$this->isAdminOrStaff($user)) {
            return false;
        }

        return !in_array($order->status, [
            Order::STATUS_COMPLETED,
            Order::STATUS_CANCELLED,
        ], true);
    }

    public function cancel(User $user, Order $order): bool
    {
        if (
            !$this->isAllowedUser($user) ||
            !$order->isCancellable()
        ) {
            return false;
        }

        if ($this->isAdminOrStaff($user)) {
            return true;
        }

        return $order->user_id === $user->id;
    }

    public function delete(User $user, Order $order): bool
    {
        if (
            !$this->isAdmin($user) ||
            $order->status !== Order::STATUS_PENDING
        ) {
            return false;
        }

        // Jangan menghapus pesanan yang telah memiliki faktur
        // atau riwayat perubahan stok terkait.
        return !$order->invoice()->exists()
            && !$order->stockMovements()->exists();
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

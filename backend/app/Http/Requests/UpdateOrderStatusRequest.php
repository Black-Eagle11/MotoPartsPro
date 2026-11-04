<?php

namespace App\Http\Requests;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route dan controller tetap wajib memeriksa role serta Policy.
        return $this->user()?->is_active ?? false;
    }

    private function currentOrder(): ?Order
    {
        $routeOrder = $this->route('order')
            ?? $this->route('id');

        if ($routeOrder instanceof Order) {
            return $routeOrder;
        }

        if (
            (is_int($routeOrder) ||
                (is_string($routeOrder) &&
                    ctype_digit($routeOrder)))
            && (int) $routeOrder > 0
        ) {
            return Order::query()->find((int) $routeOrder);
        }

        return null;
    }

    private function allowedNextStatuses(): array
    {
        $order = $this->currentOrder();

        if (!$order) {
            return [];
        }

        return match ($order->status) {
            Order::STATUS_PENDING => [
                Order::STATUS_CONFIRMED,
                Order::STATUS_CANCELLED,
            ],

            Order::STATUS_CONFIRMED => [
                Order::STATUS_PROCESSING,
            ],

            Order::STATUS_PROCESSING => [
                Order::STATUS_SHIPPED,
            ],

            Order::STATUS_SHIPPED => [
                Order::STATUS_COMPLETED,
            ],

            default => [],
        };
    }

    public function rules(): array
    {
        return [
            'status' => [
                'required',
                'string',
                Rule::in($this->allowedNextStatuses()),
            ],

            // Semua informasi transaksi lain harus dikelola server.
            'order_id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'order_number' => ['prohibited'],
            'subtotal' => ['prohibited'],
            'discount_amount' => ['prohibited'],
            'shipping_cost' => ['prohibited'],
            'tax_amount' => ['prohibited'],
            'total_amount' => ['prohibited'],
            'stock' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' =>
                'Status pesanan wajib dipilih.',
            'status.in' =>
                'Perubahan status pesanan tidak diperbolehkan.',
        ];
    }
}

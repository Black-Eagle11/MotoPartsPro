<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route harus dilindungi auth:sanctum dan role:admin,staff.
        // Policy produk tetap diperiksa oleh controller.
        return $this->user()?->is_active ?? false;
    }

    public function rules(): array
    {
        return [
            'product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id'),
            ],

            'movement_type' => [
                'required',
                'string',
                Rule::in([
                    StockMovement::TYPE_STOCK_IN,
                    StockMovement::TYPE_STOCK_OUT,
                    StockMovement::TYPE_ADJUSTMENT_IN,
                    StockMovement::TYPE_ADJUSTMENT_OUT,
                ]),
            ],

            'quantity' => [
                'required',
                'integer',
                'min:1',
                'max:1000000',
            ],

            'unit_cost' => [
                'sometimes',
                'nullable',
                'numeric',
                'decimal:0,2',
                'min:0',
                'max:9999999999.99',
            ],

            'notes' => [
                'required_if:movement_type,adjustment_in,adjustment_out',
                'nullable',
                'string',
                'max:2000',
            ],

            // Audit dan kepemilikan dicatat oleh backend.
            'user_id' => ['prohibited'],
            'order_id' => ['prohibited'],
            'quantity_before' => ['prohibited'],
            'quantity_after' => ['prohibited'],
            'stock' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'product_id.exists' =>
                'Produk tidak ditemukan.',
            'movement_type.in' =>
                'Tipe pergerakan stok tidak diperbolehkan.',
            'quantity.min' =>
                'Jumlah perubahan stok minimal 1.',
            'notes.required_if' =>
                'Catatan wajib diisi untuk penyesuaian stok.',
            'quantity_before.prohibited' =>
                'Stok sebelum perubahan dihitung oleh server.',
            'quantity_after.prohibited' =>
                'Stok setelah perubahan dihitung oleh server.',
        ];
    }
}

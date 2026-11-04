<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->is_active ?? false;
    }

    public function rules(): array
    {
        return [
            'items' => [
                'required',
                'array',
                'min:1',
                'max:50',
            ],

            // Hanya izinkan ID produk dan kuantitas pada setiap item.
            'items.*' => [
                'required',
                'array:product_id,quantity',
            ],

            'items.*.product_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('products', 'id')
                    ->where('is_active', true),
            ],

            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:10000',
            ],

            'shipping_name' => [
                'required',
                'string',
                'min:2',
                'max:120',
            ],

            'shipping_phone' => [
                'required',
                'string',
                'max:30',
                'regex:/^[0-9+().\-\s]+$/',
            ],

            'shipping_address' => [
                'required',
                'string',
                'max:1000',
            ],

            'shipping_city' => [
                'required',
                'string',
                'max:100',
            ],

            'shipping_province' => [
                'required',
                'string',
                'max:100',
            ],

            'shipping_postal_code' => [
                'required',
                'string',
                'max:20',
            ],

            'notes' => [
                'sometimes',
                'nullable',
                'string',
                'max:2000',
            ],

            // Kolom sistem tidak boleh ditentukan oleh pelanggan.
            'user_id' => ['prohibited'],
            'order_id' => ['prohibited'],
            'order_number' => ['prohibited'],
            'status' => ['prohibited'],
            'subtotal' => ['prohibited'],
            'discount_amount' => ['prohibited'],
            'shipping_cost' => ['prohibited'],
            'tax_amount' => ['prohibited'],
            'total_amount' => ['prohibited'],
            'price' => ['prohibited'],
            'unit_price' => ['prohibited'],
            'invoice' => ['prohibited'],
            'stock' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' =>
                'Keranjang harus berisi minimal satu produk.',
            'items.max' =>
                'Maksimal 50 jenis produk per pesanan.',
            'items.*.array' =>
                'Setiap item hanya boleh berisi product_id dan quantity.',
            'items.*.product_id.exists' =>
                'Salah satu produk tidak ditemukan atau tidak aktif.',
            'items.*.product_id.distinct' =>
                'Produk yang sama tidak boleh dikirim berulang.',
            'items.*.quantity.min' =>
                'Kuantitas produk minimal 1.',
            'shipping_phone.regex' =>
                'Format nomor telepon tidak valid.',
            'total_amount.prohibited' =>
                'Total pesanan dihitung oleh server.',
        ];
    }
}

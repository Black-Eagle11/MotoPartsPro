<?php

namespace App\Http\Requests;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Controller tetap wajib memanggil ProductPolicy.
        return $this->user()?->is_active ?? false;
    }

    private function currentProduct(): ?Product
    {
        $routeProduct = $this->route('product');

        if ($routeProduct instanceof Product) {
            return $routeProduct;
        }

        if (
            (is_int($routeProduct) ||
                (is_string($routeProduct) &&
                    ctype_digit($routeProduct)))
            && (int) $routeProduct > 0
        ) {
            return Product::query()->find((int) $routeProduct);
        }

        return null;
    }

    /**
     * POST: field utama wajib diisi.
     * PATCH/PUT: field boleh tidak dikirim,
     * tetapi wajib valid jika dikirim.
     */
    private function requiredOnCreate(): array
    {
        return $this->isMethod('POST')
            ? ['required']
            : ['sometimes', 'required'];
    }

    public function rules(): array
    {
        $product = $this->currentProduct();
        $required = $this->requiredOnCreate();

        $uniqueSku = Rule::unique('products', 'sku');
        $uniqueSlug = Rule::unique('products', 'slug');

        if ($product) {
            $uniqueSku->ignore($product);
            $uniqueSlug->ignore($product);
        }

        return [
            'category_id' => [
                ...$required,
                'integer',
                Rule::exists('categories', 'id')
                    ->where('is_active', true),
            ],

            'sku' => [
                ...$required,
                'string',
                'max:64',
                'alpha_dash',
                $uniqueSku,
            ],

            'name' => [
                ...$required,
                'string',
                'min:2',
                'max:180',
            ],

            'slug' => [
                ...$required,
                'string',
                'max:200',
                'alpha_dash',
                $uniqueSlug,
            ],

            'brand' => [
                'sometimes',
                'nullable',
                'string',
                'max:120',
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
                'max:5000',
            ],

            'price' => [
                ...$required,
                'numeric',
                'decimal:0,2',
                'min:0',
                'max:9999999999.99',
            ],

            'cost_price' => [
                'sometimes',
                'nullable',
                'numeric',
                'decimal:0,2',
                'min:0',
                'max:9999999999.99',
            ],

            'min_stock' => [
                'sometimes',
                'integer',
                'min:0',
                'max:1000000',
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],

            'image' => [
                'sometimes',
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:2048',
                'dimensions:max_width=4000,max_height=4000',
            ],

            // Path file harus dihasilkan oleh backend setelah upload.
            'image_path' => ['prohibited'],

            // Stok hanya dapat berubah melalui InventoryService.
            'stock' => ['prohibited'],
            'quantity' => ['prohibited'],
            'quantity_before' => ['prohibited'],
            'quantity_after' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.exists' =>
                'Kategori tidak ditemukan atau sedang tidak aktif.',

            'sku.unique' =>
                'SKU sudah digunakan produk lain.',

            'slug.unique' =>
                'Slug sudah digunakan produk lain.',

            'price.decimal' =>
                'Harga maksimal memiliki dua angka desimal.',

            'image.image' =>
                'File yang diunggah harus berupa gambar.',

            'image.mimes' =>
                'Gambar harus berformat JPG, PNG, atau WebP.',

            'image.max' =>
                'Ukuran gambar maksimal 2 MB.',

            'stock.prohibited' =>
                'Stok hanya boleh diubah melalui modul inventori.',

            'image_path.prohibited' =>
                'Path gambar ditentukan oleh server.',
        ];
    }
}

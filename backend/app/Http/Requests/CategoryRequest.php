<?php

namespace App\Http\Requests;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Controller tetap wajib memanggil CategoryPolicy.
        return $this->user()?->is_active ?? false;
    }

    private function currentCategory(): ?Category
    {
        $routeCategory = $this->route('category');

        if ($routeCategory instanceof Category) {
            return $routeCategory;
        }

        if (
            (
                is_int($routeCategory)
                || (
                    is_string($routeCategory)
                    && ctype_digit($routeCategory)
                )
            )
            && (int) $routeCategory > 0
        ) {
            return Category::query()->find((int) $routeCategory);
        }

        return null;
    }

    private function requiredOnCreate(): array
    {
        return $this->isMethod('POST')
            ? ['required']
            : ['sometimes', 'required'];
    }

    public function rules(): array
    {
        $category = $this->currentCategory();
        $required = $this->requiredOnCreate();

        $uniqueName = Rule::unique('categories', 'name');
        $uniqueSlug = Rule::unique('categories', 'slug');

        if ($category) {
            $uniqueName->ignore($category);
            $uniqueSlug->ignore($category);
        }

        return [
            'name' => [
                ...$required,
                'string',
                'min:2',
                'max:120',
                $uniqueName,
            ],

            'slug' => [
                ...$required,
                'string',
                'max:150',
                'alpha_dash',
                $uniqueSlug,
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
                'max:2000',
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],

            // Relasi produk tidak boleh diubah melalui input kategori.
            'products' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' =>
                'Nama kategori sudah digunakan.',

            'slug.unique' =>
                'Slug kategori sudah digunakan.',

            'slug.alpha_dash' =>
                'Slug hanya boleh memuat huruf, angka, tanda hubung, dan garis bawah.',

            'products.prohibited' =>
                'Relasi produk dikelola melalui modul produk.',
        ];
    }
}

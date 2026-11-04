<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_active' => (bool) $this->is_active,

            'products_count' => $this->whenCounted('products'),

            'products' => $this->whenLoaded(
                'products',
                fn() => $this->products->map(
                    static function (Product $product): array {
                        return [
                            'id' => $product->id,
                            'category_id' => $product->category_id,
                            'sku' => $product->sku,
                            'name' => $product->name,
                            'slug' => $product->slug,
                            'price' => $product->price,
                            'stock' => (int) $product->stock,
                            'is_active' => (bool) $product->is_active,
                        ];
                    }
                )->values()
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

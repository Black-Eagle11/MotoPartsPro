<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        $canViewCost = $user !== null
            && $user->can('viewCost', $this->resource);

        return [
            'id' => $this->id,

            'category_id' => $this->category_id,

            'sku' => $this->sku,
            'name' => $this->name,
            'slug' => $this->slug,
            'brand' => $this->brand,
            'description' => $this->description,

            // Harga jual dapat ditampilkan pada katalog.
            // Decimal tetap berbentuk string sesuai cast Eloquent.
            'price' => $this->price,

            // Harga modal hanya ditampilkan jika diizinkan Policy.
            'cost_price' => $this->when(
                $canViewCost,
                fn() => $this->cost_price,
            ),

            'stock' => (int) $this->stock,
            'min_stock' => (int) $this->min_stock,

            'is_low_stock' => $this->isLowStock(),
            'is_active' => (bool) $this->is_active,

            // File harus disimpan pada public disk dan storage:link
            // harus sudah dibuat.
            'image_url' => $this->when(
                filled($this->image_path),
                fn(): string => asset(
                    'storage/' . ltrim(
                        (string) $this->image_path,
                        '/'
                    )
                ),
            ),

            // Relasi tidak dipanggil jika belum di-load.
            'category' => $this->whenLoaded(
                'category',
                fn() => new CategoryResource($this->category),
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

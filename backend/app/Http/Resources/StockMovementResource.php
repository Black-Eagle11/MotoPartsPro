<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        $canViewCost = $viewer !== null
            && $this->resource->relationLoaded('product')
            && $this->product instanceof Product
            && $viewer->can('viewCost', $this->product);

        return [
            'id' => $this->id,

            'product_id' => $this->product_id,
            'user_id' => $this->user_id,
            'order_id' => $this->order_id,

            'movement_type' => $this->movement_type,

            'quantity' => (int) $this->quantity,
            'quantity_before' => (int) $this->quantity_before,
            'quantity_after' => (int) $this->quantity_after,

            'unit_cost' => $this->when(
                $canViewCost,
                $this->unit_cost
            ),

            'notes' => $this->notes,

            'is_inbound' => $this->isInbound(),
            'is_outbound' => $this->isOutbound(),

            'product' => $this->when(
                $this->resource->relationLoaded('product'),
                fn() => $this->product ? [
                    'id' => $this->product->id,
                    'sku' => $this->product->sku,
                    'name' => $this->product->name,
                ] : null
            ),

            'user' => $this->when(
                $this->resource->relationLoaded('user'),
                fn() => $this->user ? [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                ] : null
            ),

            'order' => $this->when(
                $this->resource->relationLoaded('order'),
                fn() => $this->order ? [
                    'id' => $this->order->id,
                    'order_number' => $this->order->order_number,
                    'status' => $this->order->status,
                ] : null
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

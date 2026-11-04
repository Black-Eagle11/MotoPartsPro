<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        $canViewOrder = $viewer?->can(
            'view',
            $this->resource
        ) ?? false;

        return [
            'id' => $this->id,

            'order_number' => $this->when(
                $canViewOrder,
                $this->order_number
            ),

            'user_id' => $this->when(
                $canViewOrder,
                $this->user_id
            ),

            'status' => $this->when(
                $canViewOrder,
                $this->status
            ),

            'subtotal' => $this->when(
                $canViewOrder,
                $this->subtotal
            ),

            'discount_amount' => $this->when(
                $canViewOrder,
                $this->discount_amount
            ),

            'shipping_cost' => $this->when(
                $canViewOrder,
                $this->shipping_cost
            ),

            'tax_amount' => $this->when(
                $canViewOrder,
                $this->tax_amount
            ),

            'total_amount' => $this->when(
                $canViewOrder,
                $this->total_amount
            ),

            'shipping' => $this->when(
                $canViewOrder,
                fn() => [
                    'name' => $this->shipping_name,
                    'phone' => $this->shipping_phone,
                    'address' => $this->shipping_address,
                    'city' => $this->shipping_city,
                    'province' => $this->shipping_province,
                    'postal_code' => $this->shipping_postal_code,
                ]
            ),

            'notes' => $this->when(
                $canViewOrder,
                $this->notes
            ),

            'placed_at' => $this->when(
                $canViewOrder,
                $this->placed_at
            ),

            'user' => $this->when(
                $canViewOrder && $this->resource->relationLoaded('user'),
                fn() => $this->user ? [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'email' => $this->user->email,
                ] : null
            ),

            'items' => $this->when(
                $canViewOrder && $this->resource->relationLoaded('items'),
                fn() => $this->items->map(
                    static fn($item): array => [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name,
                        'product_sku' => $item->product_sku,
                        'quantity' => (int) $item->quantity,
                        'unit_price' => $item->unit_price,
                        'line_total' => $item->line_total,
                    ]
                )->values()
            ),

            'invoice' => $this->when(
                $canViewOrder && $this->resource->relationLoaded('invoice'),
                fn() => $this->invoice ? [
                    'id' => $this->invoice->id,
                    'invoice_number' => $this->invoice->invoice_number,
                    'status' => $this->invoice->status,
                    'subtotal' => $this->invoice->subtotal,
                    'discount_amount' => $this->invoice->discount_amount,
                    'shipping_cost' => $this->invoice->shipping_cost,
                    'tax_amount' => $this->invoice->tax_amount,
                    'total_amount' => $this->invoice->total_amount,
                    'payment_method' => $this->invoice->payment_method,
                    'issued_at' => $this->invoice->issued_at,
                    'due_at' => $this->invoice->due_at,
                    'paid_at' => $this->invoice->paid_at,
                ] : null
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();

        $user->forceFill([
            'role' => $role,
            'is_active' => true,
        ])->save();

        return $user->fresh();
    }

    private function productWithStock(int $stock): Product
    {
        $category = Category::factory()->create([
            'is_active' => true,
        ]);

        $product = Product::factory()
            ->for($category)
            ->create([
                'price' => '25000.00',
                'cost_price' => '15000.00',
                'is_active' => true,
            ]);

        // Stok diinisialisasi untuk fixture pengujian.
        $product->stock = $stock;
        $product->save();

        return $product->fresh();
    }

    private function checkoutPayload(
        Product $product,
        int $quantity = 2,
    ): array {
        return [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                ],
            ],

            'shipping_name' => 'Customer Test',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jalan Pengujian Nomor 10',
            'shipping_city' => 'Garut',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '44100',
            'notes' => 'Pengujian checkout',
        ];
    }

    public function test_checkout_creates_order_invoice_and_stock_movement(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);
        $product = $this->productWithStock(10);

        Sanctum::actingAs($member);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 2),
        );

        $response
            ->assertCreated()
            ->assertJsonPath('data.status', Order::STATUS_PENDING)
            ->assertJsonPath('data.subtotal', '50000.00')
            ->assertJsonPath('data.total_amount', '50000.00');

        $orderId = $response->json('data.id');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'user_id' => $member->id,
            'status' => Order::STATUS_PENDING,
            'subtotal' => '50000.00',
            'total_amount' => '50000.00',
        ]);

        $this->assertDatabaseHas('order_items', [
            'order_id' => $orderId,
            'product_id' => $product->id,
            'quantity' => 2,
            'unit_price' => '25000.00',
            'line_total' => '50000.00',
        ]);

        $this->assertDatabaseHas('invoices', [
            'order_id' => $orderId,
            'status' => Invoice::STATUS_UNPAID,
            'total_amount' => '50000.00',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'order_id' => $orderId,
            'movement_type' => StockMovement::TYPE_SALE,
            'quantity' => 2,
            'quantity_before' => 10,
            'quantity_after' => 8,
        ]);

        $this->assertSame(8, (int) $product->fresh()->stock);
    }

    public function test_checkout_rejects_insufficient_stock(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);
        $product = $this->productWithStock(1);

        Sanctum::actingAs($member);

        $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 2),
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('invoices', 0);
        $this->assertDatabaseCount('stock_movements', 0);

        $this->assertSame(1, (int) $product->fresh()->stock);
    }

    public function test_checkout_does_not_accept_client_supplied_total(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);
        $product = $this->productWithStock(5);

        Sanctum::actingAs($member);

        $payload = $this->checkoutPayload($product, 1);
        $payload['total_amount'] = '1.00';

        $this->postJson('/api/orders', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['total_amount']);

        $this->assertDatabaseCount('orders', 0);

        $this->assertSame(5, (int) $product->fresh()->stock);
    }

    public function test_member_cannot_see_another_members_orders(): void
    {
        $firstMember = $this->userWithRole(User::ROLE_MEMBER);
        $secondMember = $this->userWithRole(User::ROLE_MEMBER);
        $product = $this->productWithStock(10);

        Sanctum::actingAs($firstMember);

        $createdOrder = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1),
        )->assertCreated();

        $this->assertDatabaseHas('orders', [
            'id' => $createdOrder->json('data.id'),
            'user_id' => $firstMember->id,
        ]);

        Sanctum::actingAs($secondMember);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson(
            '/api/orders/' . $createdOrder->json('data.id')
        )->assertForbidden();
    }

    public function test_cancelling_pending_order_restores_stock_once(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);
        $product = $this->productWithStock(5);

        Sanctum::actingAs($member);

        $createdOrder = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 2),
        )->assertCreated();

        $orderId = $createdOrder->json('data.id');

        $this->assertSame(3, (int) $product->fresh()->stock);

        $this->patchJson("/api/orders/{$orderId}/cancel")
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                Order::STATUS_CANCELLED,
            );

        $this->assertSame(5, (int) $product->fresh()->stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'order_id' => $orderId,
            'movement_type' => StockMovement::TYPE_STOCK_IN,
            'quantity' => 2,
            'quantity_before' => 3,
            'quantity_after' => 5,
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => Order::STATUS_CANCELLED,
        ]);

        $this->assertDatabaseHas('invoices', [
            'order_id' => $orderId,
            'status' => Invoice::STATUS_VOID,
        ]);

        // Pembatalan kedua harus ditolak dan tidak boleh
        // mengembalikan stok untuk kedua kalinya.
        $this->patchJson("/api/orders/{$orderId}/cancel")
            ->assertForbidden();

        $this->assertSame(5, (int) $product->fresh()->stock);
    }

    public function test_admin_can_confirm_pending_order(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $product = $this->productWithStock(5);

        Sanctum::actingAs($member);

        $createdOrder = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1),
        )->assertCreated();

        $orderId = $createdOrder->json('data.id');

        Sanctum::actingAs($admin);

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_CONFIRMED,
        ])
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                Order::STATUS_CONFIRMED,
            );

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => Order::STATUS_CONFIRMED,
        ]);
    }

    public function test_pending_order_cannot_skip_directly_to_completed(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $product = $this->productWithStock(5);

        Sanctum::actingAs($member);

        $createdOrder = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1),
        )->assertCreated();

        $orderId = $createdOrder->json('data.id');

        Sanctum::actingAs($admin);

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_COMPLETED,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => Order::STATUS_PENDING,
        ]);
    }
}

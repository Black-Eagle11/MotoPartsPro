<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryApiTest extends TestCase
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
        $category = Category::factory()->create();

        $product = Product::factory()
            ->for($category)
            ->create([
                'stock' => 0,
                'is_active' => true,
            ]);

        // Stok hanya diubah melalui assignment langsung di fixture
        // pengujian, bukan melalui mass assignment API.
        $product->stock = $stock;
        $product->save();

        return $product->fresh();
    }

    public function test_admin_can_record_stock_in(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $product = $this->productWithStock(10);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/inventory/adjustments', [
            'product_id' => $product->id,
            'movement_type' => StockMovement::TYPE_STOCK_IN,
            'quantity' => 5,
            'unit_cost' => '20000.00',
            'notes' => 'Penerimaan stok',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.product_id', $product->id)
            ->assertJsonPath('data.movement_type', 'stock_in')
            ->assertJsonPath('data.quantity_before', 10)
            ->assertJsonPath('data.quantity_after', 15);

        $this->assertSame(15, (int) $product->fresh()->stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'user_id' => $admin->id,
            'movement_type' => 'stock_in',
            'quantity' => 5,
            'quantity_before' => 10,
            'quantity_after' => 15,
        ]);
    }

    public function test_staff_can_record_stock_in(): void
    {
        $staff = $this->userWithRole(User::ROLE_STAFF);
        $product = $this->productWithStock(4);

        Sanctum::actingAs($staff);

        $this->postJson('/api/inventory/adjustments', [
            'product_id' => $product->id,
            'movement_type' => StockMovement::TYPE_STOCK_IN,
            'quantity' => 2,
            'notes' => 'Stok masuk oleh Staff',
        ])
            ->assertCreated()
            ->assertJsonPath('data.quantity_after', 6);

        $this->assertSame(6, (int) $product->fresh()->stock);
    }

    public function test_stock_cannot_be_reduced_below_zero(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $product = $this->productWithStock(3);

        Sanctum::actingAs($admin);

        $this->postJson('/api/inventory/adjustments', [
            'product_id' => $product->id,
            'movement_type' => StockMovement::TYPE_STOCK_OUT,
            'quantity' => 10,
            'notes' => 'Pengujian stok tidak mencukupi',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quantity']);

        $this->assertSame(3, (int) $product->fresh()->stock);

        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_zero_quantity_is_rejected(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $product = $this->productWithStock(3);

        Sanctum::actingAs($admin);

        $this->postJson('/api/inventory/adjustments', [
            'product_id' => $product->id,
            'movement_type' => StockMovement::TYPE_STOCK_IN,
            'quantity' => 0,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quantity']);

        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_sale_movement_cannot_be_submitted_as_manual_adjustment(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $product = $this->productWithStock(5);

        Sanctum::actingAs($admin);

        $this->postJson('/api/inventory/adjustments', [
            'product_id' => $product->id,
            'movement_type' => StockMovement::TYPE_SALE,
            'quantity' => 1,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['movement_type']);

        $this->assertSame(5, (int) $product->fresh()->stock);
    }

    public function test_member_cannot_access_inventory(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);

        Sanctum::actingAs($member);

        $this->getJson('/api/inventory/movements')
            ->assertForbidden();

        $this->postJson('/api/inventory/adjustments', [
            'product_id' => 1,
            'movement_type' => StockMovement::TYPE_STOCK_IN,
            'quantity' => 1,
        ])->assertForbidden();
    }
}

<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductApiTest extends TestCase
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

    private function productPayload(Category $category): array
    {
        return [
            'category_id' => $category->id,
            'sku' => 'MTP-TEST-1001',
            'name' => 'Rantai Motor Test',
            'slug' => 'rantai-motor-test',
            'brand' => 'Universal',
            'description' => 'Produk untuk pengujian API.',
            'price' => '125000.00',
            'cost_price' => '95000.00',
            'min_stock' => 5,
            'is_active' => true,
        ];
    }

    public function test_member_sees_active_products_without_cost_price(): void
    {
        $category = Category::factory()->create([
            'is_active' => true,
        ]);

        $visibleProduct = Product::factory()
            ->for($category)
            ->create([
                'name' => 'CHAIN-TEST-ACTIVE',
                'slug' => 'chain-test-active',
                'sku' => 'MTP-CHAIN-ACTIVE',
                'price' => '50000.00',
                'cost_price' => '30000.00',
                'is_active' => true,
            ]);

        Product::factory()
            ->for($category)
            ->inactive()
            ->create([
                'name' => 'CHAIN-TEST-INACTIVE',
                'slug' => 'chain-test-inactive',
                'sku' => 'MTP-CHAIN-INACTIVE',
            ]);

        $member = $this->userWithRole(User::ROLE_MEMBER);

        Sanctum::actingAs($member);

        $response = $this->getJson(
            '/api/products?search=CHAIN-TEST&per_page=10&page=1'
        );

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visibleProduct->id)
            ->assertJsonMissingPath('data.0.cost_price');
    }

    public function test_admin_can_create_product(): void
    {
        $category = Category::factory()->create();

        $admin = $this->userWithRole(User::ROLE_ADMIN);

        Sanctum::actingAs($admin);

        $response = $this->postJson(
            '/api/products',
            $this->productPayload($category),
        );

        $response
            ->assertCreated()
            ->assertJsonPath('data.sku', 'MTP-TEST-1001')
            ->assertJsonPath('data.category_id', $category->id);

        $this->assertDatabaseHas('products', [
            'sku' => 'MTP-TEST-1001',
            'name' => 'Rantai Motor Test',
            'category_id' => $category->id,
            'price' => '125000.00',
            'cost_price' => '95000.00',
        ]);
    }

    public function test_duplicate_sku_is_rejected(): void
    {
        $category = Category::factory()->create();

        Product::factory()->for($category)->create([
            'sku' => 'MTP-TEST-1001',
            'slug' => 'existing-rantai-test',
        ]);

        $admin = $this->userWithRole(User::ROLE_ADMIN);

        Sanctum::actingAs($admin);

        $payload = $this->productPayload($category);

        $this->postJson('/api/products', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sku']);
    }

    public function test_member_cannot_create_product(): void
    {
        $category = Category::factory()->create();

        $member = $this->userWithRole(User::ROLE_MEMBER);

        Sanctum::actingAs($member);

        $this->postJson(
            '/api/products',
            $this->productPayload($category),
        )->assertForbidden();

        $this->assertDatabaseMissing('products', [
            'sku' => 'MTP-TEST-1001',
        ]);
    }

    public function test_product_search_and_pagination_work(): void
    {
        $category = Category::factory()->create();

        $firstProduct = Product::factory()
            ->for($category)
            ->create([
                'name' => 'FILTER-TEST-ALPHA',
                'slug' => 'filter-test-alpha',
                'sku' => 'MTP-FILTER-001',
            ]);

        Product::factory()
            ->for($category)
            ->create([
                'name' => 'FILTER-TEST-BETA',
                'slug' => 'filter-test-beta',
                'sku' => 'MTP-FILTER-002',
            ]);

        $admin = $this->userWithRole(User::ROLE_ADMIN);

        Sanctum::actingAs($admin);

        $response = $this->getJson(
            '/api/products?search=FILTER-TEST&sort=name&direction=asc&per_page=1&page=1'
        );

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $firstProduct->id)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 2);
    }

    public function test_product_stock_cannot_be_changed_through_product_crud(): void
    {
        $category = Category::factory()->create();

        $product = Product::factory()
            ->for($category)
            ->create([
                'sku' => 'MTP-STOCK-TEST',
                'slug' => 'stock-test-product',
            ]);

        $product->stock = 10;
        $product->save();

        $admin = $this->userWithRole(User::ROLE_ADMIN);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/products/{$product->id}", [
            'stock' => 100,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['stock']);

        $this->assertSame(
            10,
            (int) $product->fresh()->stock,
        );
    }
}

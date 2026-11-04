<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $sku = 'MTP-' . fake()->unique()->numerify('######');
        $name = fake()->words(3, true);

        $costPrice = fake()->numberBetween(5_000, 400_000);

        $sellingPrice = fake()->numberBetween(
            $costPrice + 1_000,
            $costPrice + 250_000
        );

        return [
            'category_id' => Category::factory(),

            'sku' => $sku,
            'name' => $name,
            'slug' => Str::slug($name . '-' . $sku),

            'brand' => fake()->randomElement([
                'Honda',
                'Yamaha',
                'Suzuki',
                'Kawasaki',
                'Universal',
            ]),

            'description' => fake()->sentence(),

            'price' => $sellingPrice,
            'cost_price' => $costPrice,

            'stock' => fake()->numberBetween(0, 100),
            'min_stock' => fake()->numberBetween(3, 10),

            // File gambar belum diunggah.
            'image_path' => null,

            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn(array $attributes): array => [
            'is_active' => false,
        ]);
    }

    public function lowStock(): static
    {
        return $this->state(fn(array $attributes): array => [
            'stock' => 0,
            'min_stock' => 5,
        ]);
    }
}

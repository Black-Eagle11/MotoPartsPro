<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('category_id')
                ->constrained('categories')
                ->restrictOnDelete();

            $table->string('sku', 64)->unique();
            $table->string('name', 180);
            $table->string('slug', 200)->unique();
            $table->string('brand', 120)->nullable();
            $table->text('description')->nullable();

            $table->decimal('price', 12, 2)->default(0);
            $table->decimal('cost_price', 12, 2)->nullable();

            $table->unsignedInteger('stock')->default(0);
            $table->unsignedInteger('min_stock')->default(5);

            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(['category_id', 'is_active']);
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};

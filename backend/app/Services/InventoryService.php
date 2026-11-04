<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class InventoryService
{
  private const MAX_QUANTITY = 1_000_000;

  /**
   * Penyesuaian stok manual oleh Admin atau Staff.
   */
  public function adjustStock(
    Product $product,
    User $actor,
    string $movementType,
    int $quantity,
    ?string $notes = null,
    int|float|string|null $unitCost = null,
  ): StockMovement {
    Gate::forUser($actor)->authorize('adjustStock', $product);

    $manualTypes = [
      StockMovement::TYPE_STOCK_IN,
      StockMovement::TYPE_STOCK_OUT,
      StockMovement::TYPE_ADJUSTMENT_IN,
      StockMovement::TYPE_ADJUSTMENT_OUT,
    ];

    if (!in_array($movementType, $manualTypes, true)) {
      throw ValidationException::withMessages([
        'movement_type' =>
          'Tipe pergerakan stok tidak diperbolehkan untuk penyesuaian manual.',
      ]);
    }

    $this->assertQuantity($quantity);

    if (
      str_starts_with($movementType, 'adjustment_') &&
      blank($notes)
    ) {
      throw ValidationException::withMessages([
        'notes' => 'Catatan wajib untuk penyesuaian stok.',
      ]);
    }

    if (
      $unitCost !== null &&
      (!is_numeric($unitCost) || (float) $unitCost < 0)
    ) {
      throw ValidationException::withMessages([
        'unit_cost' => 'Harga modal tidak valid.',
      ]);
    }

    return DB::transaction(function () use ($product, $actor, $movementType, $quantity, $notes, $unitCost): StockMovement {
      $lockedProduct = Product::query()
        ->whereKey($product->getKey())
        ->lockForUpdate()
        ->firstOrFail();

      return $this->applyMovement(
        product: $lockedProduct,
        actor: $actor,
        order: null,
        movementType: $movementType,
        quantity: $quantity,
        unitCost: $unitCost === null
        ? $lockedProduct->cost_price
        : (string) $unitCost,
        notes: $notes,
      );
    }, 3);
  }

  /**
   * Kurangi stok untuk pesanan yang baru dibuat.
   * Dipanggil dari OrderService dalam transaksi checkout.
   */
  public function decreaseForSale(
    Product $product,
    User $actor,
    Order $order,
    int $quantity,
  ): StockMovement {
    $this->assertQuantity($quantity);

    return DB::transaction(function () use ($product, $actor, $order, $quantity): StockMovement {
      $lockedProduct = Product::query()
        ->whereKey($product->getKey())
        ->lockForUpdate()
        ->firstOrFail();

      if (!$lockedProduct->is_active) {
        throw ValidationException::withMessages([
          'items' => 'Produk tidak lagi aktif.',
        ]);
      }

      return $this->applyMovement(
        product: $lockedProduct,
        actor: $actor,
        order: $order,
        movementType: StockMovement::TYPE_SALE,
        quantity: $quantity,
        unitCost: $lockedProduct->cost_price,
        notes: "Pengurangan stok untuk pesanan {$order->order_number}.",
      );
    }, 3);
  }

  /**
   * Kembalikan stok saat pesanan yang memenuhi syarat dibatalkan.
   */
  public function restoreForCancelledOrder(
    Product $product,
    User $actor,
    Order $order,
    int $quantity,
  ): StockMovement {
    $this->assertQuantity($quantity);

    return DB::transaction(function () use ($product, $actor, $order, $quantity): StockMovement {
      $lockedProduct = Product::query()
        ->whereKey($product->getKey())
        ->lockForUpdate()
        ->firstOrFail();

      return $this->applyMovement(
        product: $lockedProduct,
        actor: $actor,
        order: $order,
        movementType: StockMovement::TYPE_STOCK_IN,
        quantity: $quantity,
        unitCost: $lockedProduct->cost_price,
        notes: "Pengembalian stok karena pesanan {$order->order_number} dibatalkan.",
      );
    }, 3);
  }

  private function applyMovement(
    Product $product,
    User $actor,
    ?Order $order,
    string $movementType,
    int $quantity,
    int|float|string|null $unitCost,
    ?string $notes,
  ): StockMovement {
    $inboundTypes = [
      StockMovement::TYPE_STOCK_IN,
      StockMovement::TYPE_RETURN,
      StockMovement::TYPE_ADJUSTMENT_IN,
    ];

    $outboundTypes = [
      StockMovement::TYPE_STOCK_OUT,
      StockMovement::TYPE_SALE,
      StockMovement::TYPE_ADJUSTMENT_OUT,
    ];

    $currentStock = (int) $product->stock;

    if (in_array($movementType, $outboundTypes, true)) {
      if ($currentStock < $quantity) {
        throw ValidationException::withMessages([
          'quantity' => 'Stok tidak mencukupi untuk perubahan ini.',
        ]);
      }

      $newStock = $currentStock - $quantity;
    } elseif (in_array($movementType, $inboundTypes, true)) {
      $newStock = $currentStock + $quantity;

      if ($newStock > self::MAX_QUANTITY) {
        throw ValidationException::withMessages([
          'quantity' => 'Jumlah stok melebihi batas sistem.',
        ]);
      }
    } else {
      throw ValidationException::withMessages([
        'movement_type' => 'Tipe pergerakan stok tidak dikenal.',
      ]);
    }

    // Simpan stok dan log dalam transaksi yang sama.
    $product->stock = $newStock;
    $product->save();

    $movement = new StockMovement();
    $movement->product_id = $product->id;
    $movement->user_id = $actor->id;
    $movement->order_id = $order?->id;
    $movement->movement_type = $movementType;
    $movement->quantity = $quantity;
    $movement->quantity_before = $currentStock;
    $movement->quantity_after = $newStock;
    $movement->unit_cost = $unitCost;
    $movement->notes = $notes;
    $movement->save();

    return $movement;
  }

  private function assertQuantity(int $quantity): void
  {
    if ($quantity < 1 || $quantity > self::MAX_QUANTITY) {
      throw ValidationException::withMessages([
        'quantity' => 'Kuantitas harus antara 1 dan 1.000.000.',
      ]);
    }
  }
}

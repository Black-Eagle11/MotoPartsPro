<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
  private const MAX_MONEY_CENTS = 999_999_999_999;
  private const MAX_QUANTITY = 10_000;

  public function __construct(
    private readonly InventoryService $inventoryService,
  ) {
  }

  /**
   * Membuat pesanan, item, invoice, dan mutasi stok
   * sebagai satu transaksi database.
   *
   * Data harus berasal dari CheckoutRequest::validated().
   */
  public function checkout(User $user, array $data): Order
  {
    Gate::forUser($user)->authorize('create', Order::class);

    $items = $data['items'] ?? null;

    if (!is_array($items) || $items === []) {
      throw ValidationException::withMessages([
        'items' => 'Keranjang tidak boleh kosong.',
      ]);
    }

    $quantities = [];

    foreach ($items as $index => $item) {
      if (!is_array($item)) {
        throw ValidationException::withMessages([
          "items.{$index}" => 'Format item tidak valid.',
        ]);
      }

      $productId = filter_var(
        $item['product_id'] ?? null,
        FILTER_VALIDATE_INT,
      );

      $quantity = filter_var(
        $item['quantity'] ?? null,
        FILTER_VALIDATE_INT,
      );

      if ($productId === false || $productId < 1) {
        throw ValidationException::withMessages([
          "items.{$index}.product_id" =>
            'ID produk tidak valid.',
        ]);
      }

      if (
        $quantity === false ||
        $quantity < 1 ||
        $quantity > self::MAX_QUANTITY
      ) {
        throw ValidationException::withMessages([
          "items.{$index}.quantity" =>
            'Kuantitas produk tidak valid.',
        ]);
      }

      if (array_key_exists($productId, $quantities)) {
        throw ValidationException::withMessages([
          'items' =>
            'Produk yang sama tidak boleh dikirim berulang.',
        ]);
      }

      $quantities[$productId] = $quantity;
    }

    // Kunci produk dengan urutan ID konsisten.
    ksort($quantities, SORT_NUMERIC);

    return DB::transaction(function () use ($user, $data, $quantities): Order {
      $productIds = array_keys($quantities);

      $products = Product::query()
        ->whereIn('id', $productIds)
        ->orderBy('id')
        ->lockForUpdate()
        ->get()
        ->keyBy('id');

      if ($products->count() !== count($productIds)) {
        throw ValidationException::withMessages([
          'items' => 'Satu atau lebih produk tidak ditemukan.',
        ]);
      }

      $lines = [];
      $subtotalCents = 0;

      foreach ($quantities as $productId => $quantity) {
        /** @var Product $product */
        $product = $products->get($productId);

        if (!$product->is_active) {
          throw ValidationException::withMessages([
            'items' =>
              "Produk {$product->name} tidak aktif.",
          ]);
        }

        if ((int) $product->stock < $quantity) {
          throw ValidationException::withMessages([
            'items' =>
              "Stok {$product->name} tidak mencukupi.",
          ]);
        }

        $unitPriceCents = $this->toCents($product->price);
        $lineTotalCents = $unitPriceCents * $quantity;

        if ($lineTotalCents > self::MAX_MONEY_CENTS) {
          throw ValidationException::withMessages([
            'items' =>
              'Nilai salah satu baris pesanan terlalu besar.',
          ]);
        }

        if (
          $subtotalCents >
          self::MAX_MONEY_CENTS - $lineTotalCents
        ) {
          throw ValidationException::withMessages([
            'items' =>
              'Total pesanan melebihi batas sistem.',
          ]);
        }

        $subtotalCents += $lineTotalCents;

        $lines[] = [
          'product' => $product,
          'quantity' => $quantity,
          'unit_price_cents' => $unitPriceCents,
          'line_total_cents' => $lineTotalCents,
        ];
      }

      // Aturan ongkir, diskon, dan pajak belum dikonfigurasi.
      // Nilainya tetap nol hingga aturan bisnis ditetapkan.
      $discountCents = 0;
      $shippingCents = 0;
      $taxCents = 0;
      $totalCents = $subtotalCents;

      $order = new Order();

      $order->user_id = $user->id;
      $order->order_number = $this->uniqueOrderNumber();
      $order->status = Order::STATUS_PENDING;

      $this->setMoney($order, 'subtotal', $subtotalCents);
      $this->setMoney($order, 'discount_amount', $discountCents);
      $this->setMoney($order, 'shipping_cost', $shippingCents);
      $this->setMoney($order, 'tax_amount', $taxCents);
      $this->setMoney($order, 'total_amount', $totalCents);

      $order->shipping_name = $data['shipping_name'];
      $order->shipping_phone = $data['shipping_phone'];
      $order->shipping_address = $data['shipping_address'];
      $order->shipping_city = $data['shipping_city'];
      $order->shipping_province = $data['shipping_province'];
      $order->shipping_postal_code = $data['shipping_postal_code'];
      $order->notes = $data['notes'] ?? null;

      $order->setAttribute('placed_at', Carbon::now());

      $order->save();

      foreach ($lines as $line) {
        /** @var Product $product */
        $product = $line['product'];

        $item = new OrderItem();

        $item->order_id = $order->id;
        $item->product_id = $product->id;
        $item->product_name = $product->name;
        $item->product_sku = $product->sku;
        $item->quantity = $line['quantity'];

        $this->setMoney(
          $item,
          'unit_price',
          $line['unit_price_cents'],
        );

        $this->setMoney(
          $item,
          'line_total',
          $line['line_total_cents'],
        );

        $item->save();

        // InventoryService memakai transaksi dan lock sendiri.
        // Pemanggilan ini berada di dalam transaksi checkout,
        // sehingga semua perubahan ikut rollback jika gagal.
        $this->inventoryService->decreaseForSale(
          product: $product,
          actor: $user,
          order: $order,
          quantity: $line['quantity'],
        );
      }

      $invoice = new Invoice();

      $invoice->order_id = $order->id;
      $invoice->invoice_number = $this->uniqueInvoiceNumber();
      $invoice->status = Invoice::STATUS_UNPAID;

      $invoice->setAttribute('issued_at', Carbon::now());

      $this->setMoney($invoice, 'subtotal', $subtotalCents);
      $this->setMoney($invoice, 'discount_amount', $discountCents);
      $this->setMoney($invoice, 'shipping_cost', $shippingCents);
      $this->setMoney($invoice, 'tax_amount', $taxCents);
      $this->setMoney($invoice, 'total_amount', $totalCents);

      $invoice->save();

      return $order->fresh([
        'user',
        'items.product',
        'invoice',
      ]) ?? $order;
    }, 3);
  }

  /**
   * Mengubah status pesanan sesuai transisi yang diizinkan.
   */
  public function updateStatus(
    Order $order,
    User $actor,
    string $newStatus,
  ): Order {
    if (!in_array($newStatus, Order::STATUSES, true)) {
      throw ValidationException::withMessages([
        'status' => 'Status pesanan tidak dikenal.',
      ]);
    }

    if ($newStatus === Order::STATUS_CANCELLED) {
      return $this->cancel($order, $actor);
    }

    Gate::forUser($actor)->authorize('updateStatus', $order);

    return DB::transaction(function () use ($order, $actor, $newStatus): Order {
      $lockedOrder = Order::query()
        ->whereKey($order->getKey())
        ->lockForUpdate()
        ->firstOrFail();

      Gate::forUser($actor)->authorize(
        'updateStatus',
        $lockedOrder,
      );

      $allowedTransitions = match ($lockedOrder->status) {
        Order::STATUS_PENDING => [
          Order::STATUS_CONFIRMED,
        ],

        Order::STATUS_CONFIRMED => [
          Order::STATUS_PROCESSING,
        ],

        Order::STATUS_PROCESSING => [
          Order::STATUS_SHIPPED,
        ],

        Order::STATUS_SHIPPED => [
          Order::STATUS_COMPLETED,
        ],

        default => [],
      };

      if (!in_array($newStatus, $allowedTransitions, true)) {
        throw ValidationException::withMessages([
          'status' =>
            'Transisi status pesanan tidak diperbolehkan.',
        ]);
      }

      $lockedOrder->status = $newStatus;
      $lockedOrder->save();

      return $lockedOrder->fresh([
        'user',
        'items.product',
        'invoice',
      ]) ?? $lockedOrder;
    }, 3);
  }

  /**
   * Batalkan pesanan yang masih memenuhi syarat dan
   * kembalikan stok di dalam transaksi yang sama.
   */
  public function cancel(Order $order, User $actor): Order
  {
    Gate::forUser($actor)->authorize('cancel', $order);

    return DB::transaction(function () use ($order, $actor): Order {
      $lockedOrder = Order::query()
        ->whereKey($order->getKey())
        ->lockForUpdate()
        ->firstOrFail();

      Gate::forUser($actor)->authorize(
        'cancel',
        $lockedOrder,
      );

      if (!$lockedOrder->isCancellable()) {
        throw ValidationException::withMessages([
          'order' =>
            'Pesanan tidak dapat dibatalkan pada status ini.',
        ]);
      }

      $invoice = Invoice::query()
        ->where('order_id', $lockedOrder->id)
        ->lockForUpdate()
        ->first();

      if ($invoice?->status === Invoice::STATUS_PAID) {
        throw ValidationException::withMessages([
          'order' =>
            'Pesanan dengan faktur lunas memerlukan proses refund.',
        ]);
      }

      $items = $lockedOrder->items()
        ->orderBy('product_id')
        ->get();

      $productIds = $items
        ->pluck('product_id')
        ->unique()
        ->sort()
        ->values()
        ->all();

      $products = Product::query()
        ->whereIn('id', $productIds)
        ->orderBy('id')
        ->lockForUpdate()
        ->get()
        ->keyBy('id');

      foreach ($items as $item) {
        /** @var Product|null $product */
        $product = $products->get($item->product_id);

        if (!$product) {
          throw ValidationException::withMessages([
            'order' =>
              'Produk terkait pesanan tidak ditemukan.',
          ]);
        }

        $this->inventoryService->restoreForCancelledOrder(
          product: $product,
          actor: $actor,
          order: $lockedOrder,
          quantity: (int) $item->quantity,
        );
      }

      $lockedOrder->status = Order::STATUS_CANCELLED;
      $lockedOrder->save();

      if (
        $invoice &&
        $invoice->status !== Invoice::STATUS_VOID
      ) {
        $invoice->status = Invoice::STATUS_VOID;
        $invoice->save();
      }

      return $lockedOrder->fresh([
        'user',
        'items.product',
        'invoice',
      ]) ?? $lockedOrder;
    }, 3);
  }

  /**
   * Simpan nilai uang sebagai string desimal tanpa float.
   * setAttribute() menerima mixed dan menghindari masalah
   * analisis tipe pada properti Eloquent dinamis.
   */
  private function setMoney(
    Model $model,
    string $attribute,
    int $cents,
  ): void {
    $model->setAttribute(
      $attribute,
      $this->fromCents($cents),
    );
  }

  private function toCents(mixed $amount): int
  {
    $value = trim((string) $amount);

    if (!preg_match('/^\d+(?:\.\d{1,2})?$/D', $value)) {
      throw ValidationException::withMessages([
        'price' => 'Format nilai uang tidak valid.',
      ]);
    }

    [$whole, $fraction] = array_pad(
      explode('.', $value, 2),
      2,
      '',
    );

    $whole = ltrim($whole, '0') ?: '0';

    // DECIMAL(12,2): maksimal 10 digit sebelum desimal.
    if (strlen($whole) > 10) {
      throw ValidationException::withMessages([
        'price' => 'Nilai uang melebihi batas sistem.',
      ]);
    }

    $cents = ((int) $whole * 100)
      + (int) str_pad($fraction, 2, '0');

    if ($cents > self::MAX_MONEY_CENTS) {
      throw ValidationException::withMessages([
        'price' => 'Nilai uang melebihi batas sistem.',
      ]);
    }

    return $cents;
  }

  private function fromCents(int $cents): string
  {
    if (
      $cents < 0 ||
      $cents > self::MAX_MONEY_CENTS
    ) {
      throw ValidationException::withMessages([
        'total_amount' =>
          'Nilai transaksi di luar batas sistem.',
      ]);
    }

    return intdiv($cents, 100)
      . '.'
      . str_pad(
        (string) ($cents % 100),
        2,
        '0',
        STR_PAD_LEFT,
      );
  }

  private function uniqueOrderNumber(): string
  {
    do {
      $number = 'MTP-'
        . Carbon::now()->format('Ymd')
        . '-'
        . Str::upper(Str::random(8));
    } while (
      Order::query()
        ->where('order_number', $number)
        ->exists()
    );

    return $number;
  }

  private function uniqueInvoiceNumber(): string
  {
    do {
      $number = 'INV-'
        . Carbon::now()->format('Ymd')
        . '-'
        . Str::upper(Str::random(8));
    } while (
      Invoice::query()
        ->where('invoice_number', $number)
        ->exists()
    );

    return $number;
  }
}

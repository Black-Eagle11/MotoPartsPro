<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory;

    public const TYPE_STOCK_IN = 'stock_in';
    public const TYPE_STOCK_OUT = 'stock_out';
    public const TYPE_SALE = 'sale';
    public const TYPE_RETURN = 'return';
    public const TYPE_ADJUSTMENT_IN = 'adjustment_in';
    public const TYPE_ADJUSTMENT_OUT = 'adjustment_out';

    public const TYPES = [
        self::TYPE_STOCK_IN,
        self::TYPE_STOCK_OUT,
        self::TYPE_SALE,
        self::TYPE_RETURN,
        self::TYPE_ADJUSTMENT_IN,
        self::TYPE_ADJUSTMENT_OUT,
    ];

    protected $fillable = [
        'movement_type',
        'quantity',
        'unit_cost',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'product_id' => 'integer',
            'user_id' => 'integer',
            'order_id' => 'integer',
            'quantity' => 'integer',
            'quantity_before' => 'integer',
            'quantity_after' => 'integer',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function scopeType(
        Builder $query,
        string $type
    ): Builder {
        return $query->where('movement_type', $type);
    }

    public function isInbound(): bool
    {
        return in_array(
            $this->movement_type,
            [
                self::TYPE_STOCK_IN,
                self::TYPE_RETURN,
                self::TYPE_ADJUSTMENT_IN,
            ],
            true
        );
    }

    public function isOutbound(): bool
    {
        return in_array(
            $this->movement_type,
            [
                self::TYPE_STOCK_OUT,
                self::TYPE_SALE,
                self::TYPE_ADJUSTMENT_OUT,
            ],
            true
        );
    }
}

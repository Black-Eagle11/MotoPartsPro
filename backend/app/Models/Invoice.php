<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use HasFactory;

    public const STATUS_UNPAID = 'unpaid';
    public const STATUS_PAID = 'paid';
    public const STATUS_VOID = 'void';

    public const STATUSES = [
        self::STATUS_UNPAID,
        self::STATUS_PAID,
        self::STATUS_VOID,
    ];

    protected $fillable = [
        'payment_method',
        'payment_reference',
        'notes',
    ];

    protected $attributes = [
        'status' => self::STATUS_UNPAID,
        'subtotal' => 0,
        'discount_amount' => 0,
        'shipping_cost' => 0,
        'tax_amount' => 0,
        'total_amount' => 0,
    ];

    protected function casts(): array
    {
        return [
            'order_id' => 'integer',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'shipping_cost' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'issued_at' => 'datetime',
            'due_at' => 'date',
            'paid_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}

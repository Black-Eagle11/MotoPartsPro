<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StockAdjustmentRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventoryService,
    ) {
    }

    /**
     * Riwayat stok dengan filter dan pagination.
     */
    public function index(Request $request)
    {
        $actor = $this->inventoryActor($request);

        $filters = $request->validate([
            'product_id' => [
                'sometimes',
                'integer',
                Rule::exists('products', 'id'),
            ],

            'user_id' => [
                'sometimes',
                'integer',
                Rule::exists('users', 'id'),
            ],

            'order_id' => [
                'sometimes',
                'integer',
                Rule::exists('orders', 'id'),
            ],

            'movement_type' => [
                'sometimes',
                Rule::in(StockMovement::TYPES),
            ],

            'from' => [
                'sometimes',
                'date_format:Y-m-d',
            ],

            'to' => [
                'sometimes',
                'date_format:Y-m-d',
            ],

            'sort' => [
                'sometimes',
                Rule::in([
                    'id',
                    'movement_type',
                    'quantity',
                    'created_at',
                ]),
            ],

            'direction' => [
                'sometimes',
                Rule::in(['asc', 'desc']),
            ],

            'per_page' => [
                'sometimes',
                'integer',
                'min:1',
                'max:100',
            ],

            'page' => [
                'sometimes',
                'integer',
                'min:1',
            ],
        ]);

        if (
            isset($filters['from'], $filters['to']) &&
            $filters['to'] < $filters['from']
        ) {
            throw ValidationException::withMessages([
                'to' => 'Tanggal akhir tidak boleh sebelum tanggal awal.',
            ]);
        }

        $query = StockMovement::query()
            ->with(['product', 'user', 'order']);

        if (isset($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
        }

        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (isset($filters['order_id'])) {
            $query->where('order_id', $filters['order_id']);
        }

        if (isset($filters['movement_type'])) {
            $query->where(
                'movement_type',
                $filters['movement_type'],
            );
        }

        if (isset($filters['from'])) {
            $query->whereDate(
                'created_at',
                '>=',
                $filters['from'],
            );
        }

        if (isset($filters['to'])) {
            $query->whereDate(
                'created_at',
                '<=',
                $filters['to'],
            );
        }

        $movements = $query
            ->orderBy(
                $filters['sort'] ?? 'created_at',
                $filters['direction'] ?? 'desc',
            )
            ->orderBy('id', 'desc')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return StockMovementResource::collection($movements);
    }

    /**
     * Menyesuaikan stok melalui InventoryService.
     */
    public function adjust(
        StockAdjustmentRequest $request,
    ): JsonResponse {
        $actor = $this->inventoryActor($request);
        $data = $request->validated();

        $product = Product::query()
            ->findOrFail($data['product_id']);

        Gate::forUser($actor)->authorize(
            'adjustStock',
            $product,
        );

        $movement = $this->inventoryService->adjustStock(
            product: $product,
            actor: $actor,
            movementType: $data['movement_type'],
            quantity: (int) $data['quantity'],
            notes: $data['notes'] ?? null,
            unitCost: $data['unit_cost'] ?? null,
        );

        $movement->load(['product', 'user', 'order']);

        return response()->json([
            'message' => 'Pergerakan stok berhasil dicatat.',
            'data' => (new StockMovementResource($movement))
                ->resolve($request),
        ], 201);
    }

    /**
     * Pastikan hanya Admin dan Staff aktif yang bisa
     * mengakses riwayat serta penyesuaian stok.
     */
    private function inventoryActor(Request $request): User
    {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        abort_unless(
            $actor->is_active &&
            in_array($actor->role, [
                User::ROLE_ADMIN,
                User::ROLE_STAFF,
            ], true),
            403,
            'Akses inventori hanya tersedia untuk Admin dan Staff.',
        );

        return $actor;
    }
}

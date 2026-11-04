<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Http\Requests\UpdateOrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
    ) {
    }

    /**
     * Daftar pesanan dengan filter dan pagination.
     */
    public function index(Request $request)
    {
        $actor = $this->authenticatedUser($request);

        Gate::forUser($actor)->authorize('viewAny', Order::class);

        $filters = $request->validate([
            'search' => [
                'sometimes',
                'nullable',
                'string',
                'max:120',
            ],

            'status' => [
                'sometimes',
                Rule::in(Order::STATUSES),
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
                    'order_number',
                    'status',
                    'total_amount',
                    'created_at',
                    'placed_at',
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

        $query = Order::query()
            ->with([
                'user:id,name,email',
                'items',
                'invoice',
            ])
            ->withCount('items');

        // Member tidak pernah mendapat query global semua pesanan.
        if ($actor->role === User::ROLE_MEMBER) {
            $query->where('user_id', $actor->id);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];

            $query->where(function (Builder $orders) use ($search, $actor): void {
                $orders->where(
                    'order_number',
                    'like',
                    "%{$search}%"
                );

                if ($actor->role !== User::ROLE_MEMBER) {
                    $orders->orWhereHas(
                        'user',
                        function (Builder $users) use ($search): void {
                            $users
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        }
                    );
                }
            });
        }

        if (isset($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (isset($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        $orders = $query
            ->orderBy(
                $filters['sort'] ?? 'created_at',
                $filters['direction'] ?? 'desc',
            )
            ->orderBy('id', 'desc')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return OrderResource::collection($orders);
    }

    /**
     * Checkout melalui OrderService.
     */
    public function store(CheckoutRequest $request): JsonResponse
    {
        $actor = $this->authenticatedUser($request);

        $order = $this->orderService->checkout(
            $actor,
            $request->validated(),
        );

        return response()->json([
            'message' => 'Pesanan berhasil dibuat.',
            'data' => (new OrderResource($order))->resolve($request),
        ], 201);
    }

    /**
     * Detail pesanan.
     */
    public function show(Order $order): OrderResource
    {
        Gate::authorize('view', $order);

        $order->loadMissing([
            'user:id,name,email',
            'items',
            'invoice',
        ]);

        return new OrderResource($order);
    }

    /**
     * Perubahan status sesuai transisi bisnis yang diperbolehkan.
     */
    public function updateStatus(
        UpdateOrderStatusRequest $request,
        Order $order,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);

        $updatedOrder = $this->orderService->updateStatus(
            $order,
            $actor,
            $request->validated()['status'],
        );

        return response()->json([
            'message' => 'Status pesanan berhasil diperbarui.',
            'data' => (new OrderResource($updatedOrder))->resolve($request),
        ]);
    }

    /**
     * Pembatalan tidak menghapus riwayat pesanan.
     * OrderService menangani pengembalian stok.
     */
    public function cancel(
        Request $request,
        Order $order,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);

        $cancelledOrder = $this->orderService->cancel(
            $order,
            $actor,
        );

        return response()->json([
            'message' => 'Pesanan berhasil dibatalkan.',
            'data' => (new OrderResource($cancelledOrder))->resolve($request),
        ]);
    }

    private function authenticatedUser(Request $request): User
    {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        abort_unless(
            $actor->is_active &&
            in_array($actor->role, User::ROLES, true),
            403,
            'Akun tidak memiliki akses.',
        );

        return $actor;
    }
}

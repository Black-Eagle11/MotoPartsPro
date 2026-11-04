<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Dashboard menyesuaikan hak akses pengguna.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        abort_unless(
            $user->is_active
            && in_array($user->role, User::ROLES, true),
            403,
            'Akun tidak memiliki akses dashboard.',
        );

        if ($user->role === User::ROLE_MEMBER) {
            return $this->memberDashboard($user);
        }

        return $this->operationalDashboard($user);
    }

    /**
     * Dashboard Member hanya menampilkan data miliknya sendiri.
     */
    private function memberDashboard(User $user): JsonResponse
    {
        $myOrders = Order::query()
            ->where('user_id', $user->id);

        $statusCounts = $this->orderStatusCounts($user->id);

        /*
         * Parameter callback sengaja tidak diberi tipe Order.
         * Ini menghindari konflik inferensi stdClass pada
         * PHP Language Server, tanpa mengubah hasil query.
         */
        $recentOrderRows = Order::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(5)
            ->get([
                'id',
                'order_number',
                'status',
                'total_amount',
                'placed_at',
                'created_at',
            ]);

        $recentOrders = $recentOrderRows
            ->map(static function ($order): array {
                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $order->status,
                    'total_amount' => $order->total_amount,
                    'placed_at' => $order->placed_at,
                    'created_at' => $order->created_at,
                ];
            })
            ->values();

        $paidInvoices = Invoice::query()
            ->where('status', Invoice::STATUS_PAID)
            ->whereHas(
                'order',
                static function (Builder $orders) use ($user): void {
                    $orders->where('user_id', $user->id);
                },
            );

        return response()->json([
            'message' => 'Dashboard berhasil dimuat.',

            'data' => [
                'role' => $user->role,

                'catalog' => [
                    'active_products' => Product::query()
                        ->where('is_active', true)
                        ->whereHas(
                            'category',
                            static function (Builder $categories): void {
                                $categories->where(
                                    'is_active',
                                    true,
                                );
                            },
                        )
                        ->count(),

                    'active_categories' => Category::query()
                        ->where('is_active', true)
                        ->count(),
                ],

                'orders' => [
                    'total' => (clone $myOrders)->count(),
                    'by_status' => $statusCounts,
                ],

                'payments' => [
                    'paid_invoices' => (clone $paidInvoices)->count(),

                    'paid_total' => $this->paidInvoiceTotal(
                        $user->id,
                    ),
                ],

                'recent_orders' => $recentOrders,
            ],
        ]);
    }

    /**
     * Dashboard operasional Admin dan Staff.
     */
    private function operationalDashboard(User $user): JsonResponse
    {
        $ordersByStatus = $this->orderStatusCounts();

        /*
         * with() tetap mengambil relasi user melalui Eloquent.
         * Callback map tidak menggunakan parameter bertipe Order,
         * sehingga inferensi stdClass tidak menimbulkan PHP0447.
         */
        $recentOrderRows = Order::query()
            ->with('user:id,name,email')
            ->withCount('items')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        $recentOrders = $recentOrderRows
            ->map(static function ($order): array {
                $customer = $order->user;

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $order->status,
                    'total_amount' => $order->total_amount,
                    'items_count' => (int) $order->items_count,
                    'placed_at' => $order->placed_at,
                    'created_at' => $order->created_at,

                    'customer' => $customer !== null
                        ? [
                            'id' => $customer->id,
                            'name' => $customer->name,
                            'email' => $customer->email,
                        ]
                        : null,
                ];
            })
            ->values();

        $data = [
            'role' => $user->role,

            'catalog' => [
                'products_total' => Product::query()->count(),

                'active_products' => Product::query()
                    ->where('is_active', true)
                    ->count(),

                'active_categories' => Category::query()
                    ->where('is_active', true)
                    ->count(),
            ],

            'inventory' => [
                'low_stock' => Product::query()
                    ->where('is_active', true)
                    ->whereColumn('stock', '<=', 'min_stock')
                    ->count(),

                'out_of_stock' => Product::query()
                    ->where('is_active', true)
                    ->where('stock', 0)
                    ->count(),
            ],

            'orders' => [
                'total' => Order::query()->count(),
                'by_status' => $ordersByStatus,
            ],

            'sales' => [
                'paid_invoices' => Invoice::query()
                    ->where('status', Invoice::STATUS_PAID)
                    ->count(),

                'paid_revenue' => $this->paidInvoiceTotal(),
            ],

            'recent_orders' => $recentOrders,
        ];

        // Statistik seluruh pengguna hanya untuk Admin.
        if ($user->role === User::ROLE_ADMIN) {
            $data['users'] = [
                'total' => User::query()->count(),

                'active' => User::query()
                    ->where('is_active', true)
                    ->count(),

                'inactive' => User::query()
                    ->where('is_active', false)
                    ->count(),

                'admins' => User::query()
                    ->where('role', User::ROLE_ADMIN)
                    ->count(),

                'staff' => User::query()
                    ->where('role', User::ROLE_STAFF)
                    ->count(),

                'members' => User::query()
                    ->where('role', User::ROLE_MEMBER)
                    ->count(),
            ];
        }

        return response()->json([
            'message' => 'Dashboard berhasil dimuat.',
            'data' => $data,
        ]);
    }

    /**
     * Menghasilkan hitungan untuk seluruh status pesanan,
     * termasuk status yang belum mempunyai transaksi.
     */
    private function orderStatusCounts(?int $userId = null): array
    {
        $counts = array_fill_keys(Order::STATUSES, 0);

        $query = Order::query();

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $rows = $query
            ->select('status')
            ->selectRaw('COUNT(*) AS status_count')
            ->groupBy('status')
            ->get();

        foreach ($rows as $row) {
            if (array_key_exists($row->status, $counts)) {
                $counts[$row->status] = (int) $row->status_count;
            }
        }

        return $counts;
    }

    /**
     * Menjumlahkan total faktur berstatus paid.
     * Mengembalikan string desimal untuk menjaga format uang.
     */
    private function paidInvoiceTotal(?int $userId = null): string
    {
        $query = Invoice::query()
            ->where('status', Invoice::STATUS_PAID);

        if ($userId !== null) {
            $query->whereHas(
                'order',
                static function (Builder $orders) use ($userId): void {
                    $orders->where('user_id', $userId);
                },
            );
        }

        $result = $query
            ->selectRaw(
                'COALESCE(SUM(total_amount), 0.00) AS aggregate_total',
            )
            ->first();

        return (string) (
            $result?->getAttribute('aggregate_total') ?? '0.00'
        );
    }
}

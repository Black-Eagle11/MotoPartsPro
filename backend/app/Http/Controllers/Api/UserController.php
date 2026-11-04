<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateUserRoleRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    /**
     * Daftar pengguna hanya untuk Admin.
     */
    public function index(Request $request)
    {
        $actor = $this->authenticatedUser($request);

        Gate::forUser($actor)->authorize('viewAny', User::class);

        $filters = $request->validate([
            'search' => [
                'sometimes',
                'nullable',
                'string',
                'max:120',
            ],

            'role' => [
                'sometimes',
                Rule::in(User::ROLES),
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],

            'sort' => [
                'sometimes',
                Rule::in([
                    'id',
                    'name',
                    'email',
                    'role',
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

        $query = User::query()->withCount('orders');

        if (isset($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        if (array_key_exists('is_active', $filters)) {
            $query->where(
                'is_active',
                filter_var(
                    $filters['is_active'],
                    FILTER_VALIDATE_BOOLEAN,
                ),
            );
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];

            $query->where(function (Builder $users) use ($search): void {
                $users
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query
            ->orderBy(
                $filters['sort'] ?? 'created_at',
                $filters['direction'] ?? 'desc',
            )
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return UserResource::collection($users);
    }

    /**
     * Melihat detail pengguna sesuai UserPolicy.
     */
    public function show(User $user): UserResource
    {
        Gate::authorize('view', $user);

        $user->loadCount('orders');

        return new UserResource($user);
    }

    /**
     * Mengubah role pengguna secara terotorisasi.
     */
    public function updateRole(
        UpdateUserRoleRequest $request,
        User $user,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $newRole = $request->validated()['role'];
        $targetId = $user->id;

        $updatedUser = DB::transaction(function () use ($actor, $targetId, $newRole): User {
            // Kunci Admin aktif agar perubahan administratif yang
            // bersamaan tidak sembarangan menghilangkan Admin terakhir.
            $this->lockActiveAdmins();

            $target = User::query()
                ->whereKey($targetId)
                ->lockForUpdate()
                ->firstOrFail();

            Gate::forUser($actor)->authorize(
                'changeRole',
                [$target, $newRole],
            );

            $target->assignRole($newRole);
            $target->save();

            return $target->fresh()->loadCount('orders');
        }, 3);

        return response()->json([
            'message' => 'Role pengguna berhasil diperbarui.',
            'data' => (new UserResource($updatedUser))->resolve($request),
        ]);
    }

    /**
     * Mengaktifkan kembali akun pengguna.
     */
    public function activate(
        Request $request,
        User $user,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $targetId = $user->id;

        $updatedUser = DB::transaction(function () use ($actor, $targetId): User {
            $target = User::query()
                ->whereKey($targetId)
                ->lockForUpdate()
                ->firstOrFail();

            Gate::forUser($actor)->authorize('activate', $target);

            $target->activate();
            $target->save();

            return $target->fresh()->loadCount('orders');
        }, 3);

        return response()->json([
            'message' => 'Akun berhasil diaktifkan.',
            'data' => (new UserResource($updatedUser))->resolve($request),
        ]);
    }

    /**
     * Menonaktifkan akun pengguna tanpa menghapus riwayatnya.
     */
    public function deactivate(
        Request $request,
        User $user,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $targetId = $user->id;

        $updatedUser = DB::transaction(function () use ($actor, $targetId): User {
            $this->lockActiveAdmins();

            $target = User::query()
                ->whereKey($targetId)
                ->lockForUpdate()
                ->firstOrFail();

            Gate::forUser($actor)->authorize('deactivate', $target);

            $target->deactivate();
            $target->save();

            // Cabut semua token saat akun dinonaktifkan.
            $target->tokens()->delete();

            return $target->fresh()->loadCount('orders');
        }, 3);

        return response()->json([
            'message' => 'Akun berhasil dinonaktifkan.',
            'data' => (new UserResource($updatedUser))->resolve($request),
        ]);
    }

    /**
     * Menghapus akun hanya jika kebijakan mengizinkan.
     * Riwayat pesanan atau pergerakan stok dipertahankan.
     */
    public function destroy(
        Request $request,
        User $user,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $targetId = $user->id;

        DB::transaction(function () use ($actor, $targetId): void {
            $this->lockActiveAdmins();

            $target = User::query()
                ->whereKey($targetId)
                ->lockForUpdate()
                ->firstOrFail();

            Gate::forUser($actor)->authorize('delete', $target);

            $target->delete();
        }, 3);

        return response()->json([
            'message' => 'Akun berhasil dihapus.',
        ]);
    }

    /**
     * Helper untuk memastikan aktor merupakan pengguna aktif
     * dengan role yang dikenal.
     */
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

    /**
     * Digunakan dalam transaksi sebelum mutasi administratif.
     */
    private function lockActiveAdmins(): void
    {
        User::query()
            ->where('role', User::ROLE_ADMIN)
            ->where('is_active', true)
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id']);
    }
}

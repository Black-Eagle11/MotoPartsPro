<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Hanya izinkan role yang disebutkan pada route.
     *
     * Contoh:
     * ->middleware(['auth:sanctum', 'role:admin'])
     * ->middleware(['auth:sanctum', 'role:admin,staff'])
     */
    public function handle(
        Request $request,
        Closure $next,
        string ...$roles
    ): Response {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (! $user->is_active) {
            return response()->json([
                'message' => 'Account is inactive.',
            ], 403);
        }

        $roles = array_values(array_filter(
            array_map(
                static fn (string $role): string => trim($role),
                $roles
            ),
            static fn (string $role): bool => $role !== ''
        ));

        // Konfigurasi yang kosong atau role yang tidak dikenal
        // harus ditolak, bukan diberikan akses secara otomatis.
        if (
            $roles === [] ||
            array_diff($roles, User::ROLES) !== []
        ) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        if (! in_array($user->role, $roles, true)) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        return $next($request);
    }
}

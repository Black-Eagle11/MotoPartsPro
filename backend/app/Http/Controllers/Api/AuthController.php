<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Registrasi akun Member baru.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->safe()->only([
            'name',
            'email',
            'password',
        ]);

        // Role dan status akun menggunakan default pada User model.
        $user = User::query()->create($data);

        $token = $user->createToken(
            'motopartspro-web',
            ['*'],
            now()->addDays(7),
        );

        return response()->json([
            'message' => 'Registrasi berhasil.',
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'user' => (new UserResource($user))->resolve($request),
        ], 201);
    }

    /**
     * Login menggunakan email dan password.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        $user = User::query()
            ->where('email', $credentials['email'])
            ->first();

        if (
            !$user ||
            !Hash::check(
                $credentials['password'],
                $user->password,
            )
        ) {
            return response()->json([
                'message' => 'Email atau password tidak valid.',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Akun dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        $token = $user->createToken(
            'motopartspro-web',
            ['*'],
            now()->addDays(7),
        );

        return response()->json([
            'message' => 'Login berhasil.',
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'user' => (new UserResource($user))->resolve($request),
        ]);
    }

    /**
     * Informasi pengguna yang sedang login.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user instanceof User) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!$user->is_active) {
            $this->revokeCurrentToken($user);

            return response()->json([
                'message' => 'Akun tidak aktif.',
            ], 403);
        }

        // Objek langsung, bukan { "data": { ... } }.
        return response()->json(
            (new UserResource($user))->resolve($request)
        );
    }

    /**
     * Logout dan cabut token yang digunakan saat ini.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user instanceof User) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $this->revokeCurrentToken($user);

        return response()->json([
            'message' => 'Logout berhasil.',
        ]);
    }

    private function revokeCurrentToken(User $user): void
    {
        $token = $user->currentAccessToken();

        // Hindari pemanggilan delete() jika autentikasi memakai
        // transient token alih-alih personal access token.
        if ($token !== null && method_exists($token, 'delete')) {
            $token->delete();
        }
    }
}

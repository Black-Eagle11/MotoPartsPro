<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test Member',
            'email' => 'member@example.test',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'StrongPassword123!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', 'member@example.test')
            ->assertJsonPath('user.role', User::ROLE_MEMBER)
            ->assertJsonPath('token_type', 'Bearer');

        $this->assertNotEmpty($response->json('token'));

        $this->assertDatabaseHas('users', [
            'email' => 'member@example.test',
            'role' => User::ROLE_MEMBER,
            'is_active' => 1,
        ]);
    }

    public function test_registration_cannot_assign_admin_role(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Attempted Admin',
            'email' => 'attempted-admin@example.test',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'StrongPassword123!',
            'role' => User::ROLE_ADMIN,
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);

        $this->assertDatabaseMissing('users', [
            'email' => 'attempted-admin@example.test',
        ]);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        User::factory()->create([
            'name' => 'Login Test',
            'email' => 'login@example.test',
            'password' => 'StrongPassword123!',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'LOGIN@example.test',
            'password' => 'StrongPassword123!',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('user.email', 'login@example.test')
            ->assertJsonPath('token_type', 'Bearer');

        $this->assertNotEmpty($response->json('token'));
    }

    public function test_invalid_login_is_rejected(): void
    {
        User::factory()->create([
            'email' => 'login@example.test',
            'password' => 'StrongPassword123!',
        ]);

        $this->postJson('/api/login', [
            'email' => 'login@example.test',
            'password' => 'WrongPassword123!',
        ])
            ->assertUnauthorized()
            ->assertJsonPath(
                'message',
                'Email atau password tidak valid.',
            );
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = User::factory()->create([
            'email' => 'inactive@example.test',
            'password' => 'StrongPassword123!',
            'is_active' => false,
        ]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'StrongPassword123!',
        ])->assertForbidden();
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create([
            'email' => 'logout@example.test',
        ]);

        $plainTextToken = $user
            ->createToken('feature-test')
            ->plainTextToken;

        /*
         * Pastikan token berhasil digunakan untuk logout.
         */
        $this->withToken($plainTextToken)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logout berhasil.');

        /*
         * Pastikan token telah dicabut dari database.
         */
        $this->assertDatabaseCount('personal_access_tokens', 0);

        /*
         * Laravel dapat menyimpan instance guard beserta user
         * yang telah diautentikasi selama satu lifecycle aplikasi.
         *
         * Reset guard sebelum membuat request kedua agar pengujian
         * benar-benar memeriksa token yang sudah dicabut.
         */
        $this->app['auth']->forgetGuards();

        /*
         * Gunakan token lama lagi. Server harus menolaknya karena
         * record token sudah tidak tersedia.
         */
        $this->withToken($plainTextToken)
            ->getJson('/api/user')
            ->assertUnauthorized();
    }
}

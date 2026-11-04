<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();

        $user->forceFill([
            'role' => $role,
            'is_active' => true,
        ])->save();

        return $user->fresh();
    }

    public function test_member_cannot_access_inventory_or_user_management(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);

        Sanctum::actingAs($member);

        $this->getJson('/api/inventory/movements')
            ->assertForbidden();

        $this->getJson('/api/users')
            ->assertForbidden();
    }

    public function test_staff_can_access_inventory_but_not_user_administration(): void
    {
        $staff = $this->userWithRole(User::ROLE_STAFF);

        Sanctum::actingAs($staff);

        $this->getJson('/api/inventory/movements')
            ->assertOk();

        $this->getJson('/api/users')
            ->assertForbidden();

        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.role', User::ROLE_STAFF);
    }

    public function test_admin_can_access_user_administration(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);

        Sanctum::actingAs($admin);

        $this->getJson('/api/users')
            ->assertOk();
    }

    public function test_admin_cannot_demote_themselves(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/users/{$admin->id}/role", [
            'role' => User::ROLE_MEMBER,
        ])->assertForbidden();

        $this->assertSame(
            User::ROLE_ADMIN,
            $admin->fresh()->role,
        );
    }

    public function test_inactive_user_cannot_use_protected_endpoints(): void
    {
        $member = $this->userWithRole(User::ROLE_MEMBER);

        $member->deactivate();
        $member->save();

        Sanctum::actingAs($member);

        $this->getJson('/api/dashboard')
            ->assertForbidden();
    }

    public function test_invalid_role_is_rejected(): void
    {
        $admin = $this->userWithRole(User::ROLE_ADMIN);
        $member = $this->userWithRole(User::ROLE_MEMBER);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/users/{$member->id}/role", [
            'role' => 'superadmin',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);

        $this->assertSame(
            User::ROLE_MEMBER,
            $member->fresh()->role,
        );
    }
}

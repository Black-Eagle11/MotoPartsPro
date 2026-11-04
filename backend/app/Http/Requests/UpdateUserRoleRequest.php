<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $actor = $this->user();

        return $actor !== null
            && $actor->is_active
            && $actor->role === User::ROLE_ADMIN;
    }

    public function rules(): array
    {
        return [
            'role' => [
                'required',
                'string',
                Rule::in(User::ROLES),
            ],

            // Endpoint ini hanya boleh mengubah role.
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'name' => ['prohibited'],
            'email' => ['prohibited'],
            'password' => ['prohibited'],
            'is_active' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'role.required' => 'Role wajib dipilih.',
            'role.in' => 'Role harus admin, staff, atau member.',
            'is_active.prohibited' =>
                'Status akun harus diubah melalui proses khusus.',
        ];
    }
}

<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Rule;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $data = [];

        if (is_string($this->input('name'))) {
            $data['name'] = trim($this->input('name'));
        }

        if (is_string($this->input('email'))) {
            $data['email'] = Str::lower(trim($this->input('email')));
        }

        if ($data !== []) {
            $this->merge($data);
        }
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'min:2',
                'max:120',
            ],

            'email' => [
                'required',
                'string',
                'email',
                'max:254',
                Rule::unique('users', 'email'),
            ],

            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(12)
                    ->letters()
                    ->mixedCase()
                    ->numbers(),
            ],

            'password_confirmation' => [
                'required',
                'string',
            ],

            'role' => ['prohibited'],
            'is_active' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
            'remember_token' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'name.min' => 'Nama minimal 2 karakter.',
            'email.required' => 'Email wajib diisi.',
            'email.unique' => 'Email sudah terdaftar.',
            'password.confirmed' => 'Konfirmasi password tidak cocok.',
            'password_confirmation.required' =>
                'Konfirmasi password wajib diisi.',
            'role.prohibited' =>
                'Role ditentukan oleh server.',
            'is_active.prohibited' =>
                'Status akun tidak dapat ditentukan saat registrasi.',
        ];
    }
}

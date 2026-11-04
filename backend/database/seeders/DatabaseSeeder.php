<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed initial MotoPartsPro data.
     */
    public function run(): void
    {
        $this->seedCategoriesAndProducts();

        $this->seedAdmin();

        $this->seedLocalDemoAccounts();

        $this->command?->info(
            'Data awal MotoPartsPro selesai diproses.'
        );
    }

    /**
     * Create initial categories and sample products.
     *
     * Existing categories are preserved.
     * Three sample products are created only when a category
     * currently has no products.
     */
    private function seedCategoriesAndProducts(): void
    {
        $categories = [
            'engine-transmission' => [
                'name' => 'Engine & Transmission',
                'description' => 'Suku cadang mesin dan transmisi motor.',
            ],

            'brakes' => [
                'name' => 'Brakes',
                'description' => 'Komponen pengereman motor.',
            ],

            'electrical' => [
                'name' => 'Electrical',
                'description' => 'Komponen kelistrikan dan pengapian.',
            ],

            'suspension' => [
                'name' => 'Suspension',
                'description' => 'Komponen suspensi dan kemudi.',
            ],

            'filters-fluids' => [
                'name' => 'Filters & Fluids',
                'description' => 'Filter udara, oli, dan cairan perawatan.',
            ],

            'tires-wheels' => [
                'name' => 'Tires & Wheels',
                'description' => 'Ban, roda, dan komponen pendukungnya.',
            ],

            'chain-sprockets' => [
                'name' => 'Chain & Sprockets',
                'description' => 'Rantai dan gir penggerak motor.',
            ],

            'body-accessories' => [
                'name' => 'Body & Accessories',
                'description' => 'Komponen bodi dan aksesori motor.',
            ],
        ];

        foreach ($categories as $slug => $attributes) {
            $category = Category::query()->firstOrCreate(
                ['slug' => $slug],
                [
                    ...$attributes,
                    'is_active' => true,
                ]
            );

            $hasProducts = Product::query()
                ->where('category_id', $category->id)
                ->exists();

            if (!$hasProducts) {
                Product::factory()
                    ->count(3)
                    ->for($category)
                    ->create();
            }
        }

        $this->command?->info(
            'Kategori dan produk awal berhasil diproses.'
        );
    }

    /**
     * Seed the configured administrator account.
     *
     * Existing administrator passwords are preserved.
     * A password is assigned only when the account is new.
     */
    private function seedAdmin(): void
    {
        $name = trim((string) config(
            'services.motopartspro.admin_name',
            'MotoPartsPro Admin'
        ));

        $email = strtolower(trim((string) config(
            'services.motopartspro.admin_email',
            ''
        )));

        $password = (string) config(
            'services.motopartspro.admin_password',
            ''
        );

        if (blank($email) && blank($password)) {
            $this->command?->warn(
                'Akun Admin tidak dibuat karena ' .
                'MOTOPARTSPRO_ADMIN_EMAIL dan ' .
                'MOTOPARTSPRO_ADMIN_PASSWORD belum dikonfigurasi.'
            );

            return;
        }

        if (blank($email) || blank($password)) {
            throw new RuntimeException(
                'Email dan password Admin harus diisi bersamaan.'
            );
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException(
                'MOTOPARTSPRO_ADMIN_EMAIL bukan alamat email yang valid.'
            );
        }

        if (mb_strlen($password) < 12) {
            throw new RuntimeException(
                'Password Admin harus memiliki minimal 12 karakter.'
            );
        }

        $admin = User::query()->firstOrNew([
            'email' => $email,
        ]);

        if (!$admin->exists) {
            $admin->name = $name !== ''
                ? $name
                : 'MotoPartsPro Admin';

            $admin->password = $password;
        }

        // Tetapkan role secara eksplisit.
        // Jangan menggunakan mass assignment untuk menaikkan role.
        $admin->role = User::ROLE_ADMIN;
        $admin->is_active = true;

        $admin->save();

        $this->command?->info(
            "Akun Admin tersedia untuk {$email}."
        );
    }

    /**
     * Seed demonstration accounts for local development only.
     *
     * The demo passwords and roles are synchronized whenever
     * the seeder runs locally. These accounts are never created
     * by this method in non-local environments.
     */
    private function seedLocalDemoAccounts(): void
    {
        if (!app()->environment('local')) {
            return;
        }

        $accounts = [
            [
                'name' => config(
                    'services.motopartspro.staff_name',
                    'MotoPartsPro Staff'
                ),
                'email' => config(
                    'services.motopartspro.staff_email'
                ),
                'password' => config(
                    'services.motopartspro.staff_password'
                ),
                'role' => User::ROLE_STAFF,
            ],

            [
                'name' => config(
                    'services.motopartspro.member_name',
                    'MotoPartsPro Member'
                ),
                'email' => config(
                    'services.motopartspro.member_email'
                ),
                'password' => config(
                    'services.motopartspro.member_password'
                ),
                'role' => User::ROLE_MEMBER,
            ],
        ];

        $createdOrUpdated = 0;

        foreach ($accounts as $account) {
            $email = strtolower(trim(
                (string) ($account['email'] ?? '')
            ));

            $password = (string) (
                $account['password'] ?? ''
            );

            $name = trim(
                (string) ($account['name'] ?? '')
            );

            // Akun demo yang belum dikonfigurasi boleh dilewati.
            // Namun, konfigurasi email/password yang hanya terisi
            // sebagian harus dianggap sebagai kesalahan.
            if (blank($email) && blank($password)) {
                continue;
            }

            if (blank($email) || blank($password)) {
                throw new RuntimeException(
                    'Email dan password akun demo Staff/Member ' .
                    'harus dikonfigurasi secara lengkap di .env.'
                );
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException(
                    'Email akun demo Staff/Member tidak valid.'
                );
            }

            if (mb_strlen($password) < 12) {
                throw new RuntimeException(
                    'Password akun demo Staff/Member ' .
                    'harus memiliki minimal 12 karakter.'
                );
            }

            $demoUser = User::query()->firstOrNew([
                'email' => $email,
            ]);

            $demoUser->name = $name !== ''
                ? $name
                : (
                    $account['role'] === User::ROLE_STAFF
                    ? 'MotoPartsPro Staff'
                    : 'MotoPartsPro Member'
                );

            // Model User harus menggunakan cast password => hashed.
            // Dengan begitu, password mentah akan di-hash oleh Laravel.
            $demoUser->password = $password;

            // Role hanya berasal dari definisi akun demo di seeder,
            // tidak pernah dari input registrasi pengguna.
            $demoUser->role = $account['role'];
            $demoUser->is_active = true;

            $demoUser->save();

            $createdOrUpdated++;
        }

        if ($createdOrUpdated === 0) {
            $this->command?->warn(
                'Akun demo Staff/Member dilewati karena email ' .
                'dan password belum dikonfigurasi di .env.'
            );

            return;
        }

        $this->command?->info(
            'Akun demo Staff dan Member berhasil diproses ' .
            'untuk lingkungan lokal.'
        );
    }
}

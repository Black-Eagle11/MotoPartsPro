<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
*/

Route::post('/register', [AuthController::class, 'register'])
    ->middleware('throttle:5,1')
    ->name('auth.register');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1')
    ->name('auth.login');

/*
|--------------------------------------------------------------------------
| Authenticated Routes
|--------------------------------------------------------------------------
|
| Semua role yang valid dapat mengakses grup ini.
| Policy pada masing-masing controller tetap menentukan izin
| terhadap resource dan data spesifik.
|
*/

Route::middleware([
    'auth:sanctum',
    'role:admin,staff,member',
])->group(function (): void {
    // Autentikasi
    Route::get('/user', [AuthController::class, 'me'])
        ->name('auth.me');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('auth.logout');

    // Dashboard menyesuaikan role pengguna.
    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard');

    // CRUD kategori dan produk.
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('products', ProductController::class);

    // Pesanan.
    Route::get('/orders', [OrderController::class, 'index'])
        ->name('orders.index');

    Route::post('/orders', [OrderController::class, 'store'])
        ->name('orders.store');

    Route::get('/orders/{order}', [OrderController::class, 'show'])
        ->name('orders.show');

    Route::patch('/orders/{order}/cancel', [
        OrderController::class,
        'cancel',
    ])->name('orders.cancel');

    // Detail akun sendiri atau akun lain sesuai UserPolicy.
    Route::get('/users/{user}', [UserController::class, 'show'])
        ->name('users.show');
});

/*
|--------------------------------------------------------------------------
| Inventory Routes: Admin & Staff
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth:sanctum',
    'role:admin,staff',
])->group(function (): void {
    Route::get('/inventory/movements', [
        InventoryController::class,
        'index',
    ])->name('inventory.movements.index');

    Route::post('/inventory/adjustments', [
        InventoryController::class,
        'adjust',
    ])->name('inventory.adjustments.store');

    Route::patch('/orders/{order}/status', [
        OrderController::class,
        'updateStatus',
    ])->name('orders.status.update');
});

Route::middleware([
    'auth:sanctum',
    'role:admin',
])->group(function (): void {
    Route::get('/users', [UserController::class, 'index'])
        ->name('users.index');

    Route::patch('/users/{user}/role', [
        UserController::class,
        'updateRole',
    ])->name('users.role.update');

    Route::patch('/users/{user}/activate', [
        UserController::class,
        'activate',
    ])->name('users.activate');

    Route::patch('/users/{user}/deactivate', [
        UserController::class,
        'deactivate',
    ])->name('users.deactivate');

    Route::delete('/users/{user}', [
        UserController::class,
        'destroy',
    ])->name('users.destroy');
});

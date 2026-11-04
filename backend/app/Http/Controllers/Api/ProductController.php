<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ProductController extends Controller
{
    /**
     * Daftar produk dengan pencarian, filter, sorting, dan pagination.
     */
    public function index(Request $request)
    {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        Gate::authorize('viewAny', Product::class);

        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],

            'category_id' => [
                'sometimes',
                'integer',
                Rule::exists('categories', 'id'),
            ],

            'brand' => ['sometimes', 'nullable', 'string', 'max:120'],

            'min_price' => [
                'sometimes',
                'numeric',
                'decimal:0,2',
                'min:0',
            ],

            'max_price' => [
                'sometimes',
                'numeric',
                'decimal:0,2',
                'min:0',
            ],

            'in_stock' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],

            'sort' => [
                'sometimes',
                Rule::in([
                    'id',
                    'name',
                    'sku',
                    'price',
                    'stock',
                    'created_at',
                ]),
            ],

            'direction' => [
                'sometimes',
                Rule::in(['asc', 'desc']),
            ],

            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        if (
            isset($filters['min_price'], $filters['max_price']) &&
            (float) $filters['min_price'] > (float) $filters['max_price']
        ) {
            throw ValidationException::withMessages([
                'min_price' =>
                    'Harga minimum tidak boleh melebihi harga maksimum.',
            ]);
        }

        $query = Product::query()->with('category');

        // Member hanya boleh melihat produk aktif dalam kategori aktif.
        if ($actor->role === User::ROLE_MEMBER) {
            $query
                ->where('is_active', true)
                ->whereHas('category', function (Builder $category): void {
                    $category->where('is_active', true);
                });
        } elseif (array_key_exists('is_active', $filters)) {
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

            $query->where(function (Builder $products) use ($search): void {
                $products
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%");
            });
        }

        if (isset($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        if (!empty($filters['brand'])) {
            $query->where('brand', $filters['brand']);
        }

        if (isset($filters['min_price'])) {
            $query->where('price', '>=', $filters['min_price']);
        }

        if (isset($filters['max_price'])) {
            $query->where('price', '<=', $filters['max_price']);
        }

        if (array_key_exists('in_stock', $filters)) {
            $inStock = filter_var(
                $filters['in_stock'],
                FILTER_VALIDATE_BOOLEAN,
            );

            if ($inStock) {
                $query->where('stock', '>', 0);
            } else {
                $query->where('stock', '=', 0);
            }
        }

        $products = $query
            ->orderBy(
                $filters['sort'] ?? 'name',
                $filters['direction'] ?? 'asc',
            )
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return ProductResource::collection($products);
    }

    /**
     * Membuat produk baru.
     */
    public function store(ProductRequest $request): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        Gate::authorize('create', Product::class);

        $data = $request->validated();
        $image = $data['image'] ?? null;

        unset($data['image']);

        // Staff tidak boleh mengatur harga modal.
        if ($actor->role !== User::ROLE_ADMIN) {
            unset($data['cost_price']);
        }

        $imagePath = null;

        if ($image instanceof UploadedFile) {
            $storedPath = $image->storePublicly(
                'products',
                'public',
            );

            if (!is_string($storedPath)) {
                throw new RuntimeException(
                    'Gagal menyimpan gambar produk.'
                );
            }

            $imagePath = $storedPath;
            $data['image_path'] = $imagePath;
        }

        try {
            $product = DB::transaction(
                fn(): Product => Product::query()->create($data)
            );

            $product->load('category');
        } catch (Throwable $exception) {
            if ($imagePath !== null) {
                Storage::disk('public')->delete($imagePath);
            }

            throw $exception;
        }

        return response()->json([
            'message' => 'Produk berhasil dibuat.',
            'data' => (new ProductResource($product))->resolve($request),
        ], 201);
    }

    /**
     * Detail produk.
     */
    public function show(Product $product): ProductResource
    {
        Gate::authorize('view', $product);

        $product->load('category');

        return new ProductResource($product);
    }

    /**
     * Memperbarui produk tanpa memperbolehkan perubahan stok langsung.
     */
    public function update(
        ProductRequest $request,
        Product $product,
    ): JsonResponse {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        Gate::authorize('update', $product);

        $data = $request->validated();
        $image = $data['image'] ?? null;

        unset($data['image']);

        if ($actor->role !== User::ROLE_ADMIN) {
            unset($data['cost_price']);
        }

        $oldImagePath = $product->image_path;
        $newImagePath = null;

        if ($image instanceof UploadedFile) {
            $storedPath = $image->storePublicly(
                'products',
                'public',
            );

            if (!is_string($storedPath)) {
                throw new RuntimeException(
                    'Gagal menyimpan gambar produk.'
                );
            }

            $newImagePath = $storedPath;
            $data['image_path'] = $newImagePath;
        }

        if ($data === []) {
            if ($newImagePath !== null) {
                Storage::disk('public')->delete($newImagePath);
            }

            throw ValidationException::withMessages([
                'product' => 'Tidak ada perubahan produk yang dikirim.',
            ]);
        }

        try {
            DB::transaction(function () use ($product, $data): void {
                $lockedProduct = Product::query()
                    ->whereKey($product->getKey())
                    ->lockForUpdate()
                    ->firstOrFail();

                $lockedProduct->update($data);
            });

            $product->refresh()->load('category');
        } catch (Throwable $exception) {
            if ($newImagePath !== null) {
                Storage::disk('public')->delete($newImagePath);
            }

            throw $exception;
        }

        // Hapus gambar lama setelah database berhasil diperbarui.
        if (
            $newImagePath !== null &&
            $oldImagePath !== null &&
            $oldImagePath !== $newImagePath
        ) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return response()->json([
            'message' => 'Produk berhasil diperbarui.',
            'data' => (new ProductResource($product))->resolve($request),
        ]);
    }

    /**
     * Menghapus produk tanpa riwayat transaksi atau pergerakan stok.
     */
    public function destroy(Product $product): JsonResponse
    {
        Gate::authorize('delete', $product);

        $imagePath = $product->image_path;

        $product->delete();

        if ($imagePath !== null) {
            Storage::disk('public')->delete($imagePath);
        }

        return response()->json([
            'message' => 'Produk berhasil dihapus.',
        ]);
    }
}

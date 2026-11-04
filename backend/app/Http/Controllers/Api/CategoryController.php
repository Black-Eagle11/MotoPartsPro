<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    /**
     * Daftar kategori dengan search, filter, sorting, dan pagination.
     */
    public function index(Request $request)
    {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        Gate::authorize('viewAny', Category::class);

        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
            'sort' => [
                'sometimes',
                Rule::in(['id', 'name', 'slug', 'created_at']),
            ],
            'direction' => [
                'sometimes',
                Rule::in(['asc', 'desc']),
            ],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $query = Category::query()
            ->withCount([
                'products' => function ($products) use ($actor): void {
                    if ($actor->role === User::ROLE_MEMBER) {
                        $products->where('is_active', true);
                    }
                },
            ]);

        // Member tidak boleh melihat kategori nonaktif.
        if ($actor->role === User::ROLE_MEMBER) {
            $query->where('is_active', true);
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

            $query->where(function ($categories) use ($search): void {
                $categories
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $sort = $filters['sort'] ?? 'name';
        $direction = $filters['direction'] ?? 'asc';

        $categories = $query
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return CategoryResource::collection($categories);
    }

    /**
     * Membuat kategori baru.
     */
    public function store(CategoryRequest $request): JsonResponse
    {
        Gate::authorize('create', Category::class);

        $data = $request->validated();

        $category = Category::query()->create($data);
        $category->loadCount('products');

        return response()->json([
            'message' => 'Kategori berhasil dibuat.',
            'data' => (new CategoryResource($category))->resolve($request),
        ], 201);
    }

    /**
     * Detail kategori.
     */
    public function show(
        Request $request,
        Category $category,
    ): CategoryResource {
        Gate::authorize('view', $category);

        $category->loadCount('products');

        return new CategoryResource($category);
    }

    /**
     * Memperbarui kategori.
     */
    public function update(
        CategoryRequest $request,
        Category $category,
    ): JsonResponse {
        Gate::authorize('update', $category);

        $data = $request->validated();

        if ($data === []) {
            throw ValidationException::withMessages([
                'category' => 'Tidak ada perubahan kategori yang dikirim.',
            ]);
        }

        $category->update($data);
        $category->loadCount('products');

        return response()->json([
            'message' => 'Kategori berhasil diperbarui.',
            'data' => (new CategoryResource($category))->resolve($request),
        ]);
    }

    /**
     * Menghapus kategori yang tidak memiliki produk.
     */
    public function destroy(Category $category): JsonResponse
    {
        Gate::authorize('delete', $category);

        $category->delete();

        return response()->json([
            'message' => 'Kategori berhasil dihapus.',
        ]);
    }
}

import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "../api/products";
import { ProductCard } from "../components/ProductCard";

export function ProductsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-xl border border-gray-200 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-red-600">Could not load products.</p>
        <p className="mt-2 text-sm text-gray-500">{(error as Error).message}</p>
      </div>
    );
  }

  const list = data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">All products</h1>
      <p className="mb-6 text-gray-600">{list.length} products</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

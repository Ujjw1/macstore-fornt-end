import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProductBySlug } from "../api/products";
import { productImageUrl } from "../lib/productImage";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

const CURRENCY = "NPR";

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const toast = useToast();

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug!),
    enabled: Boolean(slug),
  });

  const out = product?.stock_status === "out_of_stock";
  const canPurchase = Boolean(product) && !out;

  const handleAddToCart = () => {
    if (!product || !canPurchase) return;
    addToCart(product, quantity, {});
    toast.show("Added to cart!");
  };

  const handleBuyNow = () => {
    if (!product || !canPurchase) return;
    addToCart(product, quantity, {});
    navigate("/cart");
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-80 rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-red-600">Failed to load product.</p>
        <p className="mt-2 text-sm text-gray-500">{(error as Error)?.message}</p>
      </div>
    );
  }

  const img = productImageUrl(product.main_image);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-6">
          <img
            src={img}
            alt=""
            className="max-h-80 max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://dummyimage.com/400x400/cccccc/000000&text=No+Image";
            }}
          />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
          {product.brand ? (
            <p className="mt-1 text-sm text-gray-500">{product.brand}</p>
          ) : null}
          <p className="mt-4 text-xl font-medium text-gray-800">
            {CURRENCY} {parseFloat(product.price).toLocaleString()}
          </p>

          {/* Row 1: quantity + Add to Cart (per BUTTON_STRUCTURE.md) */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center rounded-md border border-gray-300 bg-white">
              <button
                type="button"
                className="border-r border-gray-300 px-3 py-2 text-lg leading-none hover:bg-gray-50"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="min-w-[3rem] px-4 py-2 text-center tabular-nums">{quantity}</span>
              <button
                type="button"
                className="border-l border-gray-300 px-3 py-2 text-lg leading-none hover:bg-gray-50"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={!canPurchase}
              onClick={handleAddToCart}
              className={`flex items-center justify-center gap-2 rounded-md px-6 py-2 text-white ${
                canPurchase ? "bg-blue-500 hover:bg-blue-600" : "cursor-not-allowed bg-gray-400"
              }`}
            >
              <CartIcon />
              {out ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>

          {/* Row 2: Buy Now — separated */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <button
              type="button"
              disabled={!canPurchase}
              onClick={handleBuyNow}
              className={`w-full rounded-md px-6 py-3 text-center text-sm font-semibold text-white sm:w-auto ${
                canPurchase ? "bg-gray-900 hover:bg-gray-800" : "cursor-not-allowed bg-gray-400"
              }`}
            >
              Buy now
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Adds this product with the selected quantity and opens your cart to continue checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

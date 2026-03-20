import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Product } from "../types/product";
import { productImageUrl } from "../lib/productImage";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

const CURRENCY = "NPR";

type Props = {
  product: Product;
};

export function ProductCard({ product }: Props) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const toast = useToast();

  const out = product.stock_status === "out_of_stock";
  const booking = product.stock_status === "booking_open";
  const img = productImageUrl(product.main_image);

  const goToProduct = () => navigate(`/productview/${product.slug}`);

  const onAddToCart = (e: MouseEvent) => {
    e.stopPropagation();
    if (out) return;
    addToCart(product, 1, {});
    toast.show("Added to cart!");
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={goToProduct}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToProduct();
        }
      }}
      className="flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative mx-auto mb-4 flex h-44 w-full items-center justify-center">
        <img
          src={img}
          alt=""
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://dummyimage.com/200x200/cccccc/000000&text=No+Image";
          }}
        />
        {out ? (
          <span className="absolute right-0 top-0 rounded bg-red-500 px-2 py-0.5 text-xs text-white">
            Out of Stock
          </span>
        ) : null}
        {booking ? (
          <span className="absolute right-0 top-0 rounded bg-amber-500 px-2 py-0.5 text-xs text-white">
            Pre Order
          </span>
        ) : null}
      </div>
      <div className="flex flex-grow flex-col text-center">
        <h2 className="mb-1 line-clamp-2 text-base font-medium">{product.name}</h2>
        <p className="mb-2 text-gray-600">
          {CURRENCY} {parseFloat(product.price).toLocaleString()}
        </p>
        {product.brand ? (
          <p className="mb-2 text-sm text-gray-500">Brand: {product.brand}</p>
        ) : null}
        <div className="mt-auto">
          <button
            type="button"
            disabled={out}
            onClick={onAddToCart}
            className={`h-12 w-full rounded-full text-sm font-medium text-white transition-colors ${
              out
                ? "cursor-not-allowed bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {out ? "Out of Stock" : booking ? "Pre Order" : "Add to Cart"}
          </button>
        </div>
      </div>
    </article>
  );
}

import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { productImageUrl } from "../lib/productImage";

const CURRENCY = "NPR";

export function CartPage() {
  const { lines } = useCart();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold">Your cart is empty</h1>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Browse products
        </Link>
      </div>
    );
  }

  const total = lines.reduce(
    (sum, l) => sum + parseFloat(l.price) * l.quantity,
    0
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-semibold">Cart</h1>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {lines.map((line) => (
          <li key={`${line.id}-${JSON.stringify(line.selectedOptions)}`} className="flex gap-4 p-4">
            <img
              src={productImageUrl(line.main_image)}
              alt=""
              className="h-20 w-20 shrink-0 rounded object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{line.name}</p>
              <p className="text-sm text-gray-500">Qty {line.quantity}</p>
              <p className="mt-1 text-sm">
                {CURRENCY}{" "}
                {(parseFloat(line.price) * line.quantity).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between text-lg font-semibold">
        <span>Total</span>
        <span>
          {CURRENCY} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Checkout would continue from here in the full storefront.
      </p>
    </div>
  );
}

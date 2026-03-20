import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900">
          MacStore Nepal
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link to="/" className="text-gray-600 hover:text-gray-900">
            Products
          </Link>
          <Link to="/cart" className="text-gray-600 hover:text-gray-900">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </Link>
        </nav>
      </div>
    </header>
  );
}


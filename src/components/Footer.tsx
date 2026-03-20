import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} MacStore Nepal. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              Products
            </Link>
            <Link to="/cart" className="text-gray-600 hover:text-gray-900">
              Cart
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}


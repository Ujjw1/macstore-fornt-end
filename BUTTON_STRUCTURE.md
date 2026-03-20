# Add to Cart & Buy Now Button Structure

Use this as the single source of truth when changing product actions so the UX stays consistent.

---

## Product detail / product view

Keep this layout and behavior:

### 1. Row: Quantity + Add to Cart

- **Quantity controls** (when applicable): `[-]` `quantity` `[+]` in a bordered group.
- **Add to Cart button**
  - Label: `"Add to Cart"` (or `"Add to Cart"` with cart icon).
  - Behavior: Add product (with current quantity) to cart; show success toast; do not navigate away.
  - Style: Primary (e.g. `bg-blue-500 hover:bg-blue-600` or `bg-green-500`), `text-white`, `rounded-md` / `rounded-lg`, `px-6 py-2`, `flex items-center gap-2` if using icon.
  - State: Disabled when out of stock or when required options are missing; show "Out of Stock" when `stock_status === "out_of_stock"`.

### 2. Row: Buy Now / Checkout

- **Buy Now** (or equivalent: direct checkout / installment)
  - Placed in a separate row below, with a clear separator (e.g. `border-t border-gray-200`, `pt-6`).
  - Behavior: Take user to checkout or installment flow with this product (and quantity), not just add to cart.
  - Can be a button or a clickable block (e.g. “Pay with installment” / “Buy now”).

### 3. Optional: Favorite / wishlist

- Secondary control (e.g. heart icon) next to Add to Cart is optional and should not replace or obscure Add to Cart or Buy Now.

---

## Structure summary

| Element        | Position              | Action                          |
|----------------|-----------------------|---------------------------------|
| Quantity       | Left of Add to Cart   | Set quantity for this product   |
| Add to Cart    | Same row as quantity  | Add to cart + toast, stay on page |
| Buy Now        | Next row, below       | Go to checkout/installment      |
| Favorite (opt) | Same row as buttons   | Toggle wishlist                 |

---

## Where it lives in source (proper React)

Edit these TypeScript/React files (run `npm run dev`; build with `npm run build` → `dist/`):

- **Product cards**: `src/components/ProductCard.tsx` — **Add to Cart** only; card click goes to the product page.
- **Product detail**: `src/pages/ProductDetailPage.tsx` — quantity + **Add to Cart** (toast, stay on page), then a separated row with **Buy now** (adds to cart and navigates to `/cart`).

Legacy static chunks (if present under `assets/`) are old build output — prefer the `src/` app for changes.

When adding or changing product pages, prefer the **ProductDetailPage** pattern (quantity + Add to Cart + Buy Now row) for consistency.

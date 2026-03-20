import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartLine, Product } from "../types/product";

const STORAGE_KEY = "cart";

type CartContextValue = {
  lines: CartLine[];
  addToCart: (product: Product, quantity: number, selectedOptions?: Record<string, unknown>) => void;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStored(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

function writeStored(lines: CartLine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setLines(readStored());
  }, []);

  const addToCart = useCallback(
    (product: Product, quantity: number, selectedOptions: Record<string, unknown> = {}) => {
      setLines((prev) => {
        const next = [...prev];
        const idx = next.findIndex(
          (l) => l.id === product.id && JSON.stringify(l.selectedOptions) === JSON.stringify(selectedOptions)
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        } else {
          next.push({ ...product, quantity, selectedOptions });
        }
        writeStored(next);
        return next;
      });
    },
    []
  );

  const itemCount = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);

  const value = useMemo(
    () => ({ lines, addToCart, itemCount }),
    [lines, addToCart, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

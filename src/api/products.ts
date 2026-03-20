import type { Product } from "../types/product";
import { api } from "./client";

function normalizeList(payload: unknown): Product[] {
  if (Array.isArray(payload)) return payload as Product[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const d = (payload as { data: unknown }).data;
    if (Array.isArray(d)) return d as Product[];
  }
  return [];
}

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await api.get<unknown>("/products");
  return normalizeList(data);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await api.get<{ product?: Product }>(`/products/${slug}`);
  return data?.product ?? null;
}

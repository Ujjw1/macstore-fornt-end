export type StockStatus = "in_stock" | "out_of_stock" | "booking_open" | string;

export interface ProductCategory {
  name?: string;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  description?: string;
  price: string;
  brand?: string;
  stock_status: StockStatus;
  main_image?: string;
  category?: ProductCategory | null;
  created_at?: string;
  sku?: string;
}

export interface CartLine extends Product {
  quantity: number;
  selectedOptions: Record<string, unknown>;
}

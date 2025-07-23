export interface StockAlert {
  id: string;
  productName: string;
  productImage?: string;
  currentStock: number;
  threshold: number;
  lastRestock?: string;
  supplier?: string;
  sku?: string;
  orderLink?: string;
  level?: 'critique' | 'moyenne' | 'basse';
  history?: number[];
  reason?: string;
  priority?: 'haute' | 'normale' | 'basse';
}

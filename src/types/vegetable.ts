export type VegetableStatus = 'in_stock' | 'out_of_stock' | 'hidden';

export interface VegetablePrice {
  id: string;
  vegetable_id: string;
  unit: string;
  price: number;
  sort_order: number;
  created_at: string;
}

export interface Vegetable {
  id: string;
  name: string;
  unit: string;
  price: number;
  status: VegetableStatus;
  note?: string | null;
  sort_order: number;
  is_wholesale: boolean;
  tag?: string | null;
  supplier?: string | null;
  updated_at: string;
  created_at: string;
  prices?: VegetablePrice[];
}

export interface Order {
  id: string;
  productId: string;
  customerId: string;
  supplierId?: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'cancelled';
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

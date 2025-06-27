import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { orderService } from '../services/orderService';

export interface Order {
  id: string;
  [key: string]: any;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async (orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const status = await orderService.getOrderStatus(orderId);
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: status.status } : o))
      );
      return status;
    } catch (err: any) {
      console.error('Error getting order status:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return { orders, loading, error, refresh: fetchOrders, fetchStatus };
}

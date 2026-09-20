import { supabase } from '@/lib/supabase';

import { supplierService } from './supplierService';
import { OrderResult } from '../types/supplier';

export const orderService = {
  async forwardOrderToSupplier(orderId: string): Promise<{
    success: boolean;
    message: string;
    externalOrderId?: string;
  }> {
    try {
      // Récupérer les détails de la commande
      const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();
      
      if (error) throw error;
      
      // Regrouper les articles par fournisseur
      const itemsBySupplier: Record<
        string,
        { product_id: string; quantity: number; price: number }[]
      > = {};
      for (const item of order.order_items) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.product_id)
          .single();
        
        if (productError) throw productError;
        
        const supplierId = product.metadata.source_supplier_id;
        if (!supplierId) continue;
        
        if (!itemsBySupplier[supplierId]) {
          itemsBySupplier[supplierId] = [];
        }
        
        itemsBySupplier[supplierId].push({
          product_id: product.metadata.source_id,
          quantity: item.quantity,
          price: item.price
        });
      }
      
      // Transmettre la commande à chaque fournisseur
      const results: OrderResult[] = [];
      for (const [supplierId, items] of Object.entries(itemsBySupplier)) {
        const orderItems = items as {
          product_id: string;
          quantity: number;
          price: number;
        }[];
        const result = await supplierService.createOrder(supplierId, {
          external_order_id: order.id,
          shipping_address: order.shipping_address,
          items: orderItems
        });
        
        results.push(result);

        // Mettre à jour les articles de la commande avec les informations du fournisseur
        for (const item of orderItems) {
          await supabase
            .from('order_items')
            .update({
              metadata: {
                supplier_id: supplierId,
                external_order_id: result.externalOrderId
              }
            })
            .eq('order_id', orderId)
            .eq('product_id', item.product_id);
        }
      }
      
      return {
        success: true,
        message: `Order forwarded to ${results.length} suppliers`,
        externalOrderId: results[0]?.externalOrderId
      };
    } catch (error) {
      console.error('Error forwarding order to supplier:', error);
      throw error;
    }
  },

  async getOrderStatus(orderId: string): Promise<{
    status: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
    supplierStatuses: {
      supplierId: string;
      supplierName: string;
      status: string;
      trackingNumber?: string;
      estimatedDelivery?: string;
    }[];
  }> {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    if (!order) throw new Error('Order not found');

    const supplierStatuses: {
      supplierId: string;
      supplierName: string;
      status: string;
      trackingNumber?: string;
      estimatedDelivery?: string;
    }[] = [];

    const seen = new Set<string>();

    for (const item of order.order_items || []) {
      const supplierId = item.metadata?.supplier_id as string | undefined;
      const externalOrderId = item.metadata?.external_order_id as string | undefined;
      if (!supplierId || !externalOrderId) continue;

      const key = `${supplierId}:${externalOrderId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const { data: supplier, error: supplierError } = await supabase
        .from('external_suppliers')
        .select('id,name')
        .eq('id', supplierId)
        .single();

      if (supplierError || !supplier) {
        supplierStatuses.push({
          supplierId,
          supplierName: 'Fournisseur indisponible',
          status: 'unavailable',
        });
        continue;
      }

      try {
        const remote = await supplierService.getOrderStatus(supplierId, externalOrderId);
        supplierStatuses.push({
          supplierId,
          supplierName: supplier.name,
          status: remote.status || 'unknown',
          trackingNumber: remote.trackingNumber,
          estimatedDelivery: remote.estimatedDelivery,
        });
      } catch (cause) {
        console.error(`Error getting order status from supplier ${supplierId}:`, cause);
        supplierStatuses.push({
          supplierId,
          supplierName: supplier.name,
          status: 'unavailable',
        });
      }
    }

    if (supplierStatuses.length === 0) {
      return {
        status: 'unknown',
        supplierStatuses: [],
      };
    }

    const verifiable = supplierStatuses.filter((entry) => entry.status !== 'unavailable' && entry.status !== 'unknown');
    let overallStatus = 'unknown';

    if (verifiable.length > 0) {
      if (verifiable.every((entry) => entry.status === 'delivered')) {
        overallStatus = 'delivered';
      } else if (verifiable.some((entry) => entry.status === 'shipped')) {
        overallStatus = 'shipped';
      } else if (verifiable.some((entry) => entry.status === 'processing')) {
        overallStatus = 'processing';
      } else {
        overallStatus = verifiable[0].status;
      }
    }

    return {
      status: overallStatus,
      trackingNumber: supplierStatuses.find((entry) => entry.trackingNumber)?.trackingNumber,
      estimatedDelivery: supplierStatuses.find((entry) => entry.estimatedDelivery)?.estimatedDelivery,
      supplierStatuses,
    };
  }
};
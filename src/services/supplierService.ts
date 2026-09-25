import axios from 'axios';

import { supabase } from '@/lib/supabase';
import { ExternalSupplier, SupplierSummary, SupplierProduct, ImportFilter, ImportResult, OrderRequest, OrderResult } from '@/types/supplier';
import { cjSupplierService } from '@/services/cjSupplierService';

export const supplierService = {
  async getSupplierSummaries(): Promise<SupplierSummary[]> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .select('id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at')
        .neq('type', 'autods')
        .order('name');

      if (error) throw error;

      return (data || []).map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        type: supplier.type,
        status: supplier.status,
        lastSync: supplier.last_sync ?? undefined,
        webhookStatus: supplier.webhook_status ?? 'not_configured',
        webhookLastEventAt: supplier.webhook_last_event_at ?? undefined,
        created_at: supplier.created_at,
      }));
    } catch (error) {
      console.error('Error fetching supplier summaries:', error);
      throw error;
    }
  },

  async getSupplierSummaryById(id: string): Promise<SupplierSummary> {
    const { data, error } = await supabase
      .from('external_suppliers')
      .select('id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at')
      .eq('id', id)
      .neq('type', 'autods')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status,
      lastSync: data.last_sync ?? undefined,
      webhookStatus: data.webhook_status ?? 'not_configured',
      webhookLastEventAt: data.webhook_last_event_at ?? undefined,
      created_at: data.created_at,
    };
  },

  async configureRealtimeSync(supplierId: string): Promise<boolean> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Realtime supplier sync is not implemented for this supplier yet');
    }

    await cjSupplierService.configureWebhooks(supplierId);
    return true;
  },

  async testConnectionById(supplierId: string): Promise<boolean> {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/test`;
      const session = (await supabase.auth.getSession()).data.session;

      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await axios.post(
        apiUrl,
        { supplierId },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      return response.data?.success === true;
    } catch (error) {
      console.error('Error testing supplier connection by id:', error);
      return false;
    }
  },
  async createSupplier(
    supplier: Omit<ExternalSupplier, 'id' | 'created_at'>
  ): Promise<SupplierSummary> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .insert([{
          name: supplier.name,
          type: supplier.type,
          api_key: supplier.apiKey,
          api_secret: supplier.apiSecret,
          base_url: supplier.baseUrl,
          status: 'inactive',
          user_id: supplier.user_id,
          created_at: new Date().toISOString(),
        }])
        .select('id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at')
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        type: data.type,
        status: data.status,
        lastSync: data.last_sync ?? undefined,
        webhookStatus: data.webhook_status ?? 'not_configured',
        webhookLastEventAt: data.webhook_last_event_at ?? undefined,
        created_at: data.created_at,
      };
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  },

  async updateSupplier(
    id: string,
    updates: Partial<ExternalSupplier>
  ): Promise<SupplierSummary> {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.apiKey !== undefined) dbUpdates.api_key = updates.apiKey;
      if (updates.apiSecret !== undefined) dbUpdates.api_secret = updates.apiSecret;
      if (updates.baseUrl !== undefined) dbUpdates.base_url = updates.baseUrl;

      const { data, error } = await supabase
        .from('external_suppliers')
        .update(dbUpdates)
        .eq('id', id)
        .select('id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at')
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        type: data.type,
        status: data.status,
        lastSync: data.last_sync ?? undefined,
        webhookStatus: data.webhook_status ?? 'not_configured',
        webhookLastEventAt: data.webhook_last_event_at ?? undefined,
        created_at: data.created_at,
      };
    } catch (error) {
      console.error(`Error updating supplier with ID ${id}:`, error);
      throw error;
    }
  },

  async deleteSupplier(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('external_suppliers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting supplier with ID ${id}:`, error);
      throw error;
    }
  },

  async getProducts(supplierId: string, filters: ImportFilter = {}): Promise<SupplierProduct[]> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Product catalog is not implemented for this supplier yet');
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj_dropshipping`;
    const response = await axios.post(
      apiUrl,
      { supplierId, action: 'search', filters },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    return response.data.products || [];
  },

  async getProductById(supplierId: string, productId: string): Promise<SupplierProduct> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Product detail is not implemented for this supplier yet');
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj_dropshipping`;
    const response = await axios.post(
      apiUrl,
      { supplierId, action: 'detail', productId },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.data.product) throw new Error(`Product ${productId} not found`);
    return response.data.product;
  },

  async getProductsByIds(supplierId: string, productIds: string[]): Promise<SupplierProduct[]> {
    const products: SupplierProduct[] = [];
    for (const productId of productIds) {
      products.push(await this.getProductById(supplierId, productId));
    }
    return products;
  },

  async getCategories(supplierId: string): Promise<any[]> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Supplier categories are not implemented for this supplier yet');
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj_dropshipping`;
    const response = await axios.post(
      apiUrl,
      { supplierId, action: 'categories' },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    return response.data.categories || [];
  },

  async getVariants(
    supplierId: string,
    productId: string,
    countryCode?: string
  ): Promise<SupplierProduct['variants']> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Supplier variants are not implemented for this supplier yet');
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj_dropshipping`;
    const response = await axios.post(
      apiUrl,
      { supplierId, action: 'variants', productId, countryCode },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    return response.data.variants || [];
  },

  async getVariantStock(supplierId: string, variantId: string): Promise<number> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Supplier stock is not implemented for this supplier yet');
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj_dropshipping`;
    const response = await axios.post(
      apiUrl,
      { supplierId, action: 'stock', variantId },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    return Number(response.data.stock || 0);
  },

  async importProducts(supplierId: string, productIds: string[]): Promise<ImportResult> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Supplier import is not implemented for this supplier yet');
    }

    if (productIds.length === 0) {
      return {
        success: false,
        message: 'No supplier products selected',
        importedCount: 0,
        failedCount: 0,
      };
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj_dropshipping`;
    const response = await axios.post(
      apiUrl,
      { supplierId, action: 'snapshot_import', productIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const importedCount = Number(response.data?.importedCount ?? 0);
    const failedCount = Number(response.data?.failedCount ?? 0);
    const errors = Array.isArray(response.data?.failed)
      ? response.data.failed.map((failure: { externalId?: string; error?: string }) =>
          `${failure.externalId || 'unknown'}: ${failure.error || 'import failed'}`
        )
      : undefined;

    if (importedCount > 0 && supplier.webhookStatus === 'enabled') {
      try {
        for (let index = 0; index < productIds.length; index += 100) {
          await cjSupplierService.subscribeWebhookProducts(
            supplierId,
            productIds.slice(index, index + 100)
          );
        }
      } catch (error) {
        console.warn('CJ product webhook subscription was not confirmed:', error);
      }
    }

    return {
      success: response.data?.success === true,
      message:
        failedCount === 0
          ? `Imported ${importedCount} verified CJdropshipping product snapshots`
          : `Imported ${importedCount} products; ${failedCount} failed`,
      importedCount,
      failedCount,
      errors,
    };
  },

  async importToShopify(products: SupplierProduct[]): Promise<ImportResult> {
    try {
      // Call the Shopify import endpoint
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify/import`;
      
      const response = await axios.post(apiUrl, {
        products
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error importing products to Shopify:', error);
      throw error;
    }
  },

  async createOrder(supplierId: string, orderData: OrderRequest): Promise<OrderResult> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Supplier order automation is not implemented for this supplier yet');
    }

    if (!orderData.logisticName) {
      throw new Error('CJdropshipping logisticName is required before creating an order');
    }

    const cjPayload: Record<string, unknown> = {
      orderNumber: orderData.external_order_id,
      shippingZip: orderData.shipping_address.zip,
      shippingCountryCode: orderData.shipping_address.country,
      shippingCountry:
        orderData.shipping_address.country_name || orderData.shipping_address.country,
      shippingProvince: orderData.shipping_address.state,
      shippingCity: orderData.shipping_address.city,
      shippingAddress: orderData.shipping_address.address1,
      shippingAddress2: orderData.shipping_address.address2,
      shippingCustomerName: orderData.shipping_address.name,
      shippingPhone: orderData.shipping_address.phone,
      email: orderData.shipping_address.email,
      logisticName: orderData.logisticName,
      fromCountryCode: orderData.fromCountryCode || 'CN',
      payType: orderData.payType ?? 3,
      orderFlow: orderData.orderFlow ?? 1,
      platform: orderData.platform || 'shopopti',
      products: orderData.items.map((item) => ({
        vid: item.product_id,
        quantity: item.quantity,
      })),
    };

    const result = await cjSupplierService.createOrder(supplierId, cjPayload);
    const remote = result.data as any;
    const data = remote?.data ?? remote;
    const externalOrderId =
      data?.orderId ?? data?.orderNum ?? data?.orderNumber ?? data?.orderCode;

    if (!externalOrderId) {
      throw new Error('CJdropshipping did not return an order identifier');
    }

    return {
      success: true,
      message: 'CJdropshipping order created',
      externalOrderId: String(externalOrderId),
      status: String(data?.orderStatus ?? data?.status ?? 'created'),
    };
  },

  async getOrderStatus(supplierId: string, externalOrderId: string): Promise<{
    status: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  }> {
    const supplier = await this.getSupplierSummaryById(supplierId);
    if (supplier.type !== 'cj_dropshipping') {
      throw new Error('Supplier tracking is not implemented for this supplier yet');
    }

    const result = await cjSupplierService.getOrderDetail(supplierId, {
      orderId: externalOrderId,
    });
    const remote = result.data as any;
    const data = remote?.data ?? remote;

    return {
      status: String(data?.orderStatus ?? data?.status ?? 'unknown'),
      trackingNumber:
        data?.trackingNumber ?? data?.trackingNumberList?.[0] ?? data?.trackNumber,
      estimatedDelivery: data?.estimatedDelivery ?? data?.logisticsTimeliness?.endTime,
    };
  }
};

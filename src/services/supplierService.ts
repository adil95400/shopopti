import axios from 'axios';

import { supabase } from '@/lib/supabase';
import { ExternalSupplier, SupplierSummary, SupplierProduct, ImportFilter, ImportResult, OrderRequest, OrderResult } from '@/types/supplier';

export const supplierService = {
  async getSupplierSummaries(): Promise<SupplierSummary[]> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .select('id,name,type,status,last_sync,created_at')
        .neq('type', 'autods')
        .order('name');

      if (error) throw error;

      return (data || []).map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        type: supplier.type,
        status: supplier.status,
        lastSync: supplier.last_sync ?? undefined,
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
      .select('id,name,type,status,last_sync,created_at')
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
      created_at: data.created_at,
    };
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
  async getSuppliers(): Promise<ExternalSupplier[]> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .select('*')
        .neq('type', 'autods')
        .order('name');
      
      if (error) throw error;
      return (data || []).map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        type: supplier.type,
        apiKey: supplier.api_key,
        apiSecret: supplier.api_secret ?? undefined,
        baseUrl: supplier.base_url,
        status: supplier.status,
        lastSync: supplier.last_sync ?? undefined,
        created_at: supplier.created_at,
        user_id: supplier.user_id,
      }));
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  },

  async getSupplierById(id: string): Promise<ExternalSupplier> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        type: data.type,
        apiKey: data.api_key,
        apiSecret: data.api_secret ?? undefined,
        baseUrl: data.base_url,
        status: data.status,
        lastSync: data.last_sync ?? undefined,
        created_at: data.created_at,
        user_id: data.user_id,
      };
    } catch (error) {
      console.error(`Error fetching supplier with ID ${id}:`, error);
      throw error;
    }
  },

  async createSupplier(supplier: Omit<ExternalSupplier, 'id' | 'created_at'>): Promise<ExternalSupplier> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .insert([{
          ...supplier,
          status: 'inactive',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // A stored credential is configuration, not proof of a working remote connection.
      // New suppliers remain inactive until a provider-specific server probe verifies them.
      return data;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  },

  async updateSupplier(id: string, updates: Partial<ExternalSupplier>): Promise<ExternalSupplier> {
    try {
      const { data, error } = await supabase
        .from('external_suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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

  async testConnection(supplier: Omit<ExternalSupplier, 'id' | 'created_at' | 'status'>): Promise<boolean> {
    try {
      // Call the appropriate API endpoint based on supplier type
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/test`;
      
      const response = await axios.post(apiUrl, {
        type: supplier.type,
        apiKey: supplier.apiKey,
        apiSecret: supplier.apiSecret,
        baseUrl: supplier.baseUrl
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      return response.data.success;
    } catch (error) {
      console.error('Error testing supplier connection:', error);
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

  async importProducts(_supplierId: string, _productIds: string[]): Promise<ImportResult> {
    throw new Error(
      'Supplier import is disabled until the canonical import pipeline accepts verified server-side product snapshots'
    );
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

  async createOrder(_supplierId: string, _orderData: OrderRequest): Promise<OrderResult> {
    throw new Error('Supplier order automation is not available until a verified provider connector implements it');
  },

  async getOrderStatus(_supplierId: string, _externalOrderId: string): Promise<{
    status: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  }> {
    throw new Error('Supplier tracking is not available until a verified provider connector implements it');
  }
};

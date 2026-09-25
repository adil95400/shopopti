import { supabase } from '@/integrations/supabase/client';

type CjAction =
  | 'products'
  | 'variants'
  | 'stock'
  | 'freight'
  | 'order_create'
  | 'order_detail'
  | 'tracking';

interface CjRequest {
  supplierId: string;
  action: CjAction;
  params?: Record<string, string | number | boolean | undefined>;
  payload?: Record<string, unknown>;
}

interface CjResponse<T = unknown> {
  success: boolean;
  provider?: 'cj_dropshipping';
  action?: CjAction;
  fetchedAt?: string;
  data?: T;
  error?: string;
}

const invoke = async <T = unknown>(request: CjRequest): Promise<CjResponse<T>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Authentication required');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers/cj`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(request),
    }
  );

  const result = (await response.json()) as CjResponse<T>;
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || 'CJdropshipping request failed');
  }
  return result;
};

export const cjSupplierService = {
  searchProducts(
    supplierId: string,
    filters: {
      page?: number;
      size?: number;
      keyWord?: string;
      categoryId?: string;
      countryCode?: string;
      minPrice?: number;
      maxPrice?: number;
    } = {}
  ) {
    return invoke({ supplierId, action: 'products', params: filters });
  },

  getVariants(supplierId: string, params: { pid?: string; sku?: string }) {
    return invoke({ supplierId, action: 'variants', params });
  },

  getStock(supplierId: string, vid: string) {
    return invoke({ supplierId, action: 'stock', params: { vid } });
  },

  calculateFreight(supplierId: string, payload: Record<string, unknown>) {
    return invoke({ supplierId, action: 'freight', payload });
  },

  createOrder(supplierId: string, payload: Record<string, unknown>) {
    return invoke({ supplierId, action: 'order_create', payload });
  },

  getOrderDetail(supplierId: string, params: Record<string, string>) {
    return invoke({ supplierId, action: 'order_detail', params });
  },

  getTracking(supplierId: string, params: Record<string, string>) {
    return invoke({ supplierId, action: 'tracking', params });
  },
};
